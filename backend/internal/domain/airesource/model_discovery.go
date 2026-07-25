package airesource

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

type DiscoveredModel struct {
	ModelID     string
	DisplayName string
}

type ModelProfile struct {
	Modalities   []Modality
	Capabilities []Capability
}

// OpenAI-compatible `GET /models` payloads carry no modality metadata — every
// entry reports `object: "model"` — so modality has to be read off the model ID.
// Order is load-bearing: video runs before image because IDs such as
// `kling/kling-video-o1` and `gpt-image-1` both contain image-ish tokens, and
// embedding runs first because `text-embedding-*` also matches the chat default.
var modelProfileRules = []struct {
	pattern *regexp.Regexp
	profile ModelProfile
}{
	{
		regexp.MustCompile(`embed`),
		ModelProfile{[]Modality{ModalityEmbedding}, []Capability{CapabilityEmbedding}},
	},
	{
		regexp.MustCompile(`kling|wan-|hailuo|veo|sora|video`),
		ModelProfile{[]Modality{ModalityVideo}, []Capability{CapabilityVideoGeneration}},
	},
	{
		regexp.MustCompile(`speech|tts|music|voice|lyrics|audio|realtime`),
		ModelProfile{[]Modality{ModalityAudio}, []Capability{CapabilityTextToSpeech}},
	},
	{
		regexp.MustCompile(`image|seedream|nano-banana|midjourney`),
		ModelProfile{[]Modality{ModalityImage}, []Capability{CapabilityImageGeneration}},
	},
	{
		regexp.MustCompile(`vision|-vl$|-vl-`),
		ModelProfile{
			[]Modality{ModalityChat, ModalityMultimodal},
			[]Capability{CapabilityTextGeneration, CapabilityVisionInput},
		},
	},
}

var chatProfile = ModelProfile{
	Modalities:   []Modality{ModalityChat},
	Capabilities: []Capability{CapabilityTextGeneration},
}

func InferModelProfile(modelID string) ModelProfile {
	normalized := strings.ToLower(strings.TrimSpace(modelID))
	for _, rule := range modelProfileRules {
		if rule.pattern.MatchString(normalized) {
			return cloneProfile(rule.profile)
		}
	}
	return cloneProfile(chatProfile)
}

// RestrictProfileToProvider drops modalities the provider does not declare, so
// discovery can never produce a resource the provider definition would reject.
func RestrictProfileToProvider(provider ProviderDefinition, profile ModelProfile) (ModelProfile, bool) {
	supported := make(map[Modality]struct{}, len(provider.Modalities))
	for _, modality := range provider.Modalities {
		supported[modality] = struct{}{}
	}
	kept := make([]Modality, 0, len(profile.Modalities))
	for _, modality := range profile.Modalities {
		if _, ok := supported[modality]; ok {
			kept = append(kept, modality)
		}
	}
	if len(kept) == 0 {
		return ModelProfile{}, false
	}
	return ModelProfile{Modalities: kept, Capabilities: profile.Capabilities}, true
}

func DeriveModelIdentifier(modelID string) (slugkit.Slug, error) {
	sanitized, err := slugkit.SanitizeAndValidate(modelID)
	if err != nil {
		return "", fmt.Errorf("model ID %q has no usable identifier: %w", modelID, err)
	}
	return slugkit.Slug(sanitized), nil
}

func cloneProfile(profile ModelProfile) ModelProfile {
	return ModelProfile{
		Modalities:   append([]Modality(nil), profile.Modalities...),
		Capabilities: append([]Capability(nil), profile.Capabilities...),
	}
}
