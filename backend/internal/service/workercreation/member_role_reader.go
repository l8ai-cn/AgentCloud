package workercreation

import "context"

type MemberRoleReader interface {
	GetMemberRole(context.Context, int64, int64) (string, error)
}
