package grpc

import (
	"context"
	"log/slog"
	"time"

	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (s *GRPCCommandSender) SendUpdatePodSkills(
	ctx context.Context,
	runnerID int64,
	podKey string,
	add []*runnerv1.ResourceToDownload,
	removeTargetPaths []string,
) error {
	if err := s.adapter.SendUpdatePodSkills(runnerID, podKey, add, removeTargetPaths); err != nil {
		slog.ErrorContext(ctx, "failed to send update_pod_skills command",
			"runner_id", runnerID, "pod_key", podKey, "error", err)
		return err
	}
	return nil
}

func (a *GRPCRunnerAdapter) SendUpdatePodSkills(
	runnerID int64,
	podKey string,
	add []*runnerv1.ResourceToDownload,
	removeTargetPaths []string,
) error {
	conn := a.connManager.GetConnection(runnerID)
	if conn == nil {
		return status.Errorf(codes.NotFound, "runner %d not connected", runnerID)
	}
	msg := &runnerv1.ServerMessage{
		Payload: &runnerv1.ServerMessage_UpdatePodSkills{
			UpdatePodSkills: &runnerv1.UpdatePodSkillsCommand{
				PodKey:            podKey,
				Add:               add,
				RemoveTargetPaths: removeTargetPaths,
			},
		},
		Timestamp: time.Now().UnixMilli(),
	}
	return conn.SendMessage(msg)
}
