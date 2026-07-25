package airesource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
)

const modelListResponseLimit = 2 << 20

type HTTPModelLister struct{ client HTTPDoer }

func NewHTTPModelLister(client HTTPDoer) (*HTTPModelLister, error) {
	if client == nil {
		return nil, fmt.Errorf("HTTP client is required")
	}
	return &HTTPModelLister{client: client}, nil
}

func (lister *HTTPModelLister) List(ctx context.Context, input ListModelsInput) ([]domain.DiscoveredModel, error) {
	request, err := newCheckRequest(ctx, input.BaseURL, input.Provider.ConnectionCheck, input.Credentials)
	if err != nil {
		return nil, err
	}
	response, err := lister.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: provider request failed", ErrDiscovery)
	}
	defer response.Body.Close()
	if err := checkResponseError(input.Provider.Key.String(), response.StatusCode); err != nil {
		return nil, err
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, modelListResponseLimit))
	if err != nil {
		return nil, fmt.Errorf("%w: provider response unreadable", ErrDiscovery)
	}
	return parseModelList(input.Shape, body)
}

type openAIModelList struct {
	Data []struct {
		ID          string `json:"id"`
		DisplayName string `json:"display_name"`
	} `json:"data"`
}

type geminiModelList struct {
	Models []struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
	} `json:"models"`
}

func parseModelList(shape domain.ModelListShape, body []byte) ([]domain.DiscoveredModel, error) {
	switch shape {
	case domain.ModelListShapeOpenAI, domain.ModelListShapeAnthropic:
		var payload openAIModelList
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, fmt.Errorf("%w: provider model list is not %s-shaped", ErrDiscovery, shape)
		}
		models := make([]domain.DiscoveredModel, 0, len(payload.Data))
		for _, entry := range payload.Data {
			models = appendDiscovered(models, entry.ID, entry.DisplayName)
		}
		return models, nil
	case domain.ModelListShapeGemini:
		var payload geminiModelList
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, fmt.Errorf("%w: provider model list is not %s-shaped", ErrDiscovery, shape)
		}
		models := make([]domain.DiscoveredModel, 0, len(payload.Models))
		for _, entry := range payload.Models {
			models = appendDiscovered(models, strings.TrimPrefix(entry.Name, "models/"), entry.DisplayName)
		}
		return models, nil
	default:
		return nil, ErrDiscoveryUnsupported
	}
}

func appendDiscovered(models []domain.DiscoveredModel, modelID, displayName string) []domain.DiscoveredModel {
	modelID = strings.TrimSpace(modelID)
	if modelID == "" {
		return models
	}
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		displayName = modelID
	}
	return append(models, domain.DiscoveredModel{ModelID: modelID, DisplayName: displayName})
}
