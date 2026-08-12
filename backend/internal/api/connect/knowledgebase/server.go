package knowledgebaseconnect

import (
	"net/http"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	grantservice "github.com/l8ai-cn/agentcloud/backend/internal/service/grant"
	kbservice "github.com/l8ai-cn/agentcloud/backend/internal/service/knowledgebase"
)

const ServiceName = "proto.knowledgebase.v1.KnowledgeBaseService"

const (
	ListKnowledgeBasesProcedure   = "/" + ServiceName + "/ListKnowledgeBases"
	GetKnowledgeBaseProcedure     = "/" + ServiceName + "/GetKnowledgeBase"
	CreateKnowledgeBaseProcedure  = "/" + ServiceName + "/CreateKnowledgeBase"
	UpdateKnowledgeBaseProcedure  = "/" + ServiceName + "/UpdateKnowledgeBase"
	SyncKnowledgeBaseProcedure    = "/" + ServiceName + "/SyncKnowledgeBase"
	DeleteKnowledgeBaseProcedure  = "/" + ServiceName + "/DeleteKnowledgeBase"
	SetAgentMountsProcedure       = "/" + ServiceName + "/SetAgentMounts"
	ListAgentMountsProcedure      = "/" + ServiceName + "/ListAgentMounts"
	GetKnowledgeBaseFileProcedure = "/" + ServiceName + "/GetKnowledgeBaseFile"
	ListKnowledgeBaseDirProcedure = "/" + ServiceName + "/ListKnowledgeBaseDir"
)

type Server struct {
	svc        *kbservice.Service
	orgSvc     middleware.OrganizationService
	syncWorker *kbservice.SyncWorker
	grantSvc   *grantservice.Service
}

func NewServer(
	svc *kbservice.Service,
	orgSvc middleware.OrganizationService,
	syncWorker *kbservice.SyncWorker,
	grantSvc *grantservice.Service,
) *Server {
	return &Server{svc: svc, orgSvc: orgSvc, syncWorker: syncWorker, grantSvc: grantSvc}
}

func Mount(mux *http.ServeMux, srv *Server, opts ...connect.HandlerOption) {
	mux.Handle(ListKnowledgeBasesProcedure, connect.NewUnaryHandler(
		ListKnowledgeBasesProcedure, srv.ListKnowledgeBases, opts...,
	))
	mux.Handle(GetKnowledgeBaseProcedure, connect.NewUnaryHandler(
		GetKnowledgeBaseProcedure, srv.GetKnowledgeBase, opts...,
	))
	mux.Handle(CreateKnowledgeBaseProcedure, connect.NewUnaryHandler(
		CreateKnowledgeBaseProcedure, srv.CreateKnowledgeBase, opts...,
	))
	mux.Handle(UpdateKnowledgeBaseProcedure, connect.NewUnaryHandler(
		UpdateKnowledgeBaseProcedure, srv.UpdateKnowledgeBase, opts...,
	))
	mux.Handle(SyncKnowledgeBaseProcedure, connect.NewUnaryHandler(
		SyncKnowledgeBaseProcedure, srv.SyncKnowledgeBase, opts...,
	))
	mux.Handle(DeleteKnowledgeBaseProcedure, connect.NewUnaryHandler(
		DeleteKnowledgeBaseProcedure, srv.DeleteKnowledgeBase, opts...,
	))
	mux.Handle(SetAgentMountsProcedure, connect.NewUnaryHandler(
		SetAgentMountsProcedure, srv.SetAgentMounts, opts...,
	))
	mux.Handle(ListAgentMountsProcedure, connect.NewUnaryHandler(
		ListAgentMountsProcedure, srv.ListAgentMounts, opts...,
	))
	mux.Handle(GetKnowledgeBaseFileProcedure, connect.NewUnaryHandler(
		GetKnowledgeBaseFileProcedure, srv.GetKnowledgeBaseFile, opts...,
	))
	mux.Handle(ListKnowledgeBaseDirProcedure, connect.NewUnaryHandler(
		ListKnowledgeBaseDirProcedure, srv.ListKnowledgeBaseDir, opts...,
	))
}
