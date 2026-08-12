package workercreation

import (
	"context"
	"strings"

	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

func (service *Service) AssertWorkerTypeAvailable(ctx context.Context, slug string) error {
	if service == nil || service.workerTypes == nil {
		return specservice.ErrResolverUnavailable
	}
	parsed, err := slugkit.NewFromTrusted(strings.TrimSpace(slug))
	if err != nil {
		return invalidWorkerType("slug is invalid")
	}
	_, err = service.workerTypes.ResolveWorkerType(ctx, specservice.Scope{}, parsed)
	return err
}
