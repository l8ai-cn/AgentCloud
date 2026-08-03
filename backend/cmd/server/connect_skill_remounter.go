package main

import (
	v1 "github.com/l8ai-cn/agentcloud/backend/internal/api/rest/v1"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerskill"
)

// The remounter degrades to nil when the marketplace stack is absent, which keeps
// slim deployments (no skill catalog) from failing to boot.
func newSkillRemounter(svc *serviceContainer, rest *v1.Services) *workerskill.Remounter {
	if svc.pod == nil || svc.workerSpecs == nil || svc.skillCatalog == nil {
		return nil
	}
	var commands workerskill.CommandSender
	if rest.PodCoordinator != nil {
		if sender := rest.PodCoordinator.GetCommandSender(); sender != nil {
			commands = sender
		}
	}
	return workerskill.NewRemounter(
		svc.workerSpecs,
		svc.pod,
		svc.skillCatalog,
		svc.extension,
		commands,
	)
}
