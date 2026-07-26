package imbridge

import "time"

// IdentityBindingView is what org admins are allowed to see. It deliberately
// drops pairing_code: a pending code is the claim secret for an IM identity, so
// exposing it would let an admin bind someone else's IM account to themselves.
type IdentityBindingView struct {
	ID               int64      `json:"id"`
	ConnectionID     int64      `json:"connection_id"`
	ExternalUserID   string     `json:"external_user_id"`
	ExternalName     *string    `json:"external_name,omitempty"`
	UserID           *int64     `json:"user_id,omitempty"`
	UserName         *string    `json:"user_name,omitempty"`
	UserEmail        *string    `json:"user_email,omitempty"`
	Status           string     `json:"status"`
	PairingExpiresAt *time.Time `json:"pairing_expires_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
