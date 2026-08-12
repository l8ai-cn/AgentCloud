package extension

import (
	"context"
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
)

func TestListMyInstalledSkills_ForwardsOrgAndUserWithoutSigningURL(t *testing.T) {
	var gotOrg, gotUser int64
	urlSigned := false
	repo := &svcMockRepo{
		listUserInstalledSkillsFn: func(_ context.Context, orgID, userID int64) ([]*extension.UserInstalledSkill, error) {
			gotOrg, gotUser = orgID, userID
			return []*extension.UserInstalledSkill{{
				Install: &extension.InstalledSkill{
					Slug:       "format-go",
					StorageKey: "skills/format-go.tar.gz",
					ContentSha: "abc",
					Skill:      &skilldom.Skill{DisplayName: "Format Go"},
				},
				RepositoryName: "Alpha",
				RepositorySlug: "alpha",
			}}, nil
		},
	}
	svc := newTestService(repo, &svcMockStorage{
		getURLFn: func(context.Context, string, time.Duration) (string, error) {
			urlSigned = true
			return "https://signed.example/file", nil
		},
	}, nil)

	got, err := svc.ListMyInstalledSkills(context.Background(), 7, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotOrg != 7 || gotUser != 42 {
		t.Fatalf("expected org=7 user=42, got org=%d user=%d", gotOrg, gotUser)
	}
	if urlSigned {
		t.Fatal("management view must not sign download URLs")
	}
	if len(got) != 1 || got[0].DisplayName() != "Format Go" {
		t.Fatalf("unexpected result: %+v", got)
	}
}

func TestListMyInstalledMcpServers_ForwardsOrgAndUser(t *testing.T) {
	var gotOrg, gotUser int64
	repo := &svcMockRepo{
		listUserInstalledMcpServersFn: func(_ context.Context, orgID, userID int64) ([]*extension.UserInstalledMcpServer, error) {
			gotOrg, gotUser = orgID, userID
			return []*extension.UserInstalledMcpServer{{
				Install: &extension.InstalledMcpServer{
					Slug:       "github",
					MarketItem: &extension.McpMarketItem{Name: "GitHub MCP", Slug: "github"},
				},
				RepositoryName: "Alpha",
				RepositorySlug: "alpha",
			}}, nil
		},
	}
	svc := newTestService(repo, &svcMockStorage{}, nil)

	got, err := svc.ListMyInstalledMcpServers(context.Background(), 7, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotOrg != 7 || gotUser != 42 {
		t.Fatalf("expected org=7 user=42, got org=%d user=%d", gotOrg, gotUser)
	}
	if len(got) != 1 || got[0].MarketItemName() != "GitHub MCP" {
		t.Fatalf("unexpected result: %+v", got)
	}
}

func TestUserInstalledSkillDisplayName_FallsBackToSlug(t *testing.T) {
	row := &extension.UserInstalledSkill{Install: &extension.InstalledSkill{Slug: "from-github"}}
	if row.DisplayName() != "from-github" {
		t.Fatalf("expected slug fallback, got %q", row.DisplayName())
	}
}
