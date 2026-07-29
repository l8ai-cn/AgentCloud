package httpapi

import (
	"context"
	"time"

	authpkg "github.com/l8ai-cn/agentcloud/backend/pkg/auth"
	"github.com/l8ai-cn/agentcloud/marketplace/internal/api"
	marketplacepostgres "github.com/l8ai-cn/agentcloud/marketplace/internal/infra/postgres"
	"github.com/l8ai-cn/agentcloud/marketplace/internal/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TokenVerifier interface {
	Verify(context.Context, string) (*authpkg.Claims, error)
}

type OrganizationGateway interface {
	IsMember(context.Context, int64, int64) (bool, error)
	OrganizationSlug(context.Context, int64) (string, error)
}

type Options struct {
	DB        *gorm.DB
	Identity  TokenVerifier
	Installer ExpertInstaller
	Orgs      OrganizationGateway
	Ready     func(context.Context) error
}

func Mount(engine *gin.Engine, opts Options) {
	if engine == nil || opts.DB == nil || opts.Identity == nil ||
		opts.Installer == nil || opts.Orgs == nil {
		panic("marketplace httpapi options are required")
	}
	ready := opts.Ready
	if ready == nil {
		sqlDB, err := opts.DB.DB()
		if err != nil {
			panic(err)
		}
		ready = sqlDB.PingContext
	}
	runtime := &localRuntimeBridge{
		installer: opts.Installer,
		orgs:      opts.Orgs,
	}
	installationRepository := marketplacepostgres.NewInstallationRepository(opts.DB)
	api.MountAPI(engine, api.Dependencies{
		Ready:      ready,
		Storefront: service.NewStorefrontService(marketplacepostgres.NewStorefrontRepository(opts.DB)),
		Identity:   opts.Identity,
		Installations: service.NewInstallationOrchestrationService(
			installationRepository,
			runtime,
			time.Now,
		),
		Applications: service.NewOrganizationApplicationsService(
			marketplacepostgres.NewOrganizationApplicationsRepository(opts.DB),
			runtime,
		),
	})
}
