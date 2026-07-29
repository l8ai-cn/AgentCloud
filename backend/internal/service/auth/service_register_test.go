package auth

import (
	"context"
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/infra"
	userService "github.com/l8ai-cn/agentcloud/backend/internal/service/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterDisabled(t *testing.T) {
	db := setupTestDB(t)
	userSvc := userService.NewService(infra.NewUserRepository(db))
	ctx := context.Background()

	cfg := &Config{
		JWTExpiration:     time.Hour,
		RefreshExpiration: time.Hour * 24 * 7,
		Issuer:            "test-issuer",
	}
	configureTestAccessTokens(t, cfg)
	svc := NewService(cfg, userSvc)

	_, err := svc.Register(ctx, &RegisterRequest{
		Email:    "newuser@example.com",
		Username: "newuser",
		Password: "password123",
		Name:     "New User",
	})
	require.ErrorIs(t, err, ErrRegistrationDisabled)
	assert.ErrorIs(t, err, ErrRegistrationDisabled)
}
