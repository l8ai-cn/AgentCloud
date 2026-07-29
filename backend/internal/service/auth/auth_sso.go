package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
	userService "github.com/l8ai-cn/agentcloud/backend/internal/service/user"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
)

var (
	// ErrSSOTenantUnbound means the IdP tenant has no AgentCloud organization.
	ErrSSOTenantUnbound = errors.New("SSO IdP tenant is not bound to an organization")
	// ErrSSOTenantMismatch means authorize/config default org disagrees with IdP tenant.
	ErrSSOTenantMismatch = errors.New("SSO IdP tenant does not match configured organization")
)

type SSOLoginRequest struct {
	ProviderName string
	ExternalID   string
	Username     string
	Email        string
	Name         string
	AvatarURL    string
	// EmailVerified propagates the IdP's assertion. The SSO config's operator
	// decides whether that IdP is authoritative for the email domain.
	EmailVerified bool
	// DefaultOrganizationID is the SSO config fallback when IdPTenantID is empty
	// or when validating that tenant mapping matches the configured org.
	DefaultOrganizationID *int64
	// IdPTenantID is AMP authz_tenant_id / tenant_id from the token exchange.
	IdPTenantID string
	// IdPRoles are AMP application role codes from the business access_token.
	IdPRoles []string
}

// SSOLogin authenticates a user via SSO identity, records the login, and returns tokens.
func (s *Service) SSOLogin(ctx context.Context, req *SSOLoginRequest) (*user.User, *TokenPair, error) {
	u, _, err := s.FederateIdentity(ctx, req)
	if err != nil {
		return nil, nil, err
	}
	s.userService.RecordLogin(ctx, u.ID)

	tokens, err := s.GenerateTokenPair(u, 0, "")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return u, tokens, nil
}

// FederateIdentity resolves an IdP assertion to a local user and organization
// membership. The browser SSO callback and the AMP bearer authenticator share it
// so both land on the same user for the same IdP subject. It returns the
// resolved organization id, or 0 when the assertion carries no organization.
func (s *Service) FederateIdentity(
	ctx context.Context,
	req *SSOLoginRequest,
) (*user.User, int64, error) {
	u, _, err := s.userService.GetOrCreateByExternalIdentity(ctx, userService.ExternalIdentity{
		Provider:       req.ProviderName,
		ProviderUserID: req.ExternalID,
		Username:       req.Username,
		Email:          req.Email,
		Name:           req.Name,
		AvatarURL:      req.AvatarURL,
		EmailVerified:  req.EmailVerified,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create/get user: %w", err)
	}

	if !u.IsActive {
		return nil, 0, ErrUserDisabled
	}

	orgID, err := s.bindFederatedOrganization(ctx, u.ID, req)
	if err != nil {
		return nil, 0, err
	}
	return u, orgID, nil
}

func (s *Service) bindFederatedOrganization(
	ctx context.Context,
	userID int64,
	req *SSOLoginRequest,
) (int64, error) {
	if s.orgBinder == nil {
		if req.DefaultOrganizationID != nil || req.IdPTenantID != "" {
			slog.WarnContext(ctx, "SSO org binding requested but no binder is wired",
				"provider", req.ProviderName, "idp_tenant_id", req.IdPTenantID)
		}
		return 0, nil
	}

	orgID, err := s.resolveFederatedOrgID(ctx, req)
	if err != nil {
		return 0, err
	}
	if orgID <= 0 {
		return 0, nil
	}

	role := ""
	if len(req.IdPRoles) == 0 {
		// Empty roles are common before AMP catalog assignment. Never demote.
		slog.WarnContext(ctx, "federated login omitted IdP roles; preserving membership role",
			"provider", req.ProviderName, "user_id", userID,
			"org_id", orgID, "idp_tenant_id", req.IdPTenantID)
	} else {
		role = ampauthz.MapIdPRoles(req.IdPRoles)
	}
	if err := s.orgBinder.SyncFederatedMember(ctx, orgID, userID, role); err != nil {
		slog.ErrorContext(ctx, "failed to sync federated organization membership",
			"provider", req.ProviderName, "user_id", userID,
			"org_id", orgID, "role", role, "error", err)
		// Misconfigured org must not lock the whole IdP out when only the
		// static default org path is used without a tenant claim.
		if req.IdPTenantID != "" {
			return 0, fmt.Errorf("federated org sync: %w", err)
		}
	}
	slog.InfoContext(ctx, "federated organization bound",
		"provider", req.ProviderName, "user_id", userID,
		"org_id", orgID, "role", role, "idp_tenant_id", req.IdPTenantID,
		"idp_roles", req.IdPRoles)
	return orgID, nil
}

func (s *Service) resolveFederatedOrgID(ctx context.Context, req *SSOLoginRequest) (int64, error) {
	tenantID := req.IdPTenantID
	if tenantID != "" {
		orgID, err := s.orgBinder.ResolveAmpTenant(ctx, tenantID)
		if err == nil {
			if req.DefaultOrganizationID != nil && *req.DefaultOrganizationID > 0 &&
				*req.DefaultOrganizationID != orgID {
				return 0, fmt.Errorf("%w: tenant %s -> org %d, config default %d",
					ErrSSOTenantMismatch, tenantID, orgID, *req.DefaultOrganizationID)
			}
			return orgID, nil
		}
		if !errors.Is(err, organization.ErrNotFound) {
			return 0, err
		}
		// Tenant asserted but unbound — do not silently fall into default org.
		return 0, fmt.Errorf("%w: %s", ErrSSOTenantUnbound, tenantID)
	}

	if req.DefaultOrganizationID != nil && *req.DefaultOrganizationID > 0 {
		return *req.DefaultOrganizationID, nil
	}
	return 0, nil
}
