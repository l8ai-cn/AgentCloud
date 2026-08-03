package knowledgebase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

// EnsureUniqueSlug derives a KB slug from a display name. Unicode-only names
// sanitize to empty under slugkit, so we fall back to kb-{8hex}.
func (s *Service) EnsureUniqueSlug(ctx context.Context, orgID int64, nameSeed string) (string, error) {
	check := slugkit.FromExistsCheck(func(ctx context.Context, candidate string) (bool, error) {
		return s.repo.SlugExists(ctx, orgID, candidate)
	})
	if slug, ok := slugkit.TrySeeds(ctx, []string{nameSeed}, check); ok {
		return slug, nil
	}
	return randomFallbackKBSlug(ctx, check)
}

func randomFallbackKBSlug(ctx context.Context, check slugkit.UniquenessChecker) (string, error) {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("%w: random slug seed: %v", ErrInvalidInput, err)
	}
	slug, err := slugkit.GenerateUnique(ctx, "kb-"+hex.EncodeToString(buf), check)
	if err != nil {
		return "", fmt.Errorf("%w: cannot derive slug: %v", ErrInvalidInput, err)
	}
	return slug, nil
}
