package infra

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
)

func TestKnowledgeBaseList_VisibilityAndGrants(t *testing.T) {
	db := testkit.SetupTestDB(t)
	repo := NewKnowledgeBaseRepository(db)
	ctx := context.Background()

	orgKB := &knowledgebase.KnowledgeBase{
		OrganizationID: 1, Slug: "org-docs", Name: "Org Docs",
		CreatedByUserID: 10, Visibility: knowledgebase.VisibilityOrganization,
		SourceType: knowledgebase.SourceTypeGit, SourceConfig: []byte("{}"),
	}
	privateKB := &knowledgebase.KnowledgeBase{
		OrganizationID: 1, Slug: "secret-docs", Name: "Secret",
		CreatedByUserID: 10, Visibility: knowledgebase.VisibilityPrivate,
		SourceType: knowledgebase.SourceTypeGit, SourceConfig: []byte("{}"),
	}
	require.NoError(t, repo.Create(ctx, orgKB))
	require.NoError(t, repo.Create(ctx, privateKB))

	grantRepo := NewGrantRepository(db)
	require.NoError(t, grantRepo.Create(ctx, &grant.ResourceGrant{
		OrganizationID: 1,
		ResourceType:   grant.TypeKnowledgeBase,
		ResourceID:     grant.IntResourceID(privateKB.ID),
		UserID:         20,
		GrantedBy:      10,
	}))

	t.Run("owner sees private and organization", func(t *testing.T) {
		kbs, err := repo.List(ctx, &knowledgebase.ListFilter{OrganizationID: 1, VisibilityUserID: 10})
		require.NoError(t, err)
		assert.Len(t, kbs, 2)
	})
	t.Run("other member sees only organization", func(t *testing.T) {
		kbs, err := repo.List(ctx, &knowledgebase.ListFilter{OrganizationID: 1, VisibilityUserID: 99})
		require.NoError(t, err)
		require.Len(t, kbs, 1)
		assert.Equal(t, "org-docs", kbs[0].Slug)
	})
	t.Run("granted user sees private", func(t *testing.T) {
		kbs, err := repo.List(ctx, &knowledgebase.ListFilter{OrganizationID: 1, VisibilityUserID: 20})
		require.NoError(t, err)
		assert.Len(t, kbs, 2)
	})
}
