package runner

import (
	"sync"

	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
	"github.com/l8ai-cn/agentcloud/runner/internal/client"
	"github.com/l8ai-cn/agentcloud/runner/internal/logger"
	"github.com/l8ai-cn/agentcloud/runner/internal/workbench"
)

type podWorkbenchForwarder struct {
	podKey          string
	workDir         string
	mapper          *workbench.Mapper
	observer        *workbench.ArtifactObserver
	sender          client.ConnectionSender
	convertOffice   officePreviewConverter
	artifactMu      sync.Mutex
	previewMu       sync.Mutex
	converting      map[string]struct{}
	latestRevision  map[string]uint64
	activeCommandID string
}

func newPodWorkbenchForwarder(
	podKey, adapterID, workDir string,
	sender client.ConnectionSender,
) (*podWorkbenchForwarder, error) {
	observer, err := workbench.NewArtifactObserver(workDir)
	if err != nil {
		return nil, err
	}
	return &podWorkbenchForwarder{
		podKey:         podKey,
		workDir:        workDir,
		mapper:         workbench.NewMapper(podKey, adapterID),
		observer:       observer,
		sender:         sender,
		convertOffice:  convertOfficePreview,
		converting:     make(map[string]struct{}),
		latestRevision: make(map[string]uint64),
	}, nil
}

func (f *podWorkbenchForwarder) scanArtifacts() {
	f.artifactMu.Lock()
	defer f.artifactMu.Unlock()
	artifacts, err := f.observer.Scan()
	if err != nil {
		f.send(f.mapper.Unsupported("artifact.scan.error", map[string]string{
			"error": err.Error(),
		}))
		return
	}
	f.send(f.mapper.Artifacts(artifacts))
	for _, artifact := range artifacts {
		f.recordArtifactRevision(artifact)
		f.queueOfficePreview(artifact)
	}
}

func (f *podWorkbenchForwarder) log(level, message string) {
	f.send(f.mapper.Log(level, message))
}

func (f *podWorkbenchForwarder) setActiveCommandID(commandID string) {
	f.previewMu.Lock()
	f.activeCommandID = commandID
	f.previewMu.Unlock()
}

func (f *podWorkbenchForwarder) currentCommandID() string {
	f.previewMu.Lock()
	defer f.previewMu.Unlock()
	return f.activeCommandID
}

func (f *podWorkbenchForwarder) send(
	batch *agentworkbenchv2.RunnerWorkbenchEventBatch,
) {
	if batch == nil || batch.GetPodKey() == "" {
		return
	}
	if err := f.sender.SendMessage(&runnerv1.RunnerMessage{
		Payload: &runnerv1.RunnerMessage_WorkbenchEvents{
			WorkbenchEvents: batch,
		},
	}); err != nil {
		logger.Pod().Error(
			"failed to send workbench events",
			"pod_key",
			f.podKey,
			"error",
			err,
		)
	}
}
