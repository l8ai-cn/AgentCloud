// Package entitlementadminconnect hosts Connect-RPC handlers for the
// platform side of Layer 1 (catalog admission): which organizations may use
// which worker types and platform-level skills.
//
// Auth model: every RPC calls interceptors.ResolveSystemAdmin, mirroring
// REST's AdminMiddleware (is_system_admin + is_active). The org-scoped
// sibling lives in backend/internal/api/connect/entitlement and authorizes
// through ResolveOrgScope + org admin role; the packages stay split so the
// two auth surfaces cannot share — and therefore cannot drift through —
// transport plumbing.
//
// Wire translation is imported from the org-scoped package so both surfaces
// emit byte-identical Entitlement messages.
//
// Split rationale (CLAUDE.md 200-line rule):
//   - entitlement_admin.go — scaffolding + Mount (this file)
//   - handlers_query.go    — ListOrganizationEntitlements / ListResourceEntitlements
//   - handlers_write.go    — GrantEntitlement / DenyEntitlement / DeleteEntitlement
package entitlementadminconnect

import (
	"net/http"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/infra/database"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
)

const ServiceName = "proto.entitlement.v1.EntitlementAdminService"

const (
	ListOrganizationEntitlementsProcedure = "/" + ServiceName + "/ListOrganizationEntitlements"
	ListResourceEntitlementsProcedure     = "/" + ServiceName + "/ListResourceEntitlements"
	GrantEntitlementProcedure             = "/" + ServiceName + "/GrantEntitlement"
	DenyEntitlementProcedure              = "/" + ServiceName + "/DenyEntitlement"
	DeleteEntitlementProcedure            = "/" + ServiceName + "/DeleteEntitlement"
)

type Server struct {
	svc *entitlementsvc.Service
	db  database.DB
}

func NewServer(svc *entitlementsvc.Service, db database.DB) *Server {
	return &Server{svc: svc, db: db}
}

func Mount(mux *http.ServeMux, srv *Server, opts ...connect.HandlerOption) {
	mux.Handle(ListOrganizationEntitlementsProcedure, connect.NewUnaryHandler(
		ListOrganizationEntitlementsProcedure, srv.ListOrganizationEntitlements, opts...,
	))
	mux.Handle(ListResourceEntitlementsProcedure, connect.NewUnaryHandler(
		ListResourceEntitlementsProcedure, srv.ListResourceEntitlements, opts...,
	))
	mux.Handle(GrantEntitlementProcedure, connect.NewUnaryHandler(
		GrantEntitlementProcedure, srv.GrantEntitlement, opts...,
	))
	mux.Handle(DenyEntitlementProcedure, connect.NewUnaryHandler(
		DenyEntitlementProcedure, srv.DenyEntitlement, opts...,
	))
	mux.Handle(DeleteEntitlementProcedure, connect.NewUnaryHandler(
		DeleteEntitlementProcedure, srv.DeleteEntitlement, opts...,
	))
}
