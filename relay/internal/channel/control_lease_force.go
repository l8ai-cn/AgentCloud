package channel

import (
	"time"

	"github.com/l8ai-cn/agentcloud/relay/internal/protocol"
)

func (c *Channel) forceAcquireControlLease(subscriberID string) {
	leaseID, err := newControlLeaseID()
	if err != nil {
		c.sendControlStatus(subscriberID, protocol.ControlLeaseStatusRequired, "", time.Time{})
		return
	}

	now := time.Now()
	c.controlMu.Lock()
	if c.IsClosed() {
		c.controlMu.Unlock()
		return
	}
	if c.controlOwner == subscriberID && now.Before(c.controlExpiresAt) {
		leaseID = c.controlLeaseID
		expiresAt := c.controlExpiresAt
		c.controlMu.Unlock()
		c.sendControlStatus(subscriberID, protocol.ControlLeaseStatusGranted, leaseID, expiresAt)
		return
	}
	stole := c.controlOwner != "" && now.Before(c.controlExpiresAt)
	if stole {
		c.clearControlLeaseLocked()
	}
	c.setControlLeaseLocked(subscriberID, leaseID, now)
	expiresAt := c.controlExpiresAt
	c.controlMu.Unlock()
	if stole {
		c.Broadcast(protocol.EncodeControlLeaseStatus(protocol.ControlLeaseStatusReleased, "", 0))
	}
	c.sendControlStatus(subscriberID, protocol.ControlLeaseStatusGranted, leaseID, expiresAt)
}
