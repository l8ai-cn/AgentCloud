package main

import (
	"net/http"

	"connectrpc.com/connect"

	entitlementadminconnect "github.com/l8ai-cn/agentcloud/backend/internal/api/connect/admin/entitlement"
	entitlementconnect "github.com/l8ai-cn/agentcloud/backend/internal/api/connect/entitlement"
)

func mountEntitlementService(mux *http.ServeMux, svc *serviceContainer, opts []connect.HandlerOption) {
	if svc.entitlement == nil {
		return
	}
	entitlementconnect.Mount(mux, entitlementconnect.NewServer(svc.entitlement, svc.org), opts...)
}

// mountEntitlementAdminService needs svc.adminDB for the is_system_admin
// lookup, so it stays gated on the same admin-disabled switch as the rest of
// the platform-admin Connect surface.
func mountEntitlementAdminService(mux *http.ServeMux, svc *serviceContainer, opts []connect.HandlerOption) {
	if svc.entitlement == nil || svc.adminDB == nil {
		return
	}
	entitlementadminconnect.Mount(
		mux,
		entitlementadminconnect.NewServer(svc.entitlement, svc.adminDB),
		opts...,
	)
}
