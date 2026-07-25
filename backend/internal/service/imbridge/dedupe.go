package imbridge

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"
)

type inboundDedupe struct {
	mu   sync.Mutex
	seen map[string]time.Time
	ttl  time.Duration
}

func newInboundDedupe(ttl time.Duration) *inboundDedupe {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &inboundDedupe{seen: make(map[string]time.Time), ttl: ttl}
}

// Claim returns false when the message was already processed recently.
func (d *inboundDedupe) Claim(_ context.Context, connectionID int64, externalMessageID string) bool {
	externalMessageID = strings.TrimSpace(externalMessageID)
	if externalMessageID == "" {
		return true
	}
	key := strconv.FormatInt(connectionID, 10) + "|" + externalMessageID
	now := time.Now()
	d.mu.Lock()
	defer d.mu.Unlock()
	d.gcLocked(now)
	if exp, ok := d.seen[key]; ok && now.Before(exp) {
		return false
	}
	d.seen[key] = now.Add(d.ttl)
	return true
}

func (d *inboundDedupe) gcLocked(now time.Time) {
	if len(d.seen) < 1024 {
		return
	}
	for k, exp := range d.seen {
		if now.After(exp) {
			delete(d.seen, k)
		}
	}
}
