package extensionconnect

import (
	"context"
	"net/http"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	extdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	extensionv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/extension/v1"
)

const MyCapabilitiesServiceName = "proto.extension.v1.MyCapabilitiesService"

const (
	ListMyInstalledSkillsProcedure     = "/" + MyCapabilitiesServiceName + "/ListMyInstalledSkills"
	ListMyInstalledMcpServersProcedure = "/" + MyCapabilitiesServiceName + "/ListMyInstalledMcpServers"
)

type MyCapabilitiesServer struct{ *Server }

func NewMyCapabilitiesServer(srv *Server) *MyCapabilitiesServer {
	return &MyCapabilitiesServer{Server: srv}
}

func (s *MyCapabilitiesServer) ListMyInstalledSkills(
	ctx context.Context, req *connect.Request[extensionv1.ListMyInstalledSkillsRequest],
) (*connect.Response[extensionv1.ListMyInstalledSkillsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)

	rows, err := s.extensionSvc.ListMyInstalledSkills(ctx, tenant.OrganizationID, tenant.UserID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	items := make([]*extensionv1.MyInstalledSkill, 0, len(rows))
	for _, row := range rows {
		items = append(items, toProtoMyInstalledSkill(row))
	}
	return connect.NewResponse(&extensionv1.ListMyInstalledSkillsResponse{
		Items: items,
		Total: int64(len(items)),
	}), nil
}

func (s *MyCapabilitiesServer) ListMyInstalledMcpServers(
	ctx context.Context, req *connect.Request[extensionv1.ListMyInstalledMcpServersRequest],
) (*connect.Response[extensionv1.ListMyInstalledMcpServersResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)

	rows, err := s.extensionSvc.ListMyInstalledMcpServers(ctx, tenant.OrganizationID, tenant.UserID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	items := make([]*extensionv1.MyInstalledMcpServer, 0, len(rows))
	for _, row := range rows {
		items = append(items, toProtoMyInstalledMcpServer(row))
	}
	return connect.NewResponse(&extensionv1.ListMyInstalledMcpServersResponse{
		Items: items,
		Total: int64(len(items)),
	}), nil
}

func MountMyCapabilities(mux *http.ServeMux, srv *MyCapabilitiesServer, opts ...connect.HandlerOption) {
	mux.Handle(ListMyInstalledSkillsProcedure, connect.NewUnaryHandler(
		ListMyInstalledSkillsProcedure, srv.ListMyInstalledSkills, opts...,
	))
	mux.Handle(ListMyInstalledMcpServersProcedure, connect.NewUnaryHandler(
		ListMyInstalledMcpServersProcedure, srv.ListMyInstalledMcpServers, opts...,
	))
}

func toProtoMyInstalledSkill(row *extdom.UserInstalledSkill) *extensionv1.MyInstalledSkill {
	if row == nil || row.Install == nil {
		return nil
	}
	return &extensionv1.MyInstalledSkill{
		Skill:       toProtoInstalledSkill(row.Install),
		Repository:  toProtoInstallRepositoryRef(row.Install.RepositoryID, row.RepositoryName, row.RepositorySlug),
		DisplayName: row.DisplayName(),
	}
}

func toProtoMyInstalledMcpServer(row *extdom.UserInstalledMcpServer) *extensionv1.MyInstalledMcpServer {
	if row == nil || row.Install == nil {
		return nil
	}
	out := &extensionv1.MyInstalledMcpServer{
		Server:     toProtoInstalledMcpServer(row.Install),
		Repository: toProtoInstallRepositoryRef(row.Install.RepositoryID, row.RepositoryName, row.RepositorySlug),
	}
	if name := row.MarketItemName(); name != "" {
		out.MarketItemName = &name
	}
	if slug := row.MarketItemSlug(); slug != "" {
		out.MarketItemSlug = &slug
	}
	return out
}

func toProtoInstallRepositoryRef(id int64, name, slug string) *extensionv1.InstallRepositoryRef {
	return &extensionv1.InstallRepositoryRef{Id: id, Name: name, Slug: slug}
}
