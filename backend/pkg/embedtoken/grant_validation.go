package embedtoken

import "net/url"

// Capabilities and parent origins travel inside the signed token, so every
// surface that mints a context (session API, external API) must agree on the
// same vocabulary — otherwise a token issued by one surface would be
// unreadable or over-privileged on another.

type GrantError string

func (e GrantError) Error() string {
	return string(e)
}

func ValidateOrigins(values []string) ([]string, error) {
	if len(values) == 0 {
		return nil, GrantError("parent_origins is required")
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		origin, err := exactOrigin(value)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[origin]; exists {
			return nil, GrantError("parent_origins contains duplicates")
		}
		seen[origin] = struct{}{}
		result = append(result, origin)
	}
	return result, nil
}

func exactOrigin(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" ||
		parsed.User != nil ||
		(parsed.Scheme != "https" && parsed.Scheme != "http") ||
		parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", GrantError(
			"parent_origins must contain exact http or https origins",
		)
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func ValidateCapabilities(values []string) ([]string, error) {
	if len(values) == 0 {
		return nil, GrantError("capabilities is required")
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if !SupportedCapability(value) {
			return nil, GrantError("capabilities contains an unsupported value")
		}
		if _, exists := seen[value]; exists {
			return nil, GrantError("capabilities contains duplicates")
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if _, ok := seen[CapabilityRead]; !ok {
		return nil, GrantError("read capability is required")
	}
	return result, nil
}

const (
	CapabilityRead     = "read"
	CapabilityWrite    = "write"
	CapabilityApprove  = "approve"
	CapabilityTerminal = "terminal"
	CapabilityControl  = "control"
)

func SupportedCapability(value string) bool {
	switch value {
	case CapabilityRead, CapabilityWrite, CapabilityApprove,
		CapabilityTerminal, CapabilityControl:
		return true
	default:
		return false
	}
}
