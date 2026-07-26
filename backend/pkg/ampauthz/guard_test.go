package ampauthz

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMustCatalogReady(t *testing.T) {
	require.NoError(t, MustCatalogReady())
}
