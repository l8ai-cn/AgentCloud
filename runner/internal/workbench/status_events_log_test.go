package workbench

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMapperLogOmitsStderrBootstrapNoise(t *testing.T) {
	mapper := NewMapper("pod-1", "do-agent")

	require.Nil(t, mapper.Log(
		"stderr",
		"[do-agent acp] tools registered: Bash, Read, WebSearch",
	))
	require.Nil(t, mapper.Log(
		"stderr",
		"[Restore] Successfully restored session: session_id=abc",
	))
	require.Nil(t, mapper.Log("info", "session warming"))
	require.Nil(t, mapper.Log("debug", "trace line"))
}

func TestMapperLogKeepsWarnAndError(t *testing.T) {
	mapper := NewMapper("pod-1", "do-agent")

	warn := mapper.Log("warn", "retrying provider")
	require.NotNil(t, warn)
	require.Len(t, warn.GetMutations(), 1)
	require.NotNil(t, warn.GetMutations()[0].GetTimeline())

	errBatch := mapper.Log("error", "provider rejected credentials")
	require.NotNil(t, errBatch)
	require.Len(t, errBatch.GetMutations(), 1)
	require.NotNil(t, errBatch.GetMutations()[0].GetTimeline())
}
