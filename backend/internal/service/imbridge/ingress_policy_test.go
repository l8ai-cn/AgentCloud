package imbridge

import (
	"encoding/json"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"github.com/stretchr/testify/require"
)

func groupEvent() *InboundEvent {
	return &InboundEvent{
		ExternalThreadID: "chat-1",
		ExternalUserID:   "user-1",
		SenderName:       "Alice",
		Text:             "hello",
	}
}

func allowlistConnection(allowFrom string) *domain.Connection {
	return &domain.Connection{
		GroupPolicy: domain.GroupPolicyAllowlist,
		AllowFrom:   json.RawMessage(allowFrom),
	}
}

func TestGroupPolicyRejectsUnknownGroupWithEmptyAllowlist(t *testing.T) {
	b := newTestBridge(&fakeRepository{})
	require.ErrorIs(t, b.checkGroupPolicy(t.Context(), allowlistConnection(`[]`), groupEvent()), ErrUnauthorized)
}

func TestGroupPolicyAllowsListedThreadOrSender(t *testing.T) {
	b := newTestBridge(&fakeRepository{})
	require.NoError(t, b.checkGroupPolicy(t.Context(), allowlistConnection(`["chat-1"]`), groupEvent()))
	require.NoError(t, b.checkGroupPolicy(t.Context(), allowlistConnection(`["user-1"]`), groupEvent()))
	require.NoError(t, b.checkGroupPolicy(t.Context(), allowlistConnection(`["user:Alice"]`), groupEvent()))
	require.NoError(t, b.checkGroupPolicy(t.Context(), allowlistConnection(`["*"]`), groupEvent()))
}

func TestGroupPolicyAllowsOperatorConfiguredDestinations(t *testing.T) {
	channelID := int64(7)
	pinned := allowlistConnection(`[]`)
	pinned.ChannelID = &channelID
	require.NoError(t, newTestBridge(&fakeRepository{}).checkGroupPolicy(t.Context(), pinned, groupEvent()))

	mapped := &fakeRepository{threadMapping: &domain.ThreadMapping{ExternalThreadID: "chat-1"}}
	require.NoError(t, newTestBridge(mapped).checkGroupPolicy(t.Context(), allowlistConnection(`[]`), groupEvent()))
}

func TestGroupPolicyDirectMessagesBypassGroupRules(t *testing.T) {
	dm := &InboundEvent{ExternalThreadID: "user-1", ExternalUserID: "user-1"}
	conn := allowlistConnection(`[]`)
	conn.GroupPolicy = domain.GroupPolicyDisabled
	require.NoError(t, newTestBridge(&fakeRepository{}).checkGroupPolicy(t.Context(), conn, dm))
}

func TestResolveRoutePrefersExplicitMentionOverStickyTarget(t *testing.T) {
	sticky := "coder"
	mapping := &domain.ThreadMapping{ActiveTargetRef: &sticky}
	b := newTestBridge(&fakeRepository{})

	mentioned := "@reviewer take a look"
	route, err := b.resolveRoute(t.Context(), &domain.Connection{}, &InboundEvent{Text: mentioned}, mapping)
	require.NoError(t, err)
	require.Equal(t, "reviewer", route.TargetRef)
	require.Equal(t, mentioned, applyRouteMention(mentioned, route))

	route, err = b.resolveRoute(t.Context(), &domain.Connection{}, &InboundEvent{Text: "ping"}, mapping)
	require.NoError(t, err)
	require.Equal(t, sticky, route.TargetRef)
}

func TestResolveChannelPersistsPeerKind(t *testing.T) {
	repo := &fakeRepository{threadMapping: &domain.ThreadMapping{
		ChannelID: 9,
		PeerKind:  domain.PeerGroup,
	}}
	dm := &InboundEvent{ExternalThreadID: "user-1", ExternalUserID: "user-1"}

	channelID, err := newTestBridge(repo).resolveChannel(t.Context(), &domain.Connection{}, dm)
	require.NoError(t, err)
	require.Equal(t, int64(9), channelID)
	require.Len(t, repo.upserted, 1)
	require.Equal(t, domain.PeerDirect, repo.upserted[0].PeerKind)
}
