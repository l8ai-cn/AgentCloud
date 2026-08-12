package extension

import (
	"encoding/json"
	"sync"
)

// Sidecars are addressed by the package's content hash, so a hit can never go
// stale and needs no TTL; the cap only bounds memory as skill versions pile up.
const packedAgentFilterCacheCap = 1024

type packedAgentFilterCache struct {
	mu      sync.Mutex
	entries map[string]json.RawMessage
}

func newPackedAgentFilterCache() *packedAgentFilterCache {
	return &packedAgentFilterCache{entries: make(map[string]json.RawMessage)}
}

// The bool return keeps a cached "this package has no sidecar" distinct from a
// miss, which is the case that actually saves a round trip on pod launch.
func (c *packedAgentFilterCache) get(storageKey string) (json.RawMessage, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[storageKey]
	return raw, ok
}

func (c *packedAgentFilterCache) put(storageKey string, raw json.RawMessage) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) >= packedAgentFilterCacheCap {
		c.entries = make(map[string]json.RawMessage, packedAgentFilterCacheCap)
	}
	c.entries[storageKey] = raw
}
