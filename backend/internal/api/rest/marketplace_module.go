package rest

import (
	"context"
	"log/slog"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/rest/v1"
	orgdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	expertsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/expert"
	authpkg "github.com/l8ai-cn/agentcloud/backend/pkg/auth"
	"github.com/l8ai-cn/agentcloud/marketplace/httpapi"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type marketplaceTokenVerifier struct {
	auth interface {
		ValidateTokenWithContext(context.Context, string) (*authpkg.Claims, error)
	}
}

func (v marketplaceTokenVerifier) Verify(
	ctx context.Context,
	token string,
) (*authpkg.Claims, error) {
	return v.auth.ValidateTokenWithContext(ctx, token)
}

type marketplaceOrgGateway struct {
	org interface {
		IsMember(context.Context, int64, int64) (bool, error)
		GetByID(context.Context, int64) (*orgdomain.Organization, error)
	}
}

func (g marketplaceOrgGateway) IsMember(
	ctx context.Context,
	organizationID, userID int64,
) (bool, error) {
	return g.org.IsMember(ctx, organizationID, userID)
}

func (g marketplaceOrgGateway) OrganizationSlug(
	ctx context.Context,
	organizationID int64,
) (string, error) {
	org, err := g.org.GetByID(ctx, organizationID)
	if err != nil {
		return "", err
	}
	return org.Slug, nil
}

type marketplaceExpertAdapter struct {
	expert *expertsvc.Service
}

func (a marketplaceExpertAdapter) InstallMarketplaceExpert(
	ctx context.Context,
	request httpapi.ExpertInstallRequest,
) (int64, bool, error) {
	row, existing, err := a.expert.InstallMarketplaceExpert(
		ctx,
		expertsvc.MarketplaceInstallationRequest{
			InstallationID:            request.InstallationID,
			TargetOrganizationID:      request.TargetOrganizationID,
			TargetOrganizationSlug:    request.TargetOrganizationSlug,
			ActorUserID:               request.ActorUserID,
			ModelResourceID:           request.ModelResourceID,
			ToolModelResourceIDs:      request.ToolModelResourceIDs,
			SourceMarketApplicationID: request.SourceMarketApplicationID,
			SourceMarketReleaseID:     request.SourceMarketReleaseID,
			RuntimeSnapshot:           request.RuntimeSnapshot,
		},
	)
	if err != nil {
		return 0, false, err
	}
	return row.ID, existing, nil
}

func mountMarketplaceModule(
	engine *gin.Engine,
	db *gorm.DB,
	svc *v1.Services,
) {
	if engine == nil || db == nil || svc == nil ||
		svc.Auth == nil || svc.Expert == nil || svc.Org == nil {
		slog.Warn("marketplace HTTP module skipped: required services unavailable")
		return
	}
	httpapi.Mount(engine, httpapi.Options{
		DB:        db,
		Identity:  marketplaceTokenVerifier{auth: svc.Auth},
		Installer: marketplaceExpertAdapter{expert: svc.Expert},
		Orgs:      marketplaceOrgGateway{org: svc.Org},
	})
}
