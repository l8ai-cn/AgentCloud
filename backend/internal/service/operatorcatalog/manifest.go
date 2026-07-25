package operatorcatalog

import (
	"embed"
	"fmt"
)

const Revision = "operator-partners-2026-07-25"

//go:embed assets/skills/*.md
var skillAssets embed.FS

type ResearchSource struct {
	URL     string
	Commit  string
	License string
}

type SkillDefinition struct {
	Slug            string
	Name            string
	Description     string
	License         string
	Tags            []string
	Instructions    string
	ResearchSources []ResearchSource
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
}

func Skills() ([]SkillDefinition, error) {
	definitions := skillDefinitions()
	for index := range definitions {
		content, err := skillAssets.ReadFile(
			fmt.Sprintf("assets/skills/%s.md", definitions[index].Slug),
		)
		if err != nil {
			return nil, fmt.Errorf(
				"operator catalog: read skill %s: %w",
				definitions[index].Slug,
				err,
			)
		}
		definitions[index].Instructions = string(content)
	}
	return definitions, nil
}
