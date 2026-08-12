package entitlementadminconnect

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

func connectCodeOf(t *testing.T, err error) connect.Code {
	t.Helper()
	var ce *connect.Error
	require.True(t, errors.As(err, &ce), "expected *connect.Error, got %v", err)
	return ce.Code()
}

// Every RPC must refuse an anonymous caller before it reads the request —
// these run with a nil DB, so reaching the lookup would panic instead.

func TestListOrganizationEntitlements_NoTenant_Unauthenticated(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.ListOrganizationEntitlements(context.Background(),
		connect.NewRequest(&entitlementv1.ListOrganizationEntitlementsRequest{OrganizationId: 7}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestListResourceEntitlements_NoTenant_Unauthenticated(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.ListResourceEntitlements(context.Background(),
		connect.NewRequest(&entitlementv1.ListResourceEntitlementsRequest{
			ResourceKind: entitlementdom.KindWorkerType,
			ResourceKey:  "pi-agent",
		}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestGrantEntitlement_NoTenant_Unauthenticated(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.GrantEntitlement(context.Background(),
		connect.NewRequest(&entitlementv1.GrantEntitlementRequest{OrganizationId: 7}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestDenyEntitlement_NoTenant_Unauthenticated(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.DenyEntitlement(context.Background(),
		connect.NewRequest(&entitlementv1.DenyEntitlementRequest{OrganizationId: 7}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestDeleteEntitlement_NoTenant_Unauthenticated(t *testing.T) {
	srv := NewServer(nil, nil)
	_, err := srv.DeleteEntitlement(context.Background(),
		connect.NewRequest(&entitlementv1.DeleteEntitlementRequest{Id: 1}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestSubjectOf(t *testing.T) {
	kind, userID := subjectOf(0)
	assert.Equal(t, entitlementdom.SubjectOrg, kind)
	assert.Nil(t, userID)

	kind, userID = subjectOf(11)
	assert.Equal(t, entitlementdom.SubjectUser, kind)
	require.NotNil(t, userID)
	assert.Equal(t, int64(11), *userID)
}

func TestProcedureConstants(t *testing.T) {
	const prefix = "/proto.entitlement.v1.EntitlementAdminService/"
	assert.Equal(t, prefix+"ListOrganizationEntitlements", ListOrganizationEntitlementsProcedure)
	assert.Equal(t, prefix+"ListResourceEntitlements", ListResourceEntitlementsProcedure)
	assert.Equal(t, prefix+"GrantEntitlement", GrantEntitlementProcedure)
	assert.Equal(t, prefix+"DenyEntitlement", DenyEntitlementProcedure)
	assert.Equal(t, prefix+"DeleteEntitlement", DeleteEntitlementProcedure)
}
