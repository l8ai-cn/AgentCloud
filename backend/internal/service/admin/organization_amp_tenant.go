package admin

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
)

// AMP asserts tenants as non-zero decimal ids; anything else would silently
// never match a business access token's tenant claim.
var ampTenantIDPattern = regexp.MustCompile(`^[1-9][0-9]*$`)

var ErrInvalidAmpTenantID = errors.New("amp tenant id must be a non-zero decimal string")

// BindOrganizationAmpTenant binds (or, with an empty tenant id, unbinds) the
// AMP tenant that federated logins and AMP bearer tokens resolve to this org.
func (s *Service) BindOrganizationAmpTenant(
	ctx context.Context,
	orgID int64,
	ampTenantID string,
) (*organization.Organization, error) {
	var org organization.Organization
	if err := s.db.First(&org, orgID); err != nil {
		return nil, ErrOrganizationNotFound
	}

	tenantID := strings.TrimSpace(ampTenantID)
	value := &tenantID
	if tenantID == "" {
		value = nil
	} else if !ampTenantIDPattern.MatchString(tenantID) {
		return nil, fmt.Errorf("%w: %q", ErrInvalidAmpTenantID, tenantID)
	}

	if err := s.db.Updates(&org, map[string]any{"amp_tenant_id": value}); err != nil {
		slog.ErrorContext(ctx, "admin: failed to bind org amp tenant",
			"org_id", orgID, "amp_tenant_id", tenantID, "error", err)
		return nil, err
	}
	org.AmpTenantID = value
	slog.InfoContext(ctx, "admin: org amp tenant bound",
		"org_id", orgID, "amp_tenant_id", tenantID)
	return &org, nil
}
