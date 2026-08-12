package entitlement

type DenyReason string

const (
	DenyNotEntitled     DenyReason = "not_entitled"
	DenyPlatformRevoked DenyReason = "platform_revoked"
	DenyNotGranted      DenyReason = "not_granted"
	DenyExpired         DenyReason = "expired"
)

type Decision struct {
	Allowed bool
	Reason  DenyReason
}

func Allow() Decision {
	return Decision{Allowed: true}
}

func Deny(reason DenyReason) Decision {
	return Decision{Reason: reason}
}
