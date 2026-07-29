package catalogsync

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

type expertCatalogPayload struct {
	Manifest       []byte
	Compatibility  []byte
	DependencyLock []byte
	ContentDigest  string
	AgentSlug      string
}

func buildExpertCatalogPayload(release publishedExpertRelease) (expertCatalogPayload, error) {
	var expert struct {
		AgentSlug  string   `json:"agent_slug"`
		SkillSlugs []string `json:"skill_slugs"`
	}
	if err := json.Unmarshal(release.ExpertSnapshot, &expert); err != nil {
		return expertCatalogPayload{}, fmt.Errorf("decode expert snapshot: %w", err)
	}
	if expert.AgentSlug == "" {
		return expertCatalogPayload{}, fmt.Errorf("expert release %d has no agent slug", release.ReleaseID)
	}
	var workerSnapshot struct {
		Version int             `json:"version"`
		Spec    json.RawMessage `json:"spec"`
	}
	if err := json.Unmarshal(release.WorkerSpecSnapshot, &workerSnapshot); err != nil {
		return expertCatalogPayload{}, fmt.Errorf("decode worker snapshot: %w", err)
	}
	if workerSnapshot.Version != 1 || len(workerSnapshot.Spec) == 0 {
		return expertCatalogPayload{}, fmt.Errorf(
			"expert release %d has an invalid worker snapshot",
			release.ReleaseID,
		)
	}
	var workerSpec struct {
		Version int `json:"version"`
	}
	if err := json.Unmarshal(workerSnapshot.Spec, &workerSpec); err != nil ||
		workerSpec.Version != 1 {
		return expertCatalogPayload{}, fmt.Errorf(
			"expert release %d has an invalid worker spec",
			release.ReleaseID,
		)
	}
	// Manifest carries only provenance + the installable snapshot. Credits and
	// locale were invented here with no upstream field and no consumers.
	manifest, err := json.Marshal(struct {
		SourceRelease struct {
			ApplicationID int64 `json:"application_id"`
			ReleaseID     int64 `json:"release_id"`
			Version       int   `json:"version"`
		} `json:"source_release"`
		RuntimeSnapshot struct {
			Version    int             `json:"version"`
			Expert     json.RawMessage `json:"expert"`
			WorkerSpec json.RawMessage `json:"worker_spec"`
		} `json:"runtime_snapshot"`
	}{
		SourceRelease: struct {
			ApplicationID int64 `json:"application_id"`
			ReleaseID     int64 `json:"release_id"`
			Version       int   `json:"version"`
		}{
			ApplicationID: release.ApplicationID,
			ReleaseID:     release.ReleaseID,
			Version:       release.Version,
		},
		RuntimeSnapshot: struct {
			Version    int             `json:"version"`
			Expert     json.RawMessage `json:"expert"`
			WorkerSpec json.RawMessage `json:"worker_spec"`
		}{
			Version: 1, Expert: release.ExpertSnapshot,
			WorkerSpec: workerSnapshot.Spec,
		},
	})
	if err != nil {
		return expertCatalogPayload{}, fmt.Errorf("encode expert manifest: %w", err)
	}
	compatibility, err := json.Marshal(map[string]any{
		"agents": []string{expert.AgentSlug},
	})
	if err != nil {
		return expertCatalogPayload{}, err
	}
	dependencyLock, err := json.Marshal(map[string]any{"skills": expert.SkillSlugs})
	if err != nil {
		return expertCatalogPayload{}, err
	}
	sum := sha256.Sum256(bytesJoin(manifest, compatibility, dependencyLock))
	return expertCatalogPayload{
		Manifest: manifest, Compatibility: compatibility,
		DependencyLock: dependencyLock, ContentDigest: hex.EncodeToString(sum[:]),
		AgentSlug: expert.AgentSlug,
	}, nil
}

func bytesJoin(values ...[]byte) []byte {
	size := 0
	for _, value := range values {
		size += len(value)
	}
	joined := make([]byte, 0, size)
	for _, value := range values {
		joined = append(joined, value...)
	}
	return joined
}
