package acp

// processEnvReceiver lets a transport read the agent subprocess environment
// (for example DO_AGENT_SETTINGS) before Handshake runs.
type processEnvReceiver interface {
	SetProcessEnv(env []string)
}
