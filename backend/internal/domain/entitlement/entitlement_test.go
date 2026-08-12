package entitlement

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestEntitlementBeforeSaveValidatesResourceKey(t *testing.T) {
	invalid := &Entitlement{ResourceKey: "Codex.CLI"}
	require.Error(t, invalid.BeforeSave(&gorm.DB{}))

	valid := &Entitlement{ResourceKey: "codex-cli"}
	require.NoError(t, valid.BeforeSave(&gorm.DB{}))
}
