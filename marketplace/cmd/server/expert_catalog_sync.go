package main

import (
	"context"
	"log"

	"github.com/l8ai-cn/agentcloud/marketplace/catalogsync"
)

// Startup catch-up only. Ongoing projection is driven by the backend expert
// publish/withdraw path; a 5s poll would reintroduce same-DB dual-write lag.
func syncExpertCatalogOnce(
	ctx context.Context,
	syncer *catalogsync.ExpertCatalogSynchronizer,
) {
	if _, err := syncer.Sync(ctx); err != nil {
		log.Fatalf("sync published expert catalog: %v", err)
	}
}
