package entitlement

import (
	"sync"
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
)

const snapshotTTL = 30 * time.Second

type Snapshot interface {
	Decide(kind, key string, userID int64, role string) entitlementdom.Decision
}

type orgSnapshot struct {
	now     func() time.Time
	byKey   map[string][]entitlementdom.Entitlement
	workers WorkerTypeLookup
	skills  map[string]string
}

func (s *orgSnapshot) Decide(kind, key string, userID int64, role string) entitlementdom.Decision {
	return decide(s.now(), defaultFor(kind, key, s.workers, s.skills), s.byKey[compositeKey(kind, key)], userID, role)
}

func compositeKey(kind, key string) string {
	return kind + "\x00" + key
}

func groupByResource(rows []entitlementdom.Entitlement) map[string][]entitlementdom.Entitlement {
	grouped := make(map[string][]entitlementdom.Entitlement, len(rows))
	for _, row := range rows {
		k := compositeKey(row.ResourceKind, row.ResourceKey)
		grouped[k] = append(grouped[k], row)
	}
	return grouped
}

type cachedSnapshot struct {
	snap      Snapshot
	expiresAt time.Time
	revision  uint64
}

type snapshotCache struct {
	mu       sync.Mutex
	ttl      time.Duration
	revision uint64
	entries  map[int64]cachedSnapshot
}

func newSnapshotCache(ttl time.Duration) *snapshotCache {
	if ttl <= 0 {
		ttl = snapshotTTL
	}
	return &snapshotCache{ttl: ttl, entries: make(map[int64]cachedSnapshot)}
}

func (c *snapshotCache) get(orgID int64, now time.Time) (Snapshot, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[orgID]
	if !ok || !now.Before(entry.expiresAt) || entry.revision != c.revision {
		return nil, false
	}
	return entry.snap, true
}

func (c *snapshotCache) put(orgID int64, snap Snapshot, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[orgID] = cachedSnapshot{
		snap: snap, expiresAt: now.Add(c.ttl), revision: c.revision,
	}
}

func (c *snapshotCache) invalidate(orgID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.revision++
	delete(c.entries, orgID)
}
