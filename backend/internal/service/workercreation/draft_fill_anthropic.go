package workercreation

import (
	"context"
	"fmt"
	"strings"

	resourceservice "github.com/l8ai-cn/agentcloud/backend/internal/service/airesource"
)

// Temperature is omitted for the same reason as the OpenAI-compatible request:
// models with extended thinking enabled only accept 1.
type anthropicDraftFillRequest struct {
	Model     string                   `json:"model"`
	MaxTokens uint32                   `json:"max_tokens"`
	System    string                   `json:"system"`
	Messages  []openAIDraftFillMessage `json:"messages"`
}

type anthropicDraftFillResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func (generator *ProviderDraftGenerator) generateAnthropic(
	ctx context.Context,
	resource *resourceservice.ResolvedResource,
	apiKey, systemPrompt, userPrompt string,
) ([]byte, error) {
	requestURL, err := joinDraftFillURL(
		resource.Connection.BaseURL,
		"v1",
		"messages",
	)
	if err != nil {
		return nil, err
	}
	body, err := generator.postJSON(
		ctx,
		requestURL,
		map[string]string{
			"x-api-key":         apiKey,
			"anthropic-version": "2023-06-01",
		},
		anthropicDraftFillRequest{
			Model:     resource.Resource.ModelID,
			MaxTokens: 2048,
			System:    systemPrompt,
			Messages: []openAIDraftFillMessage{{
				Role: "user", Content: userPrompt,
			}},
		},
	)
	if err != nil {
		return nil, err
	}
	var response anthropicDraftFillResponse
	if err := decodeProviderResponse(body, &response); err != nil {
		return nil, err
	}
	var content strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			content.WriteString(block.Text)
		}
	}
	result := strings.TrimSpace(content.String())
	if result == "" {
		return nil, fmt.Errorf("worker draft fill provider response has no content")
	}
	return []byte(result), nil
}
