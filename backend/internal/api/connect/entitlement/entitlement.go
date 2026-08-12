// Package entitlementconnect hosts Connect-RPC handlers for the
// organization side of Layer 1 (catalog admission).
//
// Auth model: every RPC resolves org scope from `org_slug` and then
// requires the owner/admin role. The platform-admin half lives in
// backend/internal/api/connect/admin/entitlement — separate package so a
// drift in one auth surface cannot leak into the other.
//
// Handlers only translate and authorize; the presence-is-allow-list
// semantics, upsert behaviour and audit trail stay in
// backend/internal/service/entitlement.
//
// Split rationale (CLAUDE.md 200-line rule):
//   - entitlement.go            — scaffolding + Mount (this file)
//   - entitlement_handlers.go   — RPC methods
//   - entitlement_authorize.go  — org-admin + already-admitted checks
//   - entitlement_conversion.go — domain ↔ proto translation (shared with
//     the admin package, which imports it to keep both wire shapes identical)
package entitlementconnect

import (
	"errors"
	"net/http"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
)

const ServiceName = "proto.entitlement.v1.EntitlementService"

const (
	ListEntitlementsProcedure        = "/" + ServiceName + "/ListEntitlements"
	GrantMemberEntitlementProcedure  = "/" + ServiceName + "/GrantMemberEntitlement"
	DenyMemberEntitlementProcedure   = "/" + ServiceName + "/DenyMemberEntitlement"
	DeleteMemberEntitlementProcedure = "/" + ServiceName + "/DeleteMemberEntitlement"
)

type Server struct {
	svc    *entitlementsvc.Service
	orgSvc middleware.OrganizationService
}

func NewServer(svc *entitlementsvc.Service, orgSvc middleware.OrganizationService) *Server {
	return &Server{svc: svc, orgSvc: orgSvc}
}

func Mount(mux *http.ServeMux, srv *Server, opts ...connect.HandlerOption) {
	mux.Handle(ListEntitlementsProcedure, connect.NewUnaryHandler(
		ListEntitlementsProcedure, srv.ListEntitlements, opts...,
	))
	mux.Handle(GrantMemberEntitlementProcedure, connect.NewUnaryHandler(
		GrantMemberEntitlementProcedure, srv.GrantMemberEntitlement, opts...,
	))
	mux.Handle(DenyMemberEntitlementProcedure, connect.NewUnaryHandler(
		DenyMemberEntitlementProcedure, srv.DenyMemberEntitlement, opts...,
	))
	mux.Handle(DeleteMemberEntitlementProcedure, connect.NewUnaryHandler(
		DeleteMemberEntitlementProcedure, srv.DeleteMemberEntitlement, opts...,
	))
}

// MapServiceError is exported so the platform-admin package maps the same
// service sentinels to the same Connect codes.
func MapServiceError(err error) error {
	switch {
	case errors.Is(err, entitlementsvc.ErrNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, entitlementsvc.ErrInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
