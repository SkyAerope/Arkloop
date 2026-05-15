//go:build !desktop

package pipeline

import (
	"context"
	"testing"

	"arkloop/services/worker/internal/tools"
)

func TestChannelQQToolsMiddlewareGroupAlwaysRemovesConversationSearch(t *testing.T) {
	for _, channelType := range []string{"qq", "qqbot"} {
		t.Run(channelType, func(t *testing.T) {
			rc := &RunContext{
				ChannelContext: &ChannelContext{
					ChannelType:      channelType,
					ConversationType: "group",
				},
				ToolRegistry:  tools.NewRegistry(),
				ToolExecutors: map[string]tools.Executor{},
				AllowlistSet: map[string]struct{}{
					"conversation_search":  {},
					"conversation_context": {},
				},
			}

			h := Build([]RunMiddleware{
				NewChannelQQToolsMiddleware(ChannelQQToolsDeps{}),
			}, func(_ context.Context, rc *RunContext) error {
				if _, ok := rc.AllowlistSet["conversation_search"]; ok {
					t.Fatal("conversation_search should be removed in group chat")
				}
				if _, ok := rc.AllowlistSet["conversation_context"]; !ok {
					t.Fatal("conversation_context should remain available for current thread")
				}
				return nil
			})

			if err := h(context.Background(), rc); err != nil {
				t.Fatalf("handler: %v", err)
			}
		})
	}
}
