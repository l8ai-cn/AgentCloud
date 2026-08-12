// Package grantconnect hosts Connect-RPC handlers for the grant
// service. Mirrors backend/internal/api/rest/v1/{pod,runner,repository}_grants.go
// but exposes the JSON-bodied RPCs via Connect (binary protobuf wire,
// conventions §2.5). REST stays mounted in parallel during the
// dual-track migration window.
//
// One service, three resource types — the REST split was policy-only
// (PodPolicy.AllowWrite, AllowAdmin + RunnerPolicy, AllowAdmin +
// RepositoryPolicy). The wire shape was already unified, so the
// Connect surface remains unified. Per-resource policy enforcement
// stays in the handler.
//
// Split rationale (CLAUDE.md 200-line rule):
//   - grant.go           — service scaffolding + Mount (this file)
//   - grant_handlers.go  — RPC methods
//   - grant_convert.go   — domain ↔ proto field translation
//   - grant_errors.go    — error mapping
package grantconnect

import (
	"context"
	"net/http"

	"connectrpc.com/connect"

	poddom "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	kbdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/runner"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	grantsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/grant"
)

const ServiceName = "proto.grant.v1.GrantService"

const (
	ListGrantsProcedure  = "/" + ServiceName + "/ListGrants"
	CreateGrantProcedure = "/" + ServiceName + "/CreateGrant"
	DeleteGrantProcedure = "/" + ServiceName + "/DeleteGrant"
)

// PodLookup is the slice of agentpod.Service the grant handler uses to
// resolve a pod from its key. ISP — we only need GetPod.
type PodLookup interface {
	GetPod(ctx context.Context, podKey string) (*poddom.Pod, error)
}

// RunnerLookup resolves a runner by ID.
type RunnerLookup interface {
	GetRunner(ctx context.Context, id int64) (*runner.Runner, error)
}

// RepositoryLookup resolves a repository by ID.
type RepositoryLookup interface {
	GetByID(ctx context.Context, id int64) (*gitprovider.Repository, error)
}

type KnowledgeBaseLookup interface {
	Get(ctx context.Context, orgID, id int64) (*kbdom.KnowledgeBase, error)
}

type ModelConnectionGrantAuthorizer interface {
	AuthorizeConnectionGrantManagement(ctx context.Context, userID, orgID, connectionID int64) error
}

type Server struct {
	grantSvc     *grantsvc.Service
	orgSvc       middleware.OrganizationService
	podSvc       PodLookup
	runnerSvc    RunnerLookup
	repoSvc      RepositoryLookup
	modelConnSvc ModelConnectionGrantAuthorizer
	kbSvc        KnowledgeBaseLookup
}

func NewServer(
	grantSvc *grantsvc.Service,
	orgSvc middleware.OrganizationService,
	podSvc PodLookup,
	runnerSvc RunnerLookup,
	repoSvc RepositoryLookup,
	modelConnSvc ModelConnectionGrantAuthorizer,
	kbSvc KnowledgeBaseLookup,
) *Server {
	return &Server{
		grantSvc:     grantSvc,
		orgSvc:       orgSvc,
		podSvc:       podSvc,
		runnerSvc:    runnerSvc,
		repoSvc:      repoSvc,
		modelConnSvc: modelConnSvc,
		kbSvc:        kbSvc,
	}
}

// Mount registers procedures behind the auth interceptor supplied via opts.
func Mount(mux *http.ServeMux, srv *Server, opts ...connect.HandlerOption) {
	mux.Handle(ListGrantsProcedure, connect.NewUnaryHandler(
		ListGrantsProcedure, srv.ListGrants, opts...,
	))
	mux.Handle(CreateGrantProcedure, connect.NewUnaryHandler(
		CreateGrantProcedure, srv.CreateGrant, opts...,
	))
	mux.Handle(DeleteGrantProcedure, connect.NewUnaryHandler(
		DeleteGrantProcedure, srv.DeleteGrant, opts...,
	))
}
