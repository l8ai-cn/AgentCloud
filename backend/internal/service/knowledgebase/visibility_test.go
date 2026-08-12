package knowledgebase

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
)

func TestNormalizeVisibility(t *testing.T) {
	v, err := normalizeVisibility("")
	require.NoError(t, err)
	assert.Equal(t, kbdomain.VisibilityOrganization, v)

	v, err = normalizeVisibility(kbdomain.VisibilityPrivate)
	require.NoError(t, err)
	assert.Equal(t, kbdomain.VisibilityPrivate, v)

	_, err = normalizeVisibility("public")
	require.ErrorIs(t, err, ErrInvalidInput)

	_, err = normalizeVisibility("org")
	require.ErrorIs(t, err, ErrInvalidInput)
}

func TestCreate_RejectsInvalidVisibility(t *testing.T) {
	svc := &Service{}
	_, err := svc.Create(context.Background(), &CreateParams{
		OrganizationID: 1, CreatedByUserID: 10, Name: "Docs", Visibility: "team",
	})
	require.ErrorIs(t, err, ErrInvalidInput)
}
