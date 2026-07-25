package workerruntime

import (
	"fmt"
	"strings"
)

const RuntimeImageReferencesEnv = "COORDINATOR_RUNNER_IMAGES"

var coordinatorDefaultRuntimeImages = []CatalogRuntimeImage{
	runtimeImage("codex-cli", "Codex CLI", "repo.aiedulab.cn:8443/agentcloud/runner-codex-cli@sha256:963c99fb047c0a4fed518eb9949e805fd31329a8395526fbb1fe34d8254ebea1"),
	runtimeImage("claude-code", "Claude Code", "repo.aiedulab.cn:8443/agentcloud/runner-claude-code@sha256:a9a02976dec14907be8eb6a7f68cd1adc5158099645244be733546b0f3e7041f"),
	runtimeImage("gemini-cli", "Gemini CLI", "repo.aiedulab.cn:8443/agentcloud/runner-gemini-cli@sha256:852dba55bcc3213c72a7ee94e9c2da29a44e2ba0d5a9c0a8c15fea5adb8c6cd4"),
}

var configurableRuntimeImages = map[string]CatalogRuntimeImage{
	"codex-cli":   coordinatorDefaultRuntimeImages[0],
	"claude-code": coordinatorDefaultRuntimeImages[1],
	"gemini-cli":  coordinatorDefaultRuntimeImages[2],
	"do-agent":    runtimeImage("do-agent", "DoAgent", ""),
	"grok-build":  runtimeImage("grok-build", "Grok Build", ""),
	"openclaw":    runtimeImage("openclaw", "OpenClaw", ""),
	"hermes":      runtimeImage("hermes", "Hermes", ""),
	"minimax-cli": runtimeImage("minimax-cli", "MiniMax CLI", ""),
	"e2e-echo":    runtimeImage("e2e-echo", "E2E Echo", ""),
}

func ParseRuntimeImageReferences(raw string) ([]CatalogRuntimeImage, map[string]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, map[string]string{}, nil
	}
	images := make([]CatalogRuntimeImage, 0, len(configurableRuntimeImages))
	references := make(map[string]string, len(configurableRuntimeImages))
	for _, entry := range strings.Split(raw, ",") {
		slug, reference, ok := strings.Cut(strings.TrimSpace(entry), "=")
		if !ok || strings.TrimSpace(slug) == "" || strings.TrimSpace(reference) == "" {
			return nil, nil, fmt.Errorf("%s entry must be runtime=immutable-reference", RuntimeImageReferencesEnv)
		}
		template, known := configurableRuntimeImages[slug]
		if !known {
			return nil, nil, fmt.Errorf("%s has unsupported runtime %q", RuntimeImageReferencesEnv, slug)
		}
		if _, duplicate := references[slug]; duplicate {
			return nil, nil, fmt.Errorf("%s repeats runtime %q", RuntimeImageReferencesEnv, slug)
		}
		digest, err := coordinatorImageDigest(reference)
		if err != nil {
			return nil, nil, err
		}
		template.Reference = reference
		template.Digest = digest
		images = append(images, template)
		references[slug] = reference
	}
	return images, references, nil
}

func coordinatorImageDigest(reference string) (string, error) {
	_, digest, ok := strings.Cut(strings.TrimSpace(reference), "@")
	if !ok || !validCoordinatorImageDigest(digest) {
		return "", fmt.Errorf("%s reference %q must end with an immutable sha256 digest", RuntimeImageReferencesEnv, reference)
	}
	return digest, nil
}

func validCoordinatorImageDigest(digest string) bool {
	if len(digest) != len("sha256:")+64 || !strings.HasPrefix(digest, "sha256:") {
		return false
	}
	for _, character := range digest[len("sha256:"):] {
		if (character < '0' || character > '9') && (character < 'a' || character > 'f') {
			return false
		}
	}
	return true
}

func runtimeImage(slug, name, reference string) CatalogRuntimeImage {
	image := CatalogRuntimeImage{
		ID:              stableRuntimeImageID(slug),
		Slug:            slug + "-stable",
		Name:            name,
		Reference:       reference,
		WorkerTypeSlugs: []string{slug},
		Enabled:         true,
	}
	if reference != "" {
		image.Digest, _ = coordinatorImageDigest(reference)
	}
	return image
}

func stableRuntimeImageID(workerType string) int64 {
	ids, err := parseRuntimeImageIDRegistry()
	if err != nil {
		panic(err)
	}
	id, ok := ids[workerType]
	if !ok {
		panic(fmt.Sprintf("missing stable runtime image id for %q", workerType))
	}
	return id
}
