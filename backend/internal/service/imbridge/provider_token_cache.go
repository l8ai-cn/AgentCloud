package imbridge

import (
	"sync"
	"time"
)

// tokenRenewMargin renews before the platform expiry so an in-flight send never
// races the cutoff.
const tokenRenewMargin = 60 * time.Second

type tokenEntry struct {
	token     string
	expiresAt time.Time
}

// tokenCache holds platform access tokens keyed by tenant identity. Feishu and
// WeCom both rate-limit token issuance far below our per-message send rate.
type tokenCache struct {
	mu      sync.Mutex
	entries map[string]tokenEntry
}

func newTokenCache() *tokenCache {
	return &tokenCache{entries: map[string]tokenEntry{}}
}

func (c *tokenCache) get(key string) (string, bool) {
	if c == nil || key == "" {
		return "", false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return "", false
	}
	return entry.token, true
}

func (c *tokenCache) set(key, token string, ttl time.Duration) {
	if c == nil || key == "" || token == "" || ttl <= tokenRenewMargin {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = map[string]tokenEntry{}
	}
	c.entries[key] = tokenEntry{token: token, expiresAt: time.Now().Add(ttl - tokenRenewMargin)}
}
