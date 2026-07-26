package imbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type CreateConnectionRequest struct {
	OrganizationID  int64
	CreatedByUserID int64
	Provider        string
	Name            string
	ChannelID       *int64
	Config          json.RawMessage
	Status          string
	DMPolicy        string
	GroupPolicy     string
	AllowFrom       json.RawMessage
	Transport       string
	Locale          string
}

func (s *Service) CreateConnection(ctx context.Context, req *CreateConnectionRequest) (*domain.Connection, error) {
	req.Provider = NormalizeProvider(req.Provider)
	provider, err := GetProvider(s.registry, req.Provider)
	if err != nil {
		return nil, ErrInvalidProvider
	}
	if err := provider.ValidateConfig(req.Config); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfig, err)
	}
	token, err := newWebhookToken()
	if err != nil {
		return nil, err
	}
	status := req.Status
	if status == "" {
		status = domain.StatusDisabled
	}
	plain := req.Config
	stored, encrypted, err := s.cipher.seal(plain)
	if err != nil {
		return nil, err
	}
	conn := &domain.Connection{
		OrganizationID:  req.OrganizationID,
		Provider:        req.Provider,
		Name:            strings.TrimSpace(req.Name),
		ChannelID:       req.ChannelID,
		Config:          stored,
		ConfigEncrypted: encrypted,
		WebhookToken:    token,
		Status:          status,
		Transport:       defaultStr(req.Transport, "webhook"),
		DMPolicy:        defaultStr(req.DMPolicy, domain.DMPolicyPairing),
		GroupPolicy:     defaultStr(req.GroupPolicy, domain.GroupPolicyAllowlist),
		AllowFrom:       defaultJSON(req.AllowFrom, []byte("[]")),
		StreamingMode:   "progress",
		Locale:          defaultStr(req.Locale, DefaultLocaleForProvider(req.Provider)),
		CreatedByUserID: req.CreatedByUserID,
	}
	if conn.Name == "" {
		return nil, fmt.Errorf("%w: name required", ErrInvalidConfig)
	}
	if err := s.repo.CreateConnection(ctx, conn); err != nil {
		return nil, err
	}
	conn.Config = redactConfig(plain)
	s.decorate(conn)
	return conn, nil
}

type UpdateConnectionRequest struct {
	Name        *string
	ChannelID   *int64
	Config      json.RawMessage
	Status      *string
	DMPolicy    *string
	GroupPolicy *string
	AllowFrom   json.RawMessage
	Transport   *string
	Locale      *string
}

func (s *Service) UpdateConnection(ctx context.Context, orgID, id int64, req *UpdateConnectionRequest) (*domain.Connection, error) {
	conn, err := s.repo.GetConnection(ctx, orgID, id)
	if err != nil {
		return nil, err
	}
	if conn == nil {
		return nil, ErrNotFound
	}
	if req.Name != nil {
		conn.Name = strings.TrimSpace(*req.Name)
	}
	if req.ChannelID != nil {
		conn.ChannelID = req.ChannelID
	}
	plain, err := s.cipher.open(conn)
	if err != nil {
		return nil, err
	}
	if len(req.Config) > 0 {
		provider, err := GetProvider(s.registry, conn.Provider)
		if err != nil {
			return nil, err
		}
		if err := provider.ValidateConfig(req.Config); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidConfig, err)
		}
		plain = req.Config
		stored, encrypted, err := s.cipher.seal(plain)
		if err != nil {
			return nil, err
		}
		conn.Config = stored
		conn.ConfigEncrypted = encrypted
	}
	if req.Status != nil {
		conn.Status = *req.Status
	}
	if req.DMPolicy != nil {
		conn.DMPolicy = *req.DMPolicy
	}
	if req.GroupPolicy != nil {
		conn.GroupPolicy = *req.GroupPolicy
	}
	if len(req.AllowFrom) > 0 {
		conn.AllowFrom = req.AllowFrom
	}
	if req.Transport != nil {
		conn.Transport = *req.Transport
	}
	if req.Locale != nil {
		if !IsSupportedLocale(*req.Locale) {
			return nil, fmt.Errorf("%w: unsupported locale %s", ErrInvalidConfig, *req.Locale)
		}
		conn.Locale = *req.Locale
	}
	if err := s.repo.UpdateConnection(ctx, conn); err != nil {
		return nil, err
	}
	conn.Config = redactConfig(plain)
	s.decorate(conn)
	return conn, nil
}
