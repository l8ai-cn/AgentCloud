package catalogsync

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

// 专家安装一律只要求工作区执行权。marketplace 把这一列作为 required_permissions
// 透出给安装计划和商店响应，所以必须显式写入，不能落到列默认值 []。
const expertRequiredPermissions = `["workspace.execute"]`

type expertCatalogReferences struct {
	MarketplaceID    int64
	SpaceID          int64
	QuotaPlanID      int64
	PublisherID      int64
	CatalogItemID    int64
	CatalogVersionID int64
	ListingID        int64
	ListingVersionID int64
}

func (s *ExpertCatalogSynchronizer) publishListing(
	ctx context.Context,
	release publishedExpertRelease,
	payload expertCatalogPayload,
) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		refs, err := ensureExpertCatalogReferences(tx, release, payload)
		if err != nil {
			return err
		}
		outcomes, _ := json.Marshal([]string(release.Outcomes))
		tags := []string(release.Tags)
		listingVersionID, err := ensureExpertListingVersion(
			tx, refs, release, outcomes, tags,
		)
		if err != nil {
			return err
		}
		refs.ListingVersionID = listingVersionID
		return tx.Exec(`
UPDATE marketplace.marketplace_listings
SET status = 'published', visibility = 'public', access_mode = 'direct',
  current_version_id = ?, submitted_by_platform_user_id = NULLIF(?, 0),
  published_at = ?, featured_rank = ?, revision = revision + 1, updated_at = NOW()
WHERE id = ?
  AND (status <> 'published' OR visibility <> 'public' OR access_mode <> 'direct'
    OR current_version_id IS DISTINCT FROM ?
    OR COALESCE(submitted_by_platform_user_id, 0) IS DISTINCT FROM ?
    OR published_at IS DISTINCT FROM ? OR featured_rank IS DISTINCT FROM ?)
`, refs.ListingVersionID, release.ReviewerUserID, release.PublishedAt,
			featuredRank(release.Featured), refs.ListingID,
			refs.ListingVersionID, release.ReviewerUserID, release.PublishedAt,
			featuredRank(release.Featured)).Error
	})
}

func ensureExpertCatalogReferences(
	tx *gorm.DB,
	release publishedExpertRelease,
	payload expertCatalogPayload,
) (expertCatalogReferences, error) {
	refs, err := ensureExpertMarket(tx)
	if err != nil {
		return refs, err
	}
	refs.PublisherID, err = ensureExpertPublisher(tx, release)
	if err != nil {
		return refs, err
	}
	refs.CatalogItemID, err = ensureExpertCatalogItem(tx, refs.PublisherID, release)
	if err != nil {
		return refs, err
	}
	refs.CatalogVersionID, err = ensureExpertCatalogVersion(
		tx, refs.CatalogItemID, release, payload,
	)
	if err != nil {
		return refs, err
	}
	refs.ListingID, err = ensureExpertListing(tx, refs, release)
	return refs, err
}

func ensureExpertCatalogVersion(
	tx *gorm.DB,
	catalogItemID int64,
	release publishedExpertRelease,
	payload expertCatalogPayload,
) (int64, error) {
	version := strconv.Itoa(release.Version) + ".0.0"
	// Projection rebuild: same (catalog_item_id, version) may rewrite digest
	// when the projection algorithm changes. The expert release remains SSOT.
	if err := tx.Exec(`
INSERT INTO marketplace.marketplace_catalog_item_versions
  (catalog_item_id, version, source_revision, content_digest, manifest,
   permissions, compatibility, dependency_lock, validation_status,
   created_by_platform_user_id)
VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb,
  ?::jsonb, 'passed', ?)
ON CONFLICT (catalog_item_id, version) DO UPDATE SET
  source_revision = EXCLUDED.source_revision,
  content_digest = EXCLUDED.content_digest,
  manifest = EXCLUDED.manifest,
  permissions = EXCLUDED.permissions,
  compatibility = EXCLUDED.compatibility,
  dependency_lock = EXCLUDED.dependency_lock,
  validation_status = 'passed'
`, catalogItemID, version, fmt.Sprintf("expert-release-%d", release.ReleaseID),
		payload.ContentDigest, string(payload.Manifest), expertRequiredPermissions,
		string(payload.Compatibility),
		string(payload.DependencyLock), release.PublisherUserID).Error; err != nil {
		return 0, err
	}
	var row struct {
		ID int64
	}
	if err := tx.Raw(`
SELECT id
FROM marketplace.marketplace_catalog_item_versions
WHERE catalog_item_id = ? AND version = ?
`, catalogItemID, version).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID == 0 {
		return 0, fmt.Errorf("expert catalog version missing for release %d", release.ReleaseID)
	}
	if err := tx.Exec(`
UPDATE marketplace.marketplace_catalog_items
SET status = 'active', latest_version_id = ?, name = ?, summary = ?,
  revision = revision + 1, updated_at = NOW()
WHERE id = ?
  AND (status <> 'active' OR latest_version_id IS DISTINCT FROM ?
    OR name IS DISTINCT FROM ? OR summary IS DISTINCT FROM ?)
`, row.ID, release.Name, release.Summary, catalogItemID,
		row.ID, release.Name, release.Summary).Error; err != nil {
		return 0, err
	}
	return row.ID, nil
}

func ensureExpertListingVersion(
	tx *gorm.DB,
	refs expertCatalogReferences,
	release publishedExpertRelease,
	outcomes []byte,
	tags []string,
) (int64, error) {
	// use_cases / target_audience / requirements / release_notes 不写：
	// expert_market_releases 不收集这些字段，投影时没有可信来源，
	// 列上的 jsonb 默认值就是唯一诚实的取值。
	if err := tx.Exec(`
INSERT INTO marketplace.marketplace_listing_versions
  (listing_id, catalog_item_id, catalog_item_version_id, revision, display_name,
   tagline, description, outcomes, tags, quota_plan_id, review_status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'approved')
ON CONFLICT (listing_id, revision) DO NOTHING
`, refs.ListingID, refs.CatalogItemID, refs.CatalogVersionID, release.Version,
		release.Name, release.Summary, release.Description, string(outcomes),
		pq.Array(tags), refs.QuotaPlanID).Error; err != nil {
		return 0, err
	}
	var row struct {
		ID                   int64
		CatalogItemVersionID int64
	}
	if err := tx.Raw(`
SELECT id, catalog_item_version_id
FROM marketplace.marketplace_listing_versions
WHERE listing_id = ? AND revision = ?
`, refs.ListingID, release.Version).Scan(&row).Error; err != nil {
		return 0, err
	}
	if row.ID == 0 || row.CatalogItemVersionID != refs.CatalogVersionID {
		return 0, fmt.Errorf(
			"expert listing version conflicts with release %d",
			release.ReleaseID,
		)
	}
	return row.ID, nil
}

func featuredRank(featured bool) int {
	if featured {
		return 100
	}
	return 0
}
