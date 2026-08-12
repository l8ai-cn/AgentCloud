package grantconnect

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	expertdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/expert"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	grantsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/grant"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
	grantv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/grant/v1"
)

func connectCodeOf(t *testing.T, err error) connect.Code {
	t.Helper()
	var ce *connect.Error
	require.True(t, errors.As(err, &ce), "expected *connect.Error, got %v", err)
	return ce.Code()
}

// --- Validation guards (org_slug missing) ---

func TestListGrants_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil, nil, nil, nil, nil, nil)
	_, err := srv.ListGrants(context.Background(),
		connect.NewRequest(&grantv1.ListGrantsRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestCreateGrant_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil, nil, nil, nil, nil, nil)
	_, err := srv.CreateGrant(context.Background(),
		connect.NewRequest(&grantv1.CreateGrantRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestDeleteGrant_NoOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewServer(nil, nil, nil, nil, nil, nil, nil)
	_, err := srv.DeleteGrant(context.Background(),
		connect.NewRequest(&grantv1.DeleteGrantRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

// --- mapGrantError table ---

func TestMapGrantError(t *testing.T) {
	cases := []struct {
		name string
		in   error
		want connect.Code
	}{
		{"self_grant", grantsvc.ErrSelfGrant, connect.CodeInvalidArgument},
		{"invalid_type", grantsvc.ErrInvalidType, connect.CodeInvalidArgument},
		{"grant_not_found", grantsvc.ErrGrantNotFound, connect.CodeNotFound},
		{"generic", errors.New("boom"), connect.CodeInternal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, connectCodeOf(t, mapGrantError(tc.in)))
		})
	}
}

// --- isValidResourceType ---

func TestIsValidResourceType(t *testing.T) {
	assert.True(t, isValidResourceType("pod"))
	assert.True(t, isValidResourceType("runner"))
	assert.True(t, isValidResourceType("repository"))
	assert.False(t, isValidResourceType(""))
	assert.False(t, isValidResourceType("file"))
	assert.False(t, isValidResourceType("POD"))
	assert.True(t, isValidResourceType("model_connection"))
	assert.True(t, isValidResourceType("knowledge_base"))
	assert.True(t, isValidResourceType("skill"))
	assert.True(t, isValidResourceType("expert"))
}

// --- skill / expert authorizers ---

type stubSkills struct {
	row *skilldom.Skill
	err error
}

func (s stubSkills) GetByID(context.Context, int64, int64) (*skilldom.Skill, error) {
	return s.row, s.err
}

type stubExperts struct {
	row *expertdom.Expert
	err error
}

func (s stubExperts) GetByID(context.Context, int64, int64) (*expertdom.Expert, error) {
	return s.row, s.err
}

func TestAuthorizeSkillAccess(t *testing.T) {
	orgID := int64(7)
	creator := int64(42)
	orgSkill := &skilldom.Skill{ID: 1, OrganizationID: &orgID, CreatedByID: &creator}

	cases := []struct {
		name  string
		srv   *Server
		sub   policy.Subject
		resID string
		want  connect.Code
	}{
		{"no_lookup", NewServer(nil, nil, nil, nil, nil, nil, nil), policy.NewSubject(orgID, 42, "admin"), "1", connect.CodeNotFound},
		{
			"bad_id",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithSkillLookup(stubSkills{row: orgSkill})),
			policy.NewSubject(orgID, 42, "admin"), "abc", connect.CodeInvalidArgument,
		},
		{
			"platform_skill_is_layer_one",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithSkillLookup(stubSkills{row: &skilldom.Skill{ID: 1}})),
			policy.NewSubject(orgID, 42, "admin"), "1", connect.CodeNotFound,
		},
		{
			"member_not_creator",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithSkillLookup(stubSkills{row: orgSkill})),
			policy.NewSubject(orgID, 99, "member"), "1", connect.CodePermissionDenied,
		},
		{
			"creator",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithSkillLookup(stubSkills{row: orgSkill})),
			policy.NewSubject(orgID, 42, "member"), "1", 0,
		},
		{
			"org_admin",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithSkillLookup(stubSkills{row: orgSkill})),
			policy.NewSubject(orgID, 99, "admin"), "1", 0,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.srv.authorizeSkillAccess(context.Background(), tc.sub, orgID, tc.resID)
			if tc.want == 0 {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Equal(t, tc.want, connectCodeOf(t, err))
		})
	}
}

func TestAuthorizeExpertAccess(t *testing.T) {
	orgID := int64(7)
	row := &expertdom.Expert{ID: 1, OrganizationID: orgID, CreatedByID: 42}

	cases := []struct {
		name string
		srv  *Server
		sub  policy.Subject
		want connect.Code
	}{
		{"no_lookup", NewServer(nil, nil, nil, nil, nil, nil, nil), policy.NewSubject(orgID, 42, "admin"), connect.CodeNotFound},
		{
			"lookup_error",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithExpertLookup(stubExperts{err: errors.New("nope")})),
			policy.NewSubject(orgID, 42, "admin"), connect.CodeNotFound,
		},
		{
			"member_not_creator",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithExpertLookup(stubExperts{row: row})),
			policy.NewSubject(orgID, 99, "member"), connect.CodePermissionDenied,
		},
		{
			"creator",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithExpertLookup(stubExperts{row: row})),
			policy.NewSubject(orgID, 42, "member"), 0,
		},
		{
			"org_admin",
			NewServer(nil, nil, nil, nil, nil, nil, nil, WithExpertLookup(stubExperts{row: row})),
			policy.NewSubject(orgID, 99, "owner"), 0,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.srv.authorizeExpertAccess(context.Background(), tc.sub, orgID, "1")
			if tc.want == 0 {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Equal(t, tc.want, connectCodeOf(t, err))
		})
	}
}

// --- procedure constant identity (conventions §12) ---

func TestProcedureConstants(t *testing.T) {
	assert.Equal(t, "/proto.grant.v1.GrantService/ListGrants", ListGrantsProcedure)
	assert.Equal(t, "/proto.grant.v1.GrantService/CreateGrant", CreateGrantProcedure)
	assert.Equal(t, "/proto.grant.v1.GrantService/DeleteGrant", DeleteGrantProcedure)
}
