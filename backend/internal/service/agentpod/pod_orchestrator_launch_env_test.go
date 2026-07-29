package agentpod

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
)

func specDeclaring(names ...string) *specdomain.Spec {
	fields := make([]specdomain.LaunchEnvField, 0, len(names))
	for _, name := range names {
		fields = append(fields, specdomain.LaunchEnvField{Name: name})
	}
	return &specdomain.Spec{
		TypeConfig: specdomain.TypeConfig{LaunchEnv: fields},
	}
}

func TestApplyLaunchEnvWritesDeclaredNames(t *testing.T) {
	env := map[string]string{"EXISTING": "keep"}

	require.NoError(t, applyLaunchEnv(
		env,
		map[string]string{"ZHIYONG_PLATFORM_API_KEY": "teacher-token"},
		specDeclaring("ZHIYONG_PLATFORM_API_KEY"),
	))

	assert.Equal(t, map[string]string{
		"EXISTING":                 "keep",
		"ZHIYONG_PLATFORM_API_KEY": "teacher-token",
	}, env)
}

func TestApplyLaunchEnvRejectsUndeclaredNames(t *testing.T) {
	env := map[string]string{}

	err := applyLaunchEnv(
		env,
		map[string]string{
			"ZHIYONG_PLATFORM_API_KEY": "teacher-token",
			"AWS_SECRET_ACCESS_KEY":    "stolen",
		},
		specDeclaring("ZHIYONG_PLATFORM_API_KEY"),
	)

	require.ErrorIs(t, err, ErrLaunchEnvUndeclared)
	assert.Contains(t, err.Error(), "AWS_SECRET_ACCESS_KEY")
	assert.Empty(t, env, "a rejected batch must not partially apply")
}

func TestApplyLaunchEnvRejectsEverythingWhenSpecIsMissing(t *testing.T) {
	err := applyLaunchEnv(
		map[string]string{},
		map[string]string{"ZHIYONG_PLATFORM_API_KEY": "teacher-token"},
		nil,
	)

	require.ErrorIs(t, err, ErrLaunchEnvUndeclared)
}

func TestApplyLaunchEnvOverridesBundleValue(t *testing.T) {
	env := map[string]string{"ZHIYONG_COURSE_API_BASE_URL": "http://stale"}

	require.NoError(t, applyLaunchEnv(
		env,
		map[string]string{"ZHIYONG_COURSE_API_BASE_URL": "https://api.example.com"},
		specDeclaring("ZHIYONG_COURSE_API_BASE_URL"),
	))

	assert.Equal(t, "https://api.example.com", env["ZHIYONG_COURSE_API_BASE_URL"])
}

func TestApplyLaunchEnvIsNoopWhenCallerSuppliesNothing(t *testing.T) {
	env := map[string]string{"EXISTING": "keep"}

	require.NoError(t, applyLaunchEnv(env, nil, nil))

	assert.Equal(t, map[string]string{"EXISTING": "keep"}, env)
}
