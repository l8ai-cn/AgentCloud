package entitlementconnect

import (
	"context"
	"errors"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

func connectCodeOf(t *testing.T, err error) connect.Code {
	t.Helper()
	var ce *connect.Error
	require.True(t, errors.As(err, &ce), "expected *connect.Error, got %v", err)
	return ce.Code()
}

func tenantCtx(role string) context.Context {
	return middleware.SetTenant(context.Background(), &middleware.TenantContext{
		OrganizationID: 7,
		UserID:         42,
		UserRole:       role,
	})
}

func TestListEntitlements_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.ListEntitlements(context.Background(),
		connect.NewRequest(&entitlementv1.ListEntitlementsRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestGrantMemberEntitlement_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.GrantMemberEntitlement(context.Background(),
		connect.NewRequest(&entitlementv1.GrantMemberEntitlementRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestDeleteMemberEntitlement_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.DeleteMemberEntitlement(context.Background(),
		connect.NewRequest(&entitlementv1.DeleteMemberEntitlementRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestRequireOrgAdmin(t *testing.T) {
	cases := []struct {
		role string
		want connect.Code
	}{
		{"owner", 0},
		{"admin", 0},
		{"member", connect.CodePermissionDenied},
		{"apikey", connect.CodePermissionDenied},
	}
	for _, tc := range cases {
		t.Run(tc.role, func(t *testing.T) {
			tenant, err := requireOrgAdmin(tenantCtx(tc.role))
			if tc.want == 0 {
				require.NoError(t, err)
				assert.Equal(t, int64(42), tenant.UserID)
				return
			}
			require.Error(t, err)
			assert.Equal(t, tc.want, connectCodeOf(t, err))
		})
	}
}

func TestRequireOrgAdmin_NoTenant_Unauthenticated(t *testing.T) {
	_, err := requireOrgAdmin(context.Background())
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestParseExpiry(t *testing.T) {
	empty, err := ParseExpiry("")
	require.NoError(t, err)
	assert.Nil(t, empty)

	parsed, err := ParseExpiry("2026-08-13T02:00:00Z")
	require.NoError(t, err)
	require.NotNil(t, parsed)
	assert.Equal(t, time.Date(2026, 8, 13, 2, 0, 0, 0, time.UTC), parsed.UTC())

	_, err = ParseExpiry("tomorrow")
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestToProtoEntitlement(t *testing.T) {
	assert.Nil(t, ToProtoEntitlement(nil))

	userID := int64(9)
	expires := time.Date(2026, 8, 13, 2, 0, 0, 0, time.UTC)
	out := ToProtoEntitlement(&entitlementdom.Entitlement{
		ID:             3,
		ResourceKind:   entitlementdom.KindWorkerType,
		ResourceKey:    "pi-agent",
		OrganizationID: 7,
		SubjectKind:    entitlementdom.SubjectUser,
		SubjectUserID:  &userID,
		Effect:         entitlementdom.EffectDeny,
		Reason:         "offboarded",
		ExpiresAt:      &expires,
	})
	assert.Equal(t, int64(3), out.GetId())
	assert.Equal(t, "pi-agent", out.GetResourceKey())
	assert.Equal(t, int64(9), out.GetSubjectUserId())
	assert.Equal(t, "deny", out.GetEffect())
	assert.Equal(t, "2026-08-13T02:00:00Z", out.GetExpiresAt())
}

func TestToProtoEntitlements_FiltersByKind(t *testing.T) {
	rows := []entitlementdom.Entitlement{
		{ID: 1, ResourceKind: entitlementdom.KindWorkerType, ResourceKey: "pi-agent"},
		{ID: 2, ResourceKind: entitlementdom.KindSkill, ResourceKey: "campus-daily-brief"},
	}
	assert.Len(t, ToProtoEntitlements(rows, ""), 2)

	filtered := ToProtoEntitlements(rows, entitlementdom.KindSkill)
	require.Len(t, filtered, 1)
	assert.Equal(t, int64(2), filtered[0].GetId())
}

func TestMapServiceError(t *testing.T) {
	cases := []struct {
		name string
		in   error
		want connect.Code
	}{
		{"not_found", entitlementsvc.ErrNotFound, connect.CodeNotFound},
		{"invalid", entitlementsvc.ErrInvalid, connect.CodeInvalidArgument},
		{"generic", errors.New("boom"), connect.CodeInternal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, connectCodeOf(t, MapServiceError(tc.in)))
		})
	}
}

func TestProcedureConstants(t *testing.T) {
	assert.Equal(t, "/proto.entitlement.v1.EntitlementService/ListEntitlements", ListEntitlementsProcedure)
	assert.Equal(t, "/proto.entitlement.v1.EntitlementService/GrantMemberEntitlement", GrantMemberEntitlementProcedure)
	assert.Equal(t, "/proto.entitlement.v1.EntitlementService/DenyMemberEntitlement", DenyMemberEntitlementProcedure)
	assert.Equal(t, "/proto.entitlement.v1.EntitlementService/DeleteMemberEntitlement", DeleteMemberEntitlementProcedure)
}
