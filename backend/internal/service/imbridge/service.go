package imbridge

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"github.com/l8ai-cn/agentcloud/backend/pkg/crypto"
)

var (
	ErrNotFound         = errors.New("im connection not found")
	ErrInvalidProvider  = errors.New("invalid im provider")
	ErrInvalidConfig    = errors.New("invalid im connection config")
	ErrConnectionPaused = errors.New("im connection is not active")
	ErrUnauthorized     = errors.New("im sender not authorized")
	ErrPairingRequired  = errors.New("im pairing required")
)

type Service struct {
	repo     domain.Repository
	registry map[string]Provider
	baseURL  string
	cipher   *configCipher
}

func NewService(repo domain.Repository, registry map[string]Provider, publicBaseURL string, encryptor *crypto.Encryptor) *Service {
	return &Service{
		repo:     repo,
		registry: registry,
		baseURL:  strings.TrimRight(publicBaseURL, "/"),
		cipher:   newConfigCipher(encryptor),
	}
}

func (s *Service) ListProviders() []map[string]string {
	return ListProviderMeta(s.registry)
}

func (s *Service) ListConnections(ctx context.Context, orgID int64) ([]*domain.Connection, error) {
	conns, err := s.repo.ListConnections(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, c := range conns {
		s.decoratePublic(c)
	}
	return conns, nil
}

func (s *Service) GetConnection(ctx context.Context, orgID, id int64) (*domain.Connection, error) {
	conn, err := s.repo.GetConnection(ctx, orgID, id)
	if err != nil {
		return nil, err
	}
	if conn == nil {
		return nil, ErrNotFound
	}
	s.decoratePublic(conn)
	return conn, nil
}

func (s *Service) DeleteConnection(ctx context.Context, orgID, id int64) error {
	return s.repo.DeleteConnection(ctx, orgID, id)
}

func (s *Service) providerConfig(conn *domain.Connection) (json.RawMessage, error) {
	return s.cipher.open(conn)
}

func (s *Service) decorate(conn *domain.Connection) {
	conn.WebhookURL = fmt.Sprintf("%s/api/v1/webhooks/im/%s/%d?token=%s",
		s.baseURL, conn.Provider, conn.ID, conn.WebhookToken)
}

func (s *Service) decoratePublic(conn *domain.Connection) {
	plain, err := s.cipher.open(conn)
	if err != nil {
		conn.Config = json.RawMessage(`{}`)
	} else {
		conn.Config = redactConfig(plain)
	}
	s.decorate(conn)
}

func newWebhookToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func defaultStr(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func defaultJSON(v json.RawMessage, fallback []byte) json.RawMessage {
	if len(v) == 0 {
		return json.RawMessage(fallback)
	}
	return v
}
