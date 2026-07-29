package ampbearer

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/coreos/go-oidc/v3/oidc"

	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
)

var (
	ErrNotBusinessToken = errors.New("token is not an AMP business access token")
	ErrClaimsIncomplete = errors.New("amp token identity claims are incomplete")
	ErrSignature        = errors.New("amp token signature verification failed")
)

// Verifier checks AMP business access tokens against the issuing deployment's
// JWKS. The audience check is skipped on purpose: a business token issued for
// one AMP application is being presented to another, and that cross-application
// trust is authorized by the app-code whitelist rather than by `aud`.
type Verifier struct {
	mu        sync.Mutex
	verifiers map[string]*oidc.IDTokenVerifier
}

func NewVerifier() *Verifier {
	return &Verifier{verifiers: make(map[string]*oidc.IDTokenVerifier)}
}

// PeekIssuer reads the issuer without verifying anything. It exists so the
// caller can resolve trust configuration before making any network call to the
// issuer, which keeps an attacker-supplied issuer from being contacted at all.
func PeekIssuer(rawToken string) (string, error) {
	claims, ok := ampauthz.DecodeBusinessToken(rawToken)
	if !ok {
		return "", ErrNotBusinessToken
	}
	if claims.TokenUse != ampauthz.BusinessTokenUse {
		return "", ErrNotBusinessToken
	}
	return claims.Issuer, nil
}

// IsBusinessToken routes a bearer credential to this authenticator. The value is
// unverified, so it may only select a code path — never grant anything.
func IsBusinessToken(rawToken string) bool {
	issuer, err := PeekIssuer(rawToken)
	return err == nil && issuer != ""
}

func (v *Verifier) Verify(
	ctx context.Context,
	issuer string,
	rawToken string,
) (ampauthz.BusinessTokenClaims, error) {
	var claims ampauthz.BusinessTokenClaims
	verifier, err := v.verifierFor(ctx, issuer)
	if err != nil {
		return claims, err
	}
	verified, err := verifier.Verify(ctx, rawToken)
	if err != nil {
		return claims, fmt.Errorf("%w: %v", ErrSignature, err)
	}
	if err := verified.Claims(&claims); err != nil {
		return claims, fmt.Errorf("%w: %v", ErrClaimsIncomplete, err)
	}
	if err := requireIdentityClaims(claims, issuer); err != nil {
		return claims, err
	}
	return claims, nil
}

func requireIdentityClaims(claims ampauthz.BusinessTokenClaims, issuer string) error {
	switch {
	case claims.TokenUse != ampauthz.BusinessTokenUse:
		return ErrNotBusinessToken
	case claims.PrincipalType != ampauthz.PrincipalTypeUserSession:
		return fmt.Errorf("%w: principal type %q is not a user session",
			ErrClaimsIncomplete, claims.PrincipalType)
	case claims.Issuer != issuer:
		return fmt.Errorf("%w: issuer changed after verification", ErrClaimsIncomplete)
	case claims.Subject == "":
		return fmt.Errorf("%w: subject is empty", ErrClaimsIncomplete)
	case claims.AppCode == "":
		return fmt.Errorf("%w: app code is empty", ErrClaimsIncomplete)
	case claims.Tenant() == "":
		return fmt.Errorf("%w: tenant is empty", ErrClaimsIncomplete)
	}
	return nil
}

func (v *Verifier) verifierFor(
	ctx context.Context,
	issuer string,
) (*oidc.IDTokenVerifier, error) {
	v.mu.Lock()
	cached, ok := v.verifiers[issuer]
	v.mu.Unlock()
	if ok {
		return cached, nil
	}
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("amp issuer discovery failed: %w", err)
	}
	verifier := provider.Verifier(&oidc.Config{SkipClientIDCheck: true})
	v.mu.Lock()
	if existing, ok := v.verifiers[issuer]; ok {
		verifier = existing
	} else {
		v.verifiers[issuer] = verifier
	}
	v.mu.Unlock()
	return verifier, nil
}
