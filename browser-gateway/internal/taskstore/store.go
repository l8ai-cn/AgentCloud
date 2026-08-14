package taskstore

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type Driver string

const (
	DriverUnconfigured Driver = "unconfigured"
	DriverStub         Driver = "stub"
)

func ParseDriver(raw string) (Driver, error) {
	switch Driver(raw) {
	case "", DriverUnconfigured:
		return DriverUnconfigured, nil
	case DriverStub:
		return DriverStub, nil
	default:
		return "", fmt.Errorf("unknown BROWSER_GATEWAY_DRIVER %q", raw)
	}
}

type Task struct {
	ID          string         `json:"task_id"`
	ServiceType string         `json:"service_type"`
	Status      string         `json:"status"`
	Progress    int            `json:"progress"`
	Result      map[string]any `json:"result"`
	Error       string         `json:"error"`
	ThreadID    string         `json:"thread_id"`
	UserID      string         `json:"user_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type Job struct {
	ThreadID    string
	UserID      string
	AgentType   string
	BookingData []byte
	Username    string
	Password    string
}

type Store struct {
	driver Driver
	slots  chan struct{}
	mu     sync.Mutex
	tasks  map[string]*Task
}

func New(concurrency int, driver Driver) *Store {
	if concurrency < 1 {
		concurrency = 3
	}
	return &Store{
		driver: driver,
		slots:  make(chan struct{}, concurrency),
		tasks:  make(map[string]*Task),
	}
}

func (s *Store) Create(job Job) *Task {
	now := time.Now().UTC()
	task := &Task{
		ID:          newTaskID(now),
		ServiceType: "vehicle_booking",
		Status:      "queued",
		ThreadID:    job.ThreadID,
		UserID:      job.UserID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()
	go s.run(task.ID, job)
	return s.clone(task)
}

func (s *Store) Get(id string) (*Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.tasks[id]
	if !ok {
		return nil, false
	}
	return s.clone(task), true
}

func (s *Store) run(id string, job Job) {
	s.slots <- struct{}{}
	defer func() { <-s.slots }()
	s.patch(id, "processing", 10, nil, "")
	_ = job
	switch s.driver {
	case DriverStub:
		s.patch(id, "completed", 100, map[string]any{
			"success":    true,
			"booking_id": "stub-" + id,
			"message":    "stub driver completed without a browser",
		}, "")
	default:
		s.patch(id, "failed", 100, nil, "browser_unconfigured: attach a browser pool before submit")
	}
}

func (s *Store) patch(id, status string, progress int, result map[string]any, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.tasks[id]
	if !ok {
		return
	}
	task.Status = status
	task.Progress = progress
	task.Result = result
	task.Error = errMsg
	task.UpdatedAt = time.Now().UTC()
}

func (s *Store) clone(task *Task) *Task {
	copied := *task
	if task.Result != nil {
		copied.Result = make(map[string]any, len(task.Result))
		for k, v := range task.Result {
			copied.Result[k] = v
		}
	}
	return &copied
}

func newTaskID(now time.Time) string {
	var buf [3]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return fmt.Sprintf("task_%s_%d", now.Format("20060102_150405"), now.UnixNano())
	}
	return fmt.Sprintf("task_%s_%s", now.Format("20060102_150405"), hex.EncodeToString(buf[:]))
}
