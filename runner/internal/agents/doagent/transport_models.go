package doagent

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const modelListTimeout = 15 * time.Second

func (t *transport) SupportedModels() []string {
	t.modelMu.RLock()
	defer t.modelMu.RUnlock()
	return append([]string(nil), t.models...)
}

func (t *transport) CurrentModel() string {
	t.modelMu.RLock()
	defer t.modelMu.RUnlock()
	return t.model
}

func (t *transport) setCurrentModel(model string) {
	model = strings.TrimSpace(model)
	if model == "" {
		return
	}
	t.modelMu.Lock()
	defer t.modelMu.Unlock()
	t.model = model
	for _, existing := range t.models {
		if existing == model {
			return
		}
	}
	t.models = append(t.models, model)
}

func (t *transport) loadModels() {
	settings, err := readDoAgentSettings(os.Getenv("DO_AGENT_SETTINGS"))
	if err != nil {
		t.logger.Warn("do-agent settings unavailable for model list", "error", err)
		return
	}
	if settings.Model != "" {
		t.setCurrentModel(settings.Model)
	}
	models, err := listProviderModels(settings)
	if err != nil {
		t.logger.Warn("do-agent model list failed", "error", err)
		return
	}
	t.modelMu.Lock()
	defer t.modelMu.Unlock()
	t.models = uniqueModels(append([]string{t.model}, models...))
}

func uniqueModels(models []string) []string {
	seen := make(map[string]struct{}, len(models))
	out := make([]string, 0, len(models))
	for _, model := range models {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		if _, ok := seen[model]; ok {
			continue
		}
		seen[model] = struct{}{}
		out = append(out, model)
	}
	return out
}

type doAgentSettings struct {
	Model    string
	Provider string
	APIKey   string
	BaseURL  string
}

func readDoAgentSettings(path string) (doAgentSettings, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return doAgentSettings{}, fmt.Errorf("DO_AGENT_SETTINGS is empty")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return doAgentSettings{}, err
	}
	var doc struct {
		Model    string                    `json:"model"`
		Provider map[string]map[string]any `json:"provider"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return doAgentSettings{}, err
	}
	out := doAgentSettings{Model: strings.TrimSpace(doc.Model)}
	for name, provider := range doc.Provider {
		options, _ := provider["options"].(map[string]any)
		if options == nil {
			continue
		}
		out.Provider = name
		out.APIKey, _ = options["apiKey"].(string)
		out.BaseURL, _ = options["baseURL"].(string)
		break
	}
	if out.Provider == "" && out.Model != "" {
		if provider, _, ok := strings.Cut(out.Model, "/"); ok {
			out.Provider = provider
		}
	}
	return out, nil
}

func listProviderModels(settings doAgentSettings) ([]string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(settings.BaseURL), "/")
	if baseURL == "" || settings.APIKey == "" {
		return nil, fmt.Errorf("provider endpoint incomplete")
	}
	req, err := http.NewRequest(http.MethodGet, baseURL+"/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+settings.APIKey)
	client := &http.Client{Timeout: modelListTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("models HTTP %d", resp.StatusCode)
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" {
			continue
		}
		if settings.Provider != "" && !strings.Contains(id, "/") {
			id = settings.Provider + "/" + id
		}
		models = append(models, id)
	}
	if len(models) == 0 {
		return nil, fmt.Errorf("provider returned no models")
	}
	return models, nil
}
