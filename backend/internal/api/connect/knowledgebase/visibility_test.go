package knowledgebaseconnect

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/infra"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	grantsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/grant"
	kbservice "github.com/l8ai-cn/agentcloud/backend/internal/service/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
	kbv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/knowledgebase/v1"
)

type fakeOrg struct {
	id   int64
	slug string
}

func (f fakeOrg) GetID() int64    { return f.id }
func (f fakeOrg) GetSlug() string { return f.slug }
func (f fakeOrg) GetName() string { return f.slug }

type fakeOrgService struct{ role string }

func (f *fakeOrgService) GetBySlug(_ context.Context, slug string) (middleware.OrganizationGetter, error) {
	return fakeOrg{id: 1, slug: slug}, nil
}
func (f *fakeOrgService) IsMember(context.Context, int64, int64) (bool, error) { return true, nil }
func (f *fakeOrgService) GetMemberRole(context.Context, int64, int64) (string, error) {
	return f.role, nil
}

func ctxAs(userID int64) context.Context {
	return middleware.SetTenant(context.Background(), &middleware.TenantContext{UserID: userID})
}

func connectCodeOf(t *testing.T, err error) connect.Code {
	t.Helper()
	var ce *connect.Error
	require.True(t, errors.As(err, &ce), "expected *connect.Error, got %v", err)
	return ce.Code()
}

func seedKB(t *testing.T) (*Server, *kbdomain.KnowledgeBase, *kbdomain.KnowledgeBase) {
	t.Helper()
	db := testkit.SetupTestDB(t)
	repo := infra.NewKnowledgeBaseRepository(db)
	grantRepo := infra.NewGrantRepository(db)
	svc := kbservice.NewForRepository(repo)
	srv := NewServer(svc, &fakeOrgService{role: "member"}, nil, grantsvc.NewService(grantRepo))

	orgKB := &kbdomain.KnowledgeBase{
		OrganizationID: 1, Slug: "org-docs", Name: "Org",
		CreatedByUserID: 10, Visibility: kbdomain.VisibilityOrganization,
		SourceType: kbdomain.SourceTypeGit, SourceConfig: []byte("{}"),
	}
	privateKB := &kbdomain.KnowledgeBase{
		OrganizationID: 1, Slug: "secret-docs", Name: "Secret",
		CreatedByUserID: 10, Visibility: kbdomain.VisibilityPrivate,
		SourceType: kbdomain.SourceTypeGit, SourceConfig: []byte("{}"),
	}
	require.NoError(t, repo.Create(context.Background(), orgKB))
	require.NoError(t, repo.Create(context.Background(), privateKB))
	require.NoError(t, grantRepo.Create(context.Background(), &grant.ResourceGrant{
		OrganizationID: 1,
		ResourceType:   grant.TypeKnowledgeBase,
		ResourceID:     grant.IntResourceID(privateKB.ID),
		UserID:         20,
		GrantedBy:      10,
	}))
	return srv, orgKB, privateKB
}

func TestListKnowledgeBases_HidesPrivateFromOtherMember(t *testing.T) {
	srv, _, _ := seedKB(t)
	resp, err := srv.ListKnowledgeBases(ctxAs(99), connect.NewRequest(&kbv1.ListKnowledgeBasesRequest{OrgSlug: "acme"}))
	require.NoError(t, err)
	require.Len(t, resp.Msg.Items, 1)
	assert.Equal(t, "org-docs", resp.Msg.Items[0].Slug)
}

func TestGetKnowledgeBase_PrivateDeniedForOtherMember(t *testing.T) {
	srv, _, _ := seedKB(t)
	_, err := srv.GetKnowledgeBase(ctxAs(99), connect.NewRequest(&kbv1.GetKnowledgeBaseRequest{
		OrgSlug: "acme", Slug: "secret-docs",
	}))
	require.Error(t, err)
	assert.Equal(t, connect.CodePermissionDenied, connectCodeOf(t, err))
}

func TestGetKnowledgeBase_GrantedUserCanReadPrivate(t *testing.T) {
	srv, _, _ := seedKB(t)
	resp, err := srv.GetKnowledgeBase(ctxAs(20), connect.NewRequest(&kbv1.GetKnowledgeBaseRequest{
		OrgSlug: "acme", Slug: "secret-docs",
	}))
	require.NoError(t, err)
	assert.Equal(t, "secret-docs", resp.Msg.Slug)
}

func TestGetKnowledgeBase_OrganizationReadableByOrgMember(t *testing.T) {
	srv, _, _ := seedKB(t)
	resp, err := srv.GetKnowledgeBase(ctxAs(99), connect.NewRequest(&kbv1.GetKnowledgeBaseRequest{
		OrgSlug: "acme", Slug: "org-docs",
	}))
	require.NoError(t, err)
	assert.Equal(t, "org-docs", resp.Msg.Slug)
}

func TestUpdateKnowledgeBase_NonOwnerNonAdminDenied(t *testing.T) {
	srv, _, _ := seedKB(t)
	name := "hacked"
	_, err := srv.UpdateKnowledgeBase(ctxAs(99), connect.NewRequest(&kbv1.UpdateKnowledgeBaseRequest{
		OrgSlug: "acme", Slug: "secret-docs", Name: &name,
	}))
	require.Error(t, err)
	assert.Equal(t, connect.CodePermissionDenied, connectCodeOf(t, err))
}

func TestCreateKnowledgeBase_InvalidVisibility(t *testing.T) {
	srv, _, _ := seedKB(t)
	vis := "team"
	_, err := srv.CreateKnowledgeBase(ctxAs(10), connect.NewRequest(&kbv1.CreateKnowledgeBaseRequest{
		OrgSlug: "acme", Name: "Docs", Visibility: &vis,
	}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}
