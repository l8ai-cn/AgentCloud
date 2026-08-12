package main

import (
	"github.com/l8ai-cn/agentcloud/backend/internal/infra"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	"gorm.io/gorm"
)

type gormOrgAuditor struct {
	db *gorm.DB
}

func (a gormOrgAuditor) LogAction(action middleware.AuditAction, opts *middleware.LogActionOptions) error {
	return middleware.LogAction(a.db, action, opts)
}

func wireEntitlements(services *serviceContainer, db *gorm.DB) {
	services.entitlement = entitlementsvc.NewService(entitlementsvc.Deps{
		Repo:          infra.NewEntitlementRepository(db),
		WorkerTypes:   services.workerDefinitions,
		PlatformAudit: services.admin,
		OrgAudit:      gormOrgAuditor{db: db},
	})
	if services.workerCreation != nil {
		services.workerCreation.SetEntitlements(services.entitlement)
	}
	if services.extension != nil {
		services.extension.SetEntitlements(services.entitlement)
	}
}
