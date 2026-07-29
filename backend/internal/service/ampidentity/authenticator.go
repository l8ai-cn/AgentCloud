package ampidentity

import (
	"context"
	"errors"
	"fmt"
	"strings"

	ssodomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
	userdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
	authsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/auth"
	ssosvc "github.com/l8ai-cn/agentcloud/backend/internal/service/sso"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

var (
	ErrIssuerNotConfigured = errors.New("amp issuer is not configured for bearer trust")
	ErrAppCodeNotAllowed   = errors.New("amp app code is not allowed to assert identities")
	ErrAmbiguousConfig     = errors.New("amp app code matches more than one SSO config")
	ErrOrganizationUnbound = errors.New("amp tenant resolves to no organization")
)

type Identity struct {
	UserID         int64
	Email          string
	Username       string
	OrganizationID int64
	TenantID       string
	AppCode        string
	ConfigID       int64
}

type ConfigLister interface {
	ListAMPBearerByIssuerPrefix(ctx context.Context, issuerPrefix string) ([]*ssodomain.Config, error)
}

type IdentityFederator interface {
	FederateIdentity(
		ctx context.Context,
		req *authsvc.SSOLoginRequest,
	) (*userdomain.User, int64, error)
}

type TokenVerifier interface {
	Verify(
		ctx context.Context,
		issuer string,
		rawToken string,
	) (ampauthz.BusinessTokenClaims, error)
}

type Authenticator struct {
	configs   ConfigLister
	federator IdentityFederator
	verifier  TokenVerifier
}

func NewAuthenticator(
	configs ConfigLister,
	federator IdentityFederator,
	verifier TokenVerifier,
) *Authenticator {
	return &Authenticator{configs: configs, federator: federator, verifier: verifier}
}

// Authenticate turns an AMP business access token into a local identity.
//
// Trust is established in this order on purpose: the issuer is matched against
// stored configuration before any network call, so an attacker-supplied issuer is
// never contacted, and the signature is checked before any claim is used.
func (a *Authenticator) Authenticate(ctx context.Context, rawToken string) (*Identity, error) {
	issuer, err := ampbearer.PeekIssuer(rawToken)
	if err != nil {
		return nil, err
	}
	base, appCode, err := ampbearer.SplitIssuer(issuer)
	if err != nil {
		return nil, err
	}
	config, err := a.trustedConfig(ctx, base, appCode)
	if err != nil {
		return nil, err
	}
	claims, err := a.verifier.Verify(ctx, issuer, rawToken)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(claims.AppCode, appCode) {
		return nil, fmt.Errorf("%w: app code %q does not match issuer",
			ErrAppCodeNotAllowed, claims.AppCode)
	}
	return a.federate(ctx, config, claims)
}

func (a *Authenticator) federate(
	ctx context.Context,
	config *ssodomain.Config,
	claims ampauthz.BusinessTokenClaims,
) (*Identity, error) {
	tenant := claims.Tenant()
	user, orgID, err := a.federator.FederateIdentity(ctx, &authsvc.SSOLoginRequest{
		ProviderName:          ssosvc.SSOProviderName(ssodomain.ProtocolOIDC, config.ID),
		ExternalID:            claims.Subject,
		Username:              claims.DisplayName(),
		Email:                 strings.TrimSpace(claims.Email),
		Name:                  claims.DisplayName(),
		DefaultOrganizationID: config.DefaultOrganizationID,
		IdPTenantID:           tenant,
		IdPRoles:              claims.RoleCodeList(),
	})
	if err != nil {
		return nil, err
	}
	if orgID <= 0 {
		return nil, fmt.Errorf("%w: tenant %s", ErrOrganizationUnbound, tenant)
	}
	return &Identity{
		UserID:         user.ID,
		Email:          user.Email,
		Username:       user.Username,
		OrganizationID: orgID,
		TenantID:       tenant,
		AppCode:        claims.AppCode,
		ConfigID:       config.ID,
	}, nil
}

func (a *Authenticator) trustedConfig(
	ctx context.Context,
	issuerBase string,
	appCode string,
) (*ssodomain.Config, error) {
	candidates, err := a.configs.ListAMPBearerByIssuerPrefix(ctx, issuerBase)
	if err != nil {
		return nil, err
	}
	matched := make([]*ssodomain.Config, 0, 1)
	for _, candidate := range candidates {
		if allowsAppCode(candidate, appCode) {
			matched = append(matched, candidate)
		}
	}
	switch len(matched) {
	case 1:
		return matched[0], nil
	case 0:
		if len(candidates) == 0 {
			return nil, fmt.Errorf("%w: %s", ErrIssuerNotConfigured, issuerBase)
		}
		return nil, fmt.Errorf("%w: %s", ErrAppCodeNotAllowed, appCode)
	default:
		return nil, fmt.Errorf("%w: %s", ErrAmbiguousConfig, appCode)
	}
}
