package entitlementconnect

import (
	"errors"
	"time"

	"connectrpc.com/connect"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/pkg/protoconv"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

func ToProtoEntitlement(row *entitlementdom.Entitlement) *entitlementv1.Entitlement {
	if row == nil {
		return nil
	}
	return &entitlementv1.Entitlement{
		Id:             row.ID,
		ResourceKind:   row.ResourceKind,
		ResourceKey:    row.ResourceKey,
		OrganizationId: row.OrganizationID,
		SubjectKind:    row.SubjectKind,
		SubjectUserId:  protoconv.Int64Ptr(row.SubjectUserID),
		Effect:         row.Effect,
		Reason:         row.Reason,
		ExpiresAt:      protoconv.RFC3339Ptr(row.ExpiresAt),
		GrantedBy:      row.GrantedBy,
		CreatedAt:      protoconv.RFC3339(row.CreatedAt),
		UpdatedAt:      protoconv.RFC3339(row.UpdatedAt),
	}
}

func ToProtoEntitlements(rows []entitlementdom.Entitlement, kindFilter string) []*entitlementv1.Entitlement {
	items := make([]*entitlementv1.Entitlement, 0, len(rows))
	for i := range rows {
		if kindFilter != "" && rows[i].ResourceKind != kindFilter {
			continue
		}
		items = append(items, ToProtoEntitlement(&rows[i]))
	}
	return items
}

// ParseExpiry rejects unparseable timestamps instead of falling back to the
// zero time — protoconv.ParseRFC3339Ptr swallows the error, which would turn
// a typo into an entitlement that is already expired on creation.
func ParseExpiry(raw string) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("expires_at must be an RFC3339 timestamp"))
	}
	return &parsed, nil
}
