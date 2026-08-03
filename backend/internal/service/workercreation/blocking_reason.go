package workercreation

// Cross-module contract: front-ends localize these codes. Draft-validation text
// that has no code is passed through verbatim and rendered as-is.
type BlockingReason string

const (
	BlockingRuntimeImageMissing     BlockingReason = "runtime-image-missing"
	BlockingRuntimeImageDisabled    BlockingReason = "runtime-image-disabled"
	BlockingNoOnlineRunner          BlockingReason = "no-online-runner"
	BlockingComputeTargetDisabled   BlockingReason = "compute-target-disabled"
	BlockingNoTargetForMode         BlockingReason = "no-target-for-deployment-mode"
	BlockingSelectedTargetMissing   BlockingReason = "selected-target-unavailable"
	BlockingTargetModeUnsupported   BlockingReason = "selected-target-mode-unsupported"
	BlockingResourceProfileDisabled BlockingReason = "resource-profile-disabled"
)
