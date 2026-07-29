package sso

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Both JSONB columns are NOT NULL, so "no value" is written as an empty
// document rather than SQL NULL.
const (
	emptyJSONArray  = "[]"
	emptyJSONObject = "{}"
)

// The whitelist decides which AMP applications may assert identities into this
// deployment, so a malformed value must be rejected at write time — a config
// that fails to parse later would silently delegate nothing and look like an
// authentication bug instead of a configuration error.
func validateAMPBearerAppCodes(raw string) error {
	var appCodes []string
	if err := json.Unmarshal([]byte(raw), &appCodes); err != nil {
		return fmt.Errorf("amp_bearer_app_codes must be a JSON array of app codes: %w", err)
	}
	for _, appCode := range appCodes {
		if strings.TrimSpace(appCode) == "" {
			return fmt.Errorf("amp_bearer_app_codes must not contain empty app codes")
		}
	}
	return nil
}
