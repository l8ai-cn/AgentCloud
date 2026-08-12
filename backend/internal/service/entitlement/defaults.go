package entitlement

import (
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerdefinition"
)

const (
	DefaultOpen   = "open"
	DefaultClosed = "closed"
)

type WorkerTypeLookup interface {
	Get(string) (workerdefinition.Definition, bool)
}

func normalizeDefault(value string) string {
	if value == DefaultClosed {
		return DefaultClosed
	}
	return DefaultOpen
}

func workerTypeDefault(lookup WorkerTypeLookup, slug string) string {
	if lookup == nil {
		return DefaultOpen
	}
	definition, ok := lookup.Get(slug)
	if !ok {
		return DefaultOpen
	}
	return normalizeDefault(definition.Entitlement.Default)
}

func skillDefault(defaults map[string]string, slug string) string {
	if defaults == nil {
		return DefaultOpen
	}
	return normalizeDefault(defaults[slug])
}

func defaultFor(kind, key string, workers WorkerTypeLookup, skills map[string]string) string {
	switch kind {
	case entitlementdom.KindWorkerType:
		return workerTypeDefault(workers, key)
	case entitlementdom.KindSkill:
		return skillDefault(skills, key)
	default:
		return DefaultOpen
	}
}
