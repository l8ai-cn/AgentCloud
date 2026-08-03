package workerruntime

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

// Separation of duties: the lock owns which digests are trusted and stays under
// review; the override owns which of those digests an environment exposes, so
// operators can gate a Worker type without shipping a backend build. An override
// may never name a worker type the lock has not already pinned.
type CatalogOverride struct {
	SchemaVersion int      `json:"schema_version"`
	Disabled      []string `json:"disabled_worker_types"`
	Enabled       []string `json:"enabled_worker_types"`
}

func LoadCatalogOverride(filePath string) (CatalogOverride, error) {
	if strings.TrimSpace(filePath) == "" {
		return CatalogOverride{}, nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return CatalogOverride{}, fmt.Errorf("read runtime catalog override: %w", err)
	}
	var override CatalogOverride
	if err := json.Unmarshal(raw, &override); err != nil {
		return CatalogOverride{}, fmt.Errorf("decode runtime catalog override: %w", err)
	}
	if override.SchemaVersion != 1 {
		return CatalogOverride{}, fmt.Errorf("runtime catalog override schema_version must be 1")
	}
	return override, nil
}

func (override CatalogOverride) empty() bool {
	return len(override.Disabled) == 0 && len(override.Enabled) == 0
}

func (catalog Catalog) WithOverride(override CatalogOverride) (Catalog, error) {
	if override.empty() {
		return catalog, nil
	}
	disabled, err := catalog.overrideSet(override.Disabled)
	if err != nil {
		return Catalog{}, err
	}
	enabled, err := catalog.overrideSet(override.Enabled)
	if err != nil {
		return Catalog{}, err
	}
	for workerType := range enabled {
		if _, conflict := disabled[workerType]; conflict {
			return Catalog{}, fmt.Errorf(
				"runtime catalog override both enables and disables %q",
				workerType,
			)
		}
	}
	images := make([]CatalogRuntimeImage, len(catalog.images))
	for index, image := range catalog.images {
		images[index] = cloneCatalogImage(image)
		for _, workerType := range image.WorkerTypeSlugs {
			if _, off := disabled[workerType]; off {
				images[index].Enabled = false
			}
			if _, on := enabled[workerType]; on {
				images[index].Enabled = true
			}
		}
	}
	catalog.images = images
	catalog.revision = catalog.revision + "+override-" + override.fingerprint()
	return catalog, nil
}

func (catalog Catalog) overrideSet(workerTypes []string) (map[string]struct{}, error) {
	set := make(map[string]struct{}, len(workerTypes))
	for _, workerType := range workerTypes {
		workerType = strings.TrimSpace(workerType)
		if workerType == "" {
			return nil, fmt.Errorf("runtime catalog override has an empty worker type")
		}
		if len(catalog.ImagesFor(workerType)) == 0 {
			return nil, fmt.Errorf(
				"runtime catalog override names unlocked worker type %q",
				workerType,
			)
		}
		set[workerType] = struct{}{}
	}
	return set, nil
}

// The revision keys client-side option caches and draft validation, so an
// override that changes selectability must change the revision too.
func (override CatalogOverride) fingerprint() string {
	parts := append([]string{}, sortedCopy(override.Disabled)...)
	parts = append(parts, "|")
	parts = append(parts, sortedCopy(override.Enabled)...)
	sum := sha256.Sum256([]byte(strings.Join(parts, ",")))
	return hex.EncodeToString(sum[:])[:12]
}

func sortedCopy(values []string) []string {
	copied := append([]string{}, values...)
	sort.Strings(copied)
	return copied
}
