package user

import (
	"context"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/infra"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newProvisioningService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db := testkit.SetupTestDB(t)
	return NewService(infra.NewUserRepository(db)), db
}

func ampIdentity(email string, verified bool) ExternalIdentity {
	return ExternalIdentity{
		Provider:       "sso_oidc_1",
		ProviderUserID: "principal:u-1",
		Username:       "amp-user",
		Email:          email,
		Name:           "AMP User",
		EmailVerified:  verified,
	}
}

func TestGetOrCreateByExternalIdentity_TrustedEmailLinksAndPromotes(t *testing.T) {
	svc, db := newProvisioningService(t)
	ctx := context.Background()

	localID := testkit.CreateUser(t, db, "shared@zhiyong.cn", "local")
	require.NoError(t, db.Exec("UPDATE users SET is_email_verified = 0 WHERE id = ?", localID).Error)

	u, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("shared@zhiyong.cn", true))
	require.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, localID, u.ID)
	assert.True(t, u.IsEmailVerified)

	stored, err := svc.GetByID(ctx, localID)
	require.NoError(t, err)
	assert.True(t, stored.IsEmailVerified, "promotion must be persisted, not only in-memory")
}

// Without a trusted assertion the address is not proof of ownership, so the
// login must land on a fresh account instead of hijacking the local one.
func TestGetOrCreateByExternalIdentity_UntrustedEmailDoesNotLink(t *testing.T) {
	svc, db := newProvisioningService(t)
	ctx := context.Background()

	localID := testkit.CreateUser(t, db, "shared@zhiyong.cn", "local")
	require.NoError(t, db.Exec("UPDATE users SET is_email_verified = 0 WHERE id = ?", localID).Error)

	u, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("shared@zhiyong.cn", false))
	require.NoError(t, err)
	assert.True(t, isNew)
	assert.NotEqual(t, localID, u.ID)
	assert.NotEqual(t, "shared@zhiyong.cn", u.Email)
	assert.False(t, u.IsEmailVerified)
}

func TestGetOrCreateByExternalIdentity_MissingEmailGetsPlaceholder(t *testing.T) {
	svc, _ := newProvisioningService(t)
	ctx := context.Background()

	u, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("", true))
	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Contains(t, u.Email, "noemail.agentcloud.placeholder")
	assert.False(t, u.IsEmailVerified)
	assert.NotEmpty(t, u.Username)
}

func TestGetOrCreateByExternalIdentity_TrustedEmailProvisionsVerified(t *testing.T) {
	svc, _ := newProvisioningService(t)
	ctx := context.Background()

	u, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("new@zhiyong.cn", true))
	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "new@zhiyong.cn", u.Email)
	assert.True(t, u.IsEmailVerified)
}

func TestGetOrCreateByExternalIdentity_SameSubjectReturnsSameUser(t *testing.T) {
	svc, _ := newProvisioningService(t)
	ctx := context.Background()

	first, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("repeat@zhiyong.cn", true))
	require.NoError(t, err)
	require.True(t, isNew)

	second, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("repeat@zhiyong.cn", true))
	require.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, first.ID, second.ID)
}

// The subject is the only stable key: a renamed email on the IdP side must
// still resolve to the account the subject was first bound to.
func TestGetOrCreateByExternalIdentity_SubjectWinsOverChangedEmail(t *testing.T) {
	svc, _ := newProvisioningService(t)
	ctx := context.Background()

	first, _, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("before@zhiyong.cn", true))
	require.NoError(t, err)

	second, isNew, err := svc.GetOrCreateByExternalIdentity(ctx, ampIdentity("after@zhiyong.cn", true))
	require.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, first.ID, second.ID)
}
