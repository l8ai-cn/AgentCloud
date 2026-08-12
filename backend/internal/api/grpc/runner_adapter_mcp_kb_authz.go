package grpc

import (
	"context"
	"errors"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

var errKBAccessDenied = errors.New("knowledgebase: access denied")

func (a *GRPCRunnerAdapter) kbSubject(tc *middleware.TenantContext) policy.Subject {
	return policy.NewSubject(tc.OrganizationID, tc.UserID, tc.UserRole)
}

func (a *GRPCRunnerAdapter) kbResource(ctx context.Context, kb *kbdomain.KnowledgeBase) policy.ResourceContext {
	ownerID := kb.CreatedByUserID
	rc := policy.VisibleResource(kb.OrganizationID, &ownerID, kb.Visibility)
	if a.grantService == nil {
		return rc
	}
	ids, err := a.grantService.GetGrantedUserIDs(
		ctx, grant.TypeKnowledgeBase, grant.IntResourceID(kb.ID),
	)
	if err == nil && len(ids) > 0 {
		return rc.WithGrants(ids)
	}
	return rc
}

func (a *GRPCRunnerAdapter) authorizeKBRead(ctx context.Context, tc *middleware.TenantContext, kb *kbdomain.KnowledgeBase) *mcpError {
	if tc.UserID == 0 && kb.Visibility == kbdomain.VisibilityPrivate {
		return newMcpError(403, errKBAccessDenied.Error())
	}
	if !policy.KnowledgeBasePolicy.AllowRead(a.kbSubject(tc), a.kbResource(ctx, kb)) {
		return newMcpError(403, errKBAccessDenied.Error())
	}
	return nil
}

func (a *GRPCRunnerAdapter) authorizeKBWrite(ctx context.Context, tc *middleware.TenantContext, kb *kbdomain.KnowledgeBase) *mcpError {
	if tc.UserID == 0 {
		return newMcpError(403, errKBAccessDenied.Error())
	}
	if !policy.KnowledgeBasePolicy.AllowWrite(a.kbSubject(tc), a.kbResource(ctx, kb)) {
		return newMcpError(403, errKBAccessDenied.Error())
	}
	return nil
}
