package airesource

type ModelListShape string

const (
	ModelListShapeOpenAI    ModelListShape = "openai"
	ModelListShapeAnthropic ModelListShape = "anthropic"
	ModelListShapeGemini    ModelListShape = "gemini"
)

// Discovery replays a provider's ConnectionCheck request, so a provider only
// appears here when that check already targets its model-list endpoint with
// credentials the prober proves are accepted. Providers left out either probe
// something else (openrouter checks /key), answer with a payload shape we have
// not implemented (elevenlabs, replicate), or expose no list endpoint at all
// (fal) — those report discovery as unsupported instead of guessing.
var modelListShapes = map[string]ModelListShape{
	"openai":                   ModelListShapeOpenAI,
	"deepseek":                 ModelListShapeOpenAI,
	"xai":                      ModelListShapeOpenAI,
	"mistral":                  ModelListShapeOpenAI,
	"custom-openai-compatible": ModelListShapeOpenAI,
	"anthropic":                ModelListShapeAnthropic,
	"gemini":                   ModelListShapeGemini,
}

func ModelListShapeFor(providerKey string) (ModelListShape, bool) {
	shape, ok := modelListShapes[providerKey]
	return shape, ok
}
