package orchestrationcontrol

import (
	"sort"
	"strings"
	"unicode/utf8"

	control "github.com/l8ai-cn/agentcloud/backend/internal/domain/orchestrationcontrol"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/orchestrationresource"
)

const invalidDraftCode = "invalid-draft"

const maxDraftDetailBytes = 240

// Drafts are attacker-controlled, so every enriched message is re-validated by
// the domain guard (length + secret-like text) and falls back to the opaque
// message when it fails.
func invalidDraftResult(path, message string) validatedDraft {
	issue := control.PlanIssue{
		Severity: control.PlanIssueBlocking,
		Path:     path,
		Code:     invalidDraftCode,
		Message:  message,
	}
	if issue.Validate() != nil {
		issue = control.PlanIssue{
			Severity: control.PlanIssueBlocking,
			Path:     "/",
			Code:     invalidDraftCode,
			Message:  "The resource draft is invalid.",
		}
	}
	return validatedDraft{result: ValidationResult{
		Issues: []control.PlanIssue{issue},
	}}
}

func undecodableDraftIssue(err error) validatedDraft {
	return invalidDraftResult("/", strings.Join([]string{
		"The draft could not be parsed:",
		safeDraftDetail(err) + ".",
		"A manifest needs apiVersion, kind, metadata.name, metadata.namespace and spec.",
	}, " "))
}

func unaddressableDraftIssue(err error) validatedDraft {
	return invalidDraftResult("/metadata", strings.Join([]string{
		"The draft is not addressable:",
		safeDraftDetail(err) + ".",
		"metadata.namespace must be the organization slug and metadata.name",
		"must be a lowercase identifier (a-z, 0-9 and hyphens).",
	}, " "))
}

func unsupportedDraftKindIssue(supported []string) validatedDraft {
	message := "This apiVersion and kind pair is not supported."
	if len(supported) > 0 {
		message += " Supported kinds: " + strings.Join(supported, ", ") + "."
	}
	return invalidDraftResult("/kind", message)
}

func invalidDraftSpecIssue(kind string, err error) validatedDraft {
	return invalidDraftResult("/spec", strings.Join([]string{
		"The spec does not match the", kind, "schema:", safeDraftDetail(err) + ".",
	}, " "))
}

func uncanonicalizableDraftIssue() validatedDraft {
	return invalidDraftResult("/", "The resource draft is invalid.")
}

func supportedDraftKinds(planners map[orchestrationresource.TypeMeta]TargetPlanner) []string {
	seen := make(map[string]struct{}, len(planners))
	kinds := make([]string, 0, len(planners))
	for typeMeta := range planners {
		if _, exists := seen[typeMeta.Kind]; exists {
			continue
		}
		seen[typeMeta.Kind] = struct{}{}
		kinds = append(kinds, typeMeta.Kind)
	}
	sort.Strings(kinds)
	return kinds
}

func safeDraftDetail(err error) string {
	if err == nil {
		return "unknown error"
	}
	detail := strings.ToValidUTF8(err.Error(), "\uFFFD")
	detail = strings.ReplaceAll(detail, "\n", " ")
	detail = strings.ReplaceAll(detail, "\r", " ")
	detail = strings.TrimSpace(detail)
	if detail == "" {
		return "unknown error"
	}
	if len(detail) <= maxDraftDetailBytes {
		return detail
	}
	limit := maxDraftDetailBytes
	for limit > 0 && !utf8.ValidString(detail[:limit]) {
		limit--
	}
	return detail[:limit] + "..."
}
