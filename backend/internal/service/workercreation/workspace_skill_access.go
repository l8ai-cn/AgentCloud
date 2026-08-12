package workercreation

import (
	"context"

	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
)

type SkillGrantReader = extensionservice.SkillGrantReader

func memberRoleForScope(
	ctx context.Context,
	reader MemberRoleReader,
	orgID, userID int64,
	role string,
) string {
	if role != "" {
		return role
	}
	if reader == nil {
		return ""
	}
	memberRole, err := reader.GetMemberRole(ctx, orgID, userID)
	if err != nil {
		return ""
	}
	return memberRole
}
