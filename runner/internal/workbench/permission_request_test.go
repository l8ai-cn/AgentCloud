package workbench

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/stretchr/testify/require"
)

func TestPermissionRequestFromACP_AskUserQuestionQuestionnaire(t *testing.T) {
	permission := permissionRequestFromACP(acp.PermissionRequest{
		RequestID: "ask-1",
		ToolName:  "AskUserQuestion",
		ArgumentsJSON: `{
			"questions": [{
				"question": "Which database?",
				"header": "DB",
				"multiSelect": false,
				"options": [
					{"label": "PostgreSQL", "description": "Managed SQL"},
					{"label": "MySQL"}
				]
			}]
		}`,
	})

	require.Equal(t, "ask-1", permission.PermissionRequestId)
	questionnaire := permission.GetQuestionnaire()
	require.NotNil(t, questionnaire)
	require.Equal(t, "AskUserQuestion", questionnaire.Title)
	require.Len(t, questionnaire.Questions, 1)
	question := questionnaire.Questions[0]
	require.Equal(t, "Which database?", question.QuestionId)
	require.Equal(t, "Which database?", question.Prompt)
	require.Equal(t, "DB", question.GetHeader())
	require.True(t, question.AllowCustom)
	require.False(t, question.Multiple)
	require.Len(t, question.Options, 2)
	require.Equal(t, "PostgreSQL", question.Options[0].Label)
	require.Equal(t, "Managed SQL", question.Options[0].GetDescription())
}

func TestPermissionRequestFromACP_FallsBackToApproval(t *testing.T) {
	permission := permissionRequestFromACP(acp.PermissionRequest{
		RequestID:     "edit-1",
		ToolName:      "Edit",
		Description:   "Tool: edit-1",
		ArgumentsJSON: `{"file_path":"/tmp/a.go"}`,
	})

	require.Nil(t, permission.GetQuestionnaire())
	approval := permission.GetApproval()
	require.NotNil(t, approval)
	require.Equal(t, "Edit", approval.Title)
	require.Equal(t, "Tool: edit-1", approval.GetDescription())
}

func TestMapperPermissionProjectsQuestionnaire(t *testing.T) {
	mapper := NewMapper("pod-1", "claude")
	batch := mapper.Permission(acp.PermissionRequest{
		SessionID: "session-1",
		RequestID: "ask-2",
		ToolName:  "AskUserQuestion",
		ArgumentsJSON: `{"questions":[{"question":"Ship it?","options":[{"label":"Yes"},{"label":"No"}]}]}`,
	})

	require.Len(t, batch.GetMutations(), 1)
	request := batch.GetMutations()[0].GetPermissionRequest()
	require.NotNil(t, request)
	require.NotNil(t, request.GetQuestionnaire())
	require.Equal(t, "Ship it?", request.GetQuestionnaire().Questions[0].QuestionId)
}
