package runner

const errCodeACPPromptFailed = "ACP_PROMPT_FAILED"
const errCodeACPSessionLost = "ACP_SESSION_LOST"
const errCodeACPTurnStalled = "ACP_TURN_STALLED"

func isTerminalRuntimeError(code string) bool {
	return code == errCodeACPPromptFailed || code == errCodeACPTurnStalled
}
