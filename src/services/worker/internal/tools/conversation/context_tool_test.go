package conversation

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestBuildExpandItemsPreservesContextOrder(t *testing.T) {
	repl := contextReplacement{
		ID:              uuid.New(),
		StartContextSeq: 2,
		EndContextSeq:   3,
		SummaryText:     "middle summary",
		Layer:           2,
		CreatedAt:       time.Unix(2, 0),
	}
	chunks := []contextChunk{
		{ID: uuid.New(), ContextSeq: 4, ChunkSeq: 4, ChunkKind: "payload", PayloadText: "after", CreatedAt: time.Unix(4, 0)},
		{ID: uuid.New(), ContextSeq: 1, ChunkSeq: 1, ChunkKind: "payload", PayloadText: "before", CreatedAt: time.Unix(1, 0)},
	}

	items, truncated := buildExpandItems([]contextReplacement{repl}, chunks, 1000)
	if truncated {
		t.Fatal("expected untruncated result")
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
	if items[0]["kind"] != "chunk" || items[0]["context_seq"] != int64(1) {
		t.Fatalf("unexpected first item: %#v", items[0])
	}
	if items[1]["kind"] != "summary" || items[1]["start_context_seq"] != int64(2) {
		t.Fatalf("unexpected second item: %#v", items[1])
	}
	if items[2]["kind"] != "chunk" || items[2]["context_seq"] != int64(4) {
		t.Fatalf("unexpected third item: %#v", items[2])
	}
}
