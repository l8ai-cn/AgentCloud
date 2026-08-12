package entitlement

import (
	"fmt"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
)

type DeniedError struct {
	Kind   string
	Key    string
	Reason entitlementdom.DenyReason
}

func (e *DeniedError) Error() string {
	if e == nil {
		return "entitlement denied"
	}
	return fmt.Sprintf("entitlement denied: %s/%s: %s", e.Kind, e.Key, e.Reason)
}

func (e *DeniedError) DenyReason() entitlementdom.DenyReason {
	if e == nil {
		return ""
	}
	return e.Reason
}
