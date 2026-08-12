package workercreation

import entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"

func (service *Service) Entitlements() *entitlementsvc.Service {
	if service == nil {
		return nil
	}
	return service.entitlements
}

func (service *Service) SetEntitlements(gate *entitlementsvc.Service) {
	if service == nil {
		return
	}
	service.entitlements = gate
	if resolver, ok := service.workerTypes.(*workerTypeResolver); ok {
		resolver.setEntitlements(gate)
	}
}
