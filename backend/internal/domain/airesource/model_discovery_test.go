package airesource

import (
	"strings"
	"testing"
)

func TestInferModelProfileUsesModelIDBecausePayloadsCarryNoModality(t *testing.T) {
	cases := []struct {
		modelID    string
		modalities []Modality
		capability Capability
	}{
		{"gpt-5.4", []Modality{ModalityChat}, CapabilityTextGeneration},
		{"claude-opus-4-6-thinking", []Modality{ModalityChat}, CapabilityTextGeneration},
		{"k3", []Modality{ModalityChat}, CapabilityTextGeneration},
		{"gpt-image-1.5", []Modality{ModalityImage}, CapabilityImageGeneration},
		{"gemini-2.5-flash-image", []Modality{ModalityImage}, CapabilityImageGeneration},
		{"seedream/seedream-5-0-pro", []Modality{ModalityImage}, CapabilityImageGeneration},
		{"vertex/nano-banana-2", []Modality{ModalityImage}, CapabilityImageGeneration},
		{"youchuan/midjourney", []Modality{ModalityImage}, CapabilityImageGeneration},
		{"MiniMax-Hailuo-2.3", []Modality{ModalityVideo}, CapabilityVideoGeneration},
		{"wan/wan-2-6", []Modality{ModalityVideo}, CapabilityVideoGeneration},
		{"speech-2.8-hd", []Modality{ModalityAudio}, CapabilityTextToSpeech},
		{"music-2.6", []Modality{ModalityAudio}, CapabilityTextToSpeech},
		{"voice-clone", []Modality{ModalityAudio}, CapabilityTextToSpeech},
		{"lyrics-generation", []Modality{ModalityAudio}, CapabilityTextToSpeech},
		{"gpt-4o-realtime-preview", []Modality{ModalityAudio}, CapabilityTextToSpeech},
		{"text-embedding-3-large", []Modality{ModalityEmbedding}, CapabilityEmbedding},
		{"grok-2-vision", []Modality{ModalityChat, ModalityMultimodal}, CapabilityTextGeneration},
	}
	for _, tc := range cases {
		profile := InferModelProfile(tc.modelID)
		if len(profile.Modalities) != len(tc.modalities) {
			t.Fatalf("%s: got modalities %v, want %v", tc.modelID, profile.Modalities, tc.modalities)
		}
		for i, modality := range tc.modalities {
			if profile.Modalities[i] != modality {
				t.Fatalf("%s: got modalities %v, want %v", tc.modelID, profile.Modalities, tc.modalities)
			}
		}
		if len(profile.Capabilities) == 0 || profile.Capabilities[0] != tc.capability {
			t.Fatalf("%s: got capabilities %v, want first %s", tc.modelID, profile.Capabilities, tc.capability)
		}
	}
}

// kling/kling-video-o1 carries both an image-ish and a video token; video must win.
func TestInferModelProfileResolvesVideoBeforeImage(t *testing.T) {
	profile := InferModelProfile("kling/kling-video-o1")
	if len(profile.Modalities) != 1 || profile.Modalities[0] != ModalityVideo {
		t.Fatalf("got %v, want [video]", profile.Modalities)
	}
}

func TestInferModelProfileProducesValidResources(t *testing.T) {
	for _, modelID := range []string{"gpt-5.4", "image-01", "MiniMax-Hailuo-2.3", "speech-2.8-turbo"} {
		identifier, err := DeriveModelIdentifier(modelID)
		if err != nil {
			t.Fatalf("%s: %v", modelID, err)
		}
		profile := InferModelProfile(modelID)
		resource := ModelResource{
			Identifier:   identifier,
			ModelID:      modelID,
			Modalities:   profile.Modalities,
			Capabilities: profile.Capabilities,
		}
		if err := ValidateModelResource(resource); err != nil {
			t.Fatalf("%s: inferred resource rejected: %v", modelID, err)
		}
	}
}

func TestDeriveModelIdentifierNormalizesAndRejectsUnusableIDs(t *testing.T) {
	identifier, err := DeriveModelIdentifier("MiniMax-M2.7-highspeed")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if identifier.String() != "minimax-m2-7-highspeed" {
		t.Fatalf("got %q", identifier)
	}
	if _, err := DeriveModelIdentifier("*"); err == nil {
		t.Fatal("expected wildcard model ID to be rejected")
	}
}

func TestModelListShapesOnlyCoverProvidersWhoseCheckListsModels(t *testing.T) {
	for _, definition := range Providers() {
		shape, ok := ModelListShapeFor(definition.Key.String())
		if !ok {
			continue
		}
		if !definition.SupportsModelDiscovery {
			t.Errorf("provider %q has list shape %q but does not declare model discovery", definition.Key, shape)
		}
		if definition.ConnectionCheck.AuthStrategy == ConnectionAuthUnsupported {
			t.Errorf("provider %q has list shape %q but no authenticated check to replay", definition.Key, shape)
		}
		if !strings.HasSuffix(definition.ConnectionCheck.Path, "models") {
			t.Errorf("provider %q check path %q is not a model list", definition.Key, definition.ConnectionCheck.Path)
		}
	}
}

func TestRestrictProfileToProviderDropsUnsupportedModalities(t *testing.T) {
	seedance, ok := Provider("sub2api-seedance")
	if !ok {
		t.Fatal("sub2api-seedance provider missing")
	}
	if _, kept := RestrictProfileToProvider(seedance, InferModelProfile("gpt-5.4")); kept {
		t.Fatal("chat model must not survive a video-only provider")
	}
	restricted, kept := RestrictProfileToProvider(seedance, InferModelProfile("kling/kling-v2-6"))
	if !kept || len(restricted.Modalities) != 1 || restricted.Modalities[0] != ModalityVideo {
		t.Fatalf("got %v kept=%v", restricted.Modalities, kept)
	}
}
