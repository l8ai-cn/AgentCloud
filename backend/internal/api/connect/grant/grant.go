// Package grantconnect hosts Connect-RPC handlers for the grant
// service. Mirrors backend/internal/api/rest/v1/{pod,runner,repository}_grants.go
// but exposes the JSON-bodied RPCs via Connect (binary protobuf wire,
// conventions §2.5). REST stays mounted in parallel during the
// dual-track migration window.
//
// One service, many resource types — the REST split was policy-only
// (PodPolicy.AllowWrite, AllowAdmin + RunnerPolicy, AllowAdmin +
// RepositoryPolicy). The wire shape was already unified, so the
// Connect surface remains unified. Per-resource policy enforcement
// stays in the handler.
//
// This is Layer 2 of the two-layer authorization model — organization-owned
// instances only. Platform-owned resources (worker types, platform skills)
// are Layer 1 and belong to the entitlement services instead.
//
// Split rationale (CLAUDE.md 200-line rule):
//   - grant.go                        — service scaffolding + Mount (this file)
//   - grant_handlers.go               — RPC methods
//   - grant_authorize.go              — resource-type dispatch + pod/runner/repo/model checks
//   - grant_authorize_<resource>.go   — one file per resource whose check needs its own domain
//   - grant_convert.go                — domain ↔ proto field translation
//   - grant_errors.go                 — error mapping
package grantconnect

import (
	"context"
	"net/http"

	"connectrpc.com/connect"

	poddom "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	expertdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/expert"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	kbdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/runner"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
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

// SkillLookup resolves an organization-owned skill. Org-scoped by design —
// platform skills (NULL organization_id) belong to Layer 1 entitlements.
type SkillLookup interface {
	GetByID(ctx context.Context, orgID, id int64) (*skilldom.Skill, error)
}

type ExpertLookup interface {
	GetByID(ctx context.Context, orgID, id int64) (*expertdom.Expert, error)
}

type Server struct {
	grantSvc     *grantsvc.Service
	orgSvc       middleware.OrganizationService
	podSvc       PodLookup
	runnerSvc    RunnerLookup
	repoSvc      RepositoryLookup
	modelConnSvc ModelConnectionGrantAuthorizer
	kbSvc        KnowledgeBaseLookup
	skillSvc     SkillLookup
	expertSvc    ExpertLookup
}

// Option carries the resource lookups wired after the marketplace services
// exist — those are built later in bootstrap than the core pod/runner/repo
// trio, so they cannot be positional constructor arguments.
type Option func(*Server)

func WithSkillLookup(skillSvc SkillLookup) Option {
	return func(s *Server) { s.skillSvc = skillSvc }
}

func WithExpertLookup(expertSvc ExpertLookup) Option {
	return func(s *Server) { s.expertSvc = expertSvc }
}

func NewServer(
	grantSvc *grantsvc.Service,
	orgSvc middleware.OrganizationService,
	podSvc PodLookup,
	runnerSvc RunnerLookup,
	repoSvc RepositoryLookup,
	modelConnSvc ModelConnectionGrantAuthorizer,
	kbSvc KnowledgeBaseLookup,
	opts ...Option,
) *Server {
	srv := &Server{
		grantSvc:     grantSvc,
		orgSvc:       orgSvc,
		podSvc:       podSvc,
		runnerSvc:    runnerSvc,
		repoSvc:      repoSvc,
		modelConnSvc: modelConnSvc,
		kbSvc:        kbSvc,
	}
	for _, opt := range opts {
		opt(srv)
	}
	return srv
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
