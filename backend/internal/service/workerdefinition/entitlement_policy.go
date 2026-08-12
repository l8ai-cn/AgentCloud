package workerdefinition

import (
	"encoding/json"
	"fmt"
)

type EntitlementPolicy struct {
	Default string
	Note    string
}

func decodeEntitlement(raw json.RawMessage) (EntitlementPolicy, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return EntitlementPolicy{}, nil
	}
	var document struct {
		Default string `json:"default"`
		Note    string `json:"note"`
	}
	if err := decodeStrict(raw, &document); err != nil {
		return EntitlementPolicy{}, fmt.Errorf("entitlement: %w", err)
	}
	switch document.Default {
	case "", "open", "closed":
		return EntitlementPolicy{Default: document.Default, Note: document.Note}, nil
	default:
		return EntitlementPolicy{}, fmt.Errorf("entitlement default must be open or closed")
	}
}
