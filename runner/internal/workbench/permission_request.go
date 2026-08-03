package workbench

import (
	"encoding/json"

	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

func permissionRequestFromACP(
	request acp.PermissionRequest,
) *agentworkbenchv2.PermissionRequest {
	permission := &agentworkbenchv2.PermissionRequest{
		PermissionRequestId: request.RequestID,
		State:               agentworkbenchv2.PermissionRequestState_PERMISSION_REQUEST_STATE_PENDING,
	}
	if questions := questionnaireFromArguments(request.ArgumentsJSON); len(questions) > 0 {
		title := request.ToolName
		if title == "" {
			title = "Ask user"
		}
		permission.Request = &agentworkbenchv2.PermissionRequest_Questionnaire{
			Questionnaire: &agentworkbenchv2.PermissionQuestionnaire{
				Title:     title,
				Questions: questions,
			},
		}
		return permission
	}
	permission.Request = &agentworkbenchv2.PermissionRequest_Approval{
		Approval: &agentworkbenchv2.PermissionApproval{
			Title:       request.ToolName,
			Description: stringPointer(request.Description),
		},
	}
	return permission
}

func questionnaireFromArguments(
	argumentsJSON string,
) []*agentworkbenchv2.PermissionQuestion {
	if argumentsJSON == "" {
		return nil
	}
	var payload struct {
		Questions []struct {
			Question    string `json:"question"`
			Header      string `json:"header"`
			MultiSelect bool   `json:"multiSelect"`
			Options     []struct {
				Label       string `json:"label"`
				Description string `json:"description"`
			} `json:"options"`
		} `json:"questions"`
	}
	if err := json.Unmarshal([]byte(argumentsJSON), &payload); err != nil {
		return nil
	}
	questions := make([]*agentworkbenchv2.PermissionQuestion, 0, len(payload.Questions))
	for _, raw := range payload.Questions {
		prompt := raw.Question
		if prompt == "" {
			continue
		}
		options := make([]*agentworkbenchv2.PermissionQuestionOption, 0, len(raw.Options))
		for _, option := range raw.Options {
			if option.Label == "" {
				continue
			}
			item := &agentworkbenchv2.PermissionQuestionOption{Label: option.Label}
			if option.Description != "" {
				item.Description = stringPointer(option.Description)
			}
			options = append(options, item)
		}
		question := &agentworkbenchv2.PermissionQuestion{
			// Claude AskUserQuestion answers are keyed by the question prompt.
			QuestionId:  prompt,
			Prompt:      prompt,
			Options:     options,
			Multiple:    raw.MultiSelect,
			AllowCustom: true,
		}
		if raw.Header != "" {
			question.Header = stringPointer(raw.Header)
		}
		questions = append(questions, question)
	}
	return questions
}
