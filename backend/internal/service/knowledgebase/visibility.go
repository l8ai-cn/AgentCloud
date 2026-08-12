package knowledgebase

import (
	"fmt"

	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
)

func normalizeVisibility(v string) (string, error) {
	if v == "" {
		return kbdomain.VisibilityOrganization, nil
	}
	if !kbdomain.ValidVisibility(v) {
		return "", fmt.Errorf("%w: visibility must be organization or private", ErrInvalidInput)
	}
	return v, nil
}
