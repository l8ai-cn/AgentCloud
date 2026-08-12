package airesource

import (
	"context"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
)

type memoryGrantQuerier struct {
	byResource map[string][]int64
}

func newMemoryGrantQuerier() *memoryGrantQuerier {
	return &memoryGrantQuerier{byResource: map[string][]int64{}}
}

func grantResourceKey(resourceType, resourceID string) string {
	return resourceType + ":" + resourceID
}

func (m *memoryGrantQuerier) setGrantedUsers(resourceType, resourceID string, userIDs ...int64) {
	m.byResource[grantResourceKey(resourceType, resourceID)] = append([]int64(nil), userIDs...)
}

func (m *memoryGrantQuerier) GetGrantedUserIDs(_ context.Context, resourceType, resourceID string) ([]int64, error) {
	return append([]int64(nil), m.byResource[grantResourceKey(resourceType, resourceID)]...), nil
}

func (m *memoryGrantQuerier) GetGrantedResourceIDs(_ context.Context, resourceType string, userID, _ int64) ([]string, error) {
	prefix := resourceType + ":"
	var resourceIDs []string
	for key, users := range m.byResource {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		for _, id := range users {
			if id == userID {
				resourceIDs = append(resourceIDs, strings.TrimPrefix(key, prefix))
				break
			}
		}
	}
	return resourceIDs, nil
}

func (f *fixture) grantConnectionUsers(connectionID int64, userIDs ...int64) {
	f.grants.setGrantedUsers(grant.TypeModelConnection, grant.IntResourceID(connectionID), userIDs...)
}
