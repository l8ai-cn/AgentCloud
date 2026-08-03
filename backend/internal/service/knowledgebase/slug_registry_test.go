package knowledgebase

import (
	"context"
	"strings"
	"testing"

	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

type slugExistsRepo struct {
	existing map[string]bool
	kbdomain.Repository
}

func (r *slugExistsRepo) SlugExists(_ context.Context, _ int64, slug string) (bool, error) {
	return r.existing[slug], nil
}

func TestEnsureUniqueSlug_FromASCIIName(t *testing.T) {
	svc := &Service{repo: &slugExistsRepo{existing: map[string]bool{}}}
	slug, err := svc.EnsureUniqueSlug(context.Background(), 1, "Team Docs")
	if err != nil {
		t.Fatal(err)
	}
	if slug != "team-docs" {
		t.Fatalf("got %q, want team-docs", slug)
	}
}

func TestEnsureUniqueSlug_UnicodeNameFallsBack(t *testing.T) {
	svc := &Service{repo: &slugExistsRepo{existing: map[string]bool{}}}
	slug, err := svc.EnsureUniqueSlug(context.Background(), 1, "测试")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(slug, "kb-") {
		t.Fatalf("expected kb- fallback, got %q", slug)
	}
	if err := slugkit.Validate(slug); err != nil {
		t.Fatalf("fallback slug invalid: %v", err)
	}
}

func TestEnsureUniqueSlug_CollisionSuffix(t *testing.T) {
	svc := &Service{repo: &slugExistsRepo{existing: map[string]bool{"team-docs": true}}}
	slug, err := svc.EnsureUniqueSlug(context.Background(), 1, "Team Docs")
	if err != nil {
		t.Fatal(err)
	}
	if slug != "team-docs-2" {
		t.Fatalf("got %q, want team-docs-2", slug)
	}
}
