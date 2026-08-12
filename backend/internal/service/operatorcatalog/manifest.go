package operatorcatalog

import (
	"embed"
	"fmt"
	"io/fs"
	"path"
	"strings"
)

const Revision = "operator-partners-2026-08-13-campus-digital-employees"

//go:embed assets/skills
var skillAssets embed.FS

type ResearchSource struct {
	URL     string
	Commit  string
	License string
}

type SkillBundleFile struct {
	Path    string
	Content []byte
}

type SkillDefinition struct {
	Slug            string
	Name            string
	Description     string
	License         string
	Tags            []string
	Instructions    string
	ResearchSources []ResearchSource
	// BundleFiles are packaged alongside SKILL.md (domain server, scripts…).
	BundleFiles []SkillBundleFile
}

type ExpertDefinition struct {
	Slug           string
	Name           string
	Summary        string
	Description    string
	Category       string
	Icon           string
	Tags           []string
	Outcomes       []string
	SkillSlugs     []string
	Prompt         string
	WorkerTypeSlug string
	RuntimeImageID int64
	SecretRefs     map[string]string
	// InteractionMode is empty for PTY partners; ACP partners are driven by an
	// external caller over the Session API rather than a human terminal.
	InteractionMode string
	// ModelResourceID overrides the bootstrap-wide model binding for partners
	// whose domain needs a different model than the publisher default.
	ModelResourceID int64
	// ConfigOverrides must match the fields the worker type's AgentFile
	// declares; a nil value falls back to the codex-family partner defaults.
	ConfigOverrides map[string]any
	// ConfigDocumentRefs maps a config document the worker type requires to
	// the bootstrap bundle name that supplies it.
	ConfigDocumentRefs map[string]string
	// LaunchEnv allowlists environment variables the RunExpert caller may
	// supply per run, for values that are per-caller rather than per-partner.
	LaunchEnv []LaunchEnvDeclaration
}

type LaunchEnvDeclaration struct {
	Name   string
	Secret bool
}

func Skills() ([]SkillDefinition, error) {
	definitions := skillDefinitions()
	for index := range definitions {
		instructions, bundle, err := loadSkillAssets(definitions[index].Slug)
		if err != nil {
			return nil, err
		}
		definitions[index].Instructions = instructions
		definitions[index].BundleFiles = bundle
	}
	return definitions, nil
}

func loadSkillAssets(slug string) (string, []SkillBundleFile, error) {
	bundleRoot := path.Join("assets/skills", slug)
	if entries, err := fs.ReadDir(skillAssets, bundleRoot); err == nil && len(entries) > 0 {
		return loadSkillBundle(bundleRoot)
	}
	content, err := skillAssets.ReadFile(fmt.Sprintf("assets/skills/%s.md", slug))
	if err != nil {
		return "", nil, fmt.Errorf("operator catalog: read skill %s: %w", slug, err)
	}
	return string(content), nil, nil
}

func loadSkillBundle(bundleRoot string) (string, []SkillBundleFile, error) {
	skillMD, err := skillAssets.ReadFile(path.Join(bundleRoot, "SKILL.md"))
	if err != nil {
		return "", nil, fmt.Errorf("operator catalog: read %s/SKILL.md: %w", bundleRoot, err)
	}
	var bundle []SkillBundleFile
	err = fs.WalkDir(skillAssets, bundleRoot, func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		rel := strings.TrimPrefix(name, bundleRoot+"/")
		if rel == "" || rel == "SKILL.md" {
			return nil
		}
		content, readErr := skillAssets.ReadFile(name)
		if readErr != nil {
			return readErr
		}
		bundle = append(bundle, SkillBundleFile{Path: rel, Content: content})
		return nil
	})
	if err != nil {
		return "", nil, fmt.Errorf("operator catalog: walk %s: %w", bundleRoot, err)
	}
	return string(skillMD), bundle, nil
}
