package adminconnect

import (
	"context"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/admin"
	adminv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/admin/v1"
)

func (s *Server) BindOrganizationAmpTenant(
	ctx context.Context, req *connect.Request[adminv1.BindOrganizationAmpTenantRequest],
) (*connect.Response[adminv1.AdminOrganization], error) {
	ctx, adminUser, err := interceptors.ResolveSystemAdmin(ctx, s.db)
	if err != nil {
		return nil, err
	}

	orgID := req.Msg.GetOrgId()
	oldOrg, _ := s.svc.GetOrganization(ctx, orgID)

	org, err := s.svc.BindOrganizationAmpTenant(ctx, orgID, req.Msg.GetAmpTenantId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	logAdminAction(ctx, s.svc, adminUser.ID,
		admin.AuditActionOrgUpdate, admin.TargetTypeOrganization, orgID,
		oldOrg, org, req.Peer().Addr, req.Header().Get("User-Agent"))

	return connect.NewResponse(ToProtoAdminOrganization(org)), nil
}
