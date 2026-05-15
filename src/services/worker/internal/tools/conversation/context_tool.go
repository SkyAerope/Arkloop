package conversation

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"arkloop/services/worker/internal/tools"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	errorContextIdentityMissing = "tool.conversation_context_identity_missing"
	errorContextArgsInvalid     = "tool.conversation_context_args_invalid"
	errorContextUnavailable     = "tool.conversation_context_unavailable"
	errorContextFailed          = "tool.conversation_context_failed"

	defaultContextTokenCap = 3000
	maxContextTokenCap     = 12000
)

type contextReplacement struct {
	ID              uuid.UUID
	StartThreadSeq  int64
	EndThreadSeq    int64
	StartContextSeq int64
	EndContextSeq   int64
	SummaryText     string
	Layer           int
	SupersededAt    *time.Time
	CreatedAt       time.Time
}

type contextChunk struct {
	ID          uuid.UUID
	ContextSeq  int64
	ChunkSeq    int64
	ChunkKind   string
	PayloadText string
	CreatedAt   time.Time
}

type contextExpandItem struct {
	kind        string
	replacement *contextReplacement
	chunk       *contextChunk
}

func executeContextTool(ctx context.Context, args map[string]any, execCtx tools.ExecutionContext, started time.Time, db contextDB) tools.ExecutionResult {
	if execCtx.AccountID == nil || execCtx.ThreadID == nil {
		return executionError(errorContextIdentityMissing, "account_id and thread_id are required", started)
	}
	if db == nil {
		return executionError(errorContextUnavailable, "conversation context database not available", started)
	}
	action, ok := args["action"].(string)
	if !ok || strings.TrimSpace(action) == "" {
		return executionError(errorContextArgsInvalid, "action must be status, search, describe, or expand", started)
	}

	tx, err := db.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return executionError(errorContextFailed, fmt.Sprintf("open context transaction failed: %s", err.Error()), started)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	accountID := *execCtx.AccountID
	threadID := *execCtx.ThreadID
	var result map[string]any
	switch strings.TrimSpace(action) {
	case "status":
		result, err = conversationContextStatus(ctx, tx, accountID, threadID)
	case "search":
		query, _ := args["query"].(string)
		scope, _ := args["scope"].(string)
		result, err = conversationContextSearch(ctx, tx, accountID, threadID, query, scope, parseLimit(args, defaultLimit))
	case "describe":
		replacementID, parseErr := parseReplacementID(args)
		if parseErr != nil {
			return executionError(errorContextArgsInvalid, parseErr.Error(), started)
		}
		result, err = conversationContextDescribe(ctx, tx, accountID, threadID, replacementID)
	case "expand":
		replacementID, parseErr := parseReplacementID(args)
		if parseErr != nil {
			return executionError(errorContextArgsInvalid, parseErr.Error(), started)
		}
		result, err = conversationContextExpand(ctx, tx, accountID, threadID, replacementID, parseTokenCap(args))
	default:
		return executionError(errorContextArgsInvalid, "action must be status, search, describe, or expand", started)
	}
	if err != nil {
		return executionError(errorContextFailed, err.Error(), started)
	}
	return tools.ExecutionResult{ResultJSON: result, DurationMs: durationMs(started)}
}

func conversationContextStatus(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID) (map[string]any, error) {
	activeReplacements, err := countThreadRows(ctx, tx, `thread_context_replacements`, accountID, threadID, ` AND superseded_at IS NULL`)
	if err != nil {
		return nil, err
	}
	totalReplacements, err := countThreadRows(ctx, tx, `thread_context_replacements`, accountID, threadID, ``)
	if err != nil {
		return nil, err
	}
	chunks, err := countThreadRows(ctx, tx, `thread_context_chunks`, accountID, threadID, ``)
	if err != nil {
		return nil, err
	}
	edges, err := countThreadRows(ctx, tx, `replacement_supersession_edges`, accountID, threadID, ``)
	if err != nil {
		return nil, err
	}
	var latestContextSeq int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(context_seq), 0) FROM thread_context_chunks WHERE account_id = $1 AND thread_id = $2`, accountID, threadID).Scan(&latestContextSeq); err != nil {
		return nil, err
	}
	return map[string]any{
		"thread_id":           threadID.String(),
		"active_replacements": activeReplacements,
		"total_replacements":  totalReplacements,
		"context_chunks":      chunks,
		"supersession_edges":  edges,
		"latest_context_seq":  latestContextSeq,
	}, nil
}

func conversationContextSearch(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, query string, scope string, limit int) (map[string]any, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, fmt.Errorf("query must be a non-empty string")
	}
	scope = strings.TrimSpace(scope)
	if scope == "" {
		scope = "both"
	}
	if scope != "summaries" && scope != "chunks" && scope != "both" {
		return nil, fmt.Errorf("scope must be summaries, chunks, or both")
	}

	result := map[string]any{
		"thread_id": threadID.String(),
		"query":     query,
	}
	like := "%" + escapeLikePattern(query) + "%"
	if scope == "summaries" || scope == "both" {
		replacements, err := searchReplacements(ctx, tx, accountID, threadID, like, limit)
		if err != nil {
			return nil, err
		}
		summaries := make([]map[string]any, 0, len(replacements))
		for _, item := range replacements {
			payload := replacementPayload(item)
			payload["summary"] = truncateRunes(item.SummaryText, contentMaxRunes)
			summaries = append(summaries, payload)
		}
		result["summaries"] = summaries
	}
	if scope == "chunks" || scope == "both" {
		chunks, err := searchChunks(ctx, tx, accountID, threadID, like, limit)
		if err != nil {
			return nil, err
		}
		items := make([]map[string]any, 0, len(chunks))
		for _, item := range chunks {
			payload := chunkPayload(item)
			payload["content"] = truncateRunes(strings.TrimSpace(item.PayloadText), contentMaxRunes)
			items = append(items, payload)
		}
		result["chunks"] = items
	}
	return result, nil
}

func conversationContextDescribe(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, replacementID uuid.UUID) (map[string]any, error) {
	replacement, err := getReplacement(ctx, tx, accountID, threadID, replacementID)
	if err != nil {
		return nil, err
	}
	childReplacements, childChunks, err := loadDirectChildren(ctx, tx, accountID, threadID, replacementID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"replacement": replacementWithSummaryPayload(replacement, contentMaxRunes),
		"children": map[string]any{
			"replacements": replacementListPayload(childReplacements, contentMaxRunes),
			"chunks":       chunkListPayload(childChunks, contentMaxRunes),
		},
	}, nil
}

func conversationContextExpand(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, replacementID uuid.UUID, tokenCap int) (map[string]any, error) {
	replacement, err := getReplacement(ctx, tx, accountID, threadID, replacementID)
	if err != nil {
		return nil, err
	}
	childReplacements, childChunks, err := loadDirectChildren(ctx, tx, accountID, threadID, replacementID)
	if err != nil {
		return nil, err
	}
	source := "supersession_edges"
	if len(childReplacements) == 0 && len(childChunks) == 0 {
		childChunks, err = loadChunksByReplacementRange(ctx, tx, accountID, threadID, replacement)
		if err != nil {
			return nil, err
		}
		source = "context_seq_range"
	}

	items, truncated := buildExpandItems(childReplacements, childChunks, tokenCap)
	return map[string]any{
		"replacement": replacementPayload(replacement),
		"source":      source,
		"token_cap":   tokenCap,
		"truncated":   truncated,
		"items":       items,
	}, nil
}

func buildExpandItems(replacements []contextReplacement, chunks []contextChunk, tokenCap int) ([]map[string]any, bool) {
	merged := make([]contextExpandItem, 0, len(replacements)+len(chunks))
	for i := range replacements {
		merged = append(merged, contextExpandItem{kind: "summary", replacement: &replacements[i]})
	}
	for i := range chunks {
		merged = append(merged, contextExpandItem{kind: "chunk", chunk: &chunks[i]})
	}
	sortExpandItems(merged)

	budget := tokenCap
	truncated := false
	out := make([]map[string]any, 0, len(merged))
	for _, item := range merged {
		if budget <= 0 {
			truncated = true
			break
		}
		switch item.kind {
		case "summary":
			payload := replacementPayload(*item.replacement)
			payload["kind"] = "summary"
			payload["summary"] = consumeBudgetedText(item.replacement.SummaryText, &budget, &truncated)
			out = append(out, payload)
		case "chunk":
			payload := chunkPayload(*item.chunk)
			payload["kind"] = "chunk"
			payload["content"] = consumeBudgetedText(item.chunk.PayloadText, &budget, &truncated)
			out = append(out, payload)
		}
	}
	return out, truncated
}

func countThreadRows(ctx context.Context, tx pgx.Tx, table string, accountID uuid.UUID, threadID uuid.UUID, suffix string) (int64, error) {
	var count int64
	query := fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE account_id = $1 AND thread_id = $2%s`, table, suffix)
	if err := tx.QueryRow(ctx, query, accountID, threadID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func searchReplacements(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, like string, limit int) ([]contextReplacement, error) {
	rows, err := tx.Query(ctx, replacementSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND summary_text ILIKE $3 ESCAPE '!'
		  ORDER BY CASE WHEN superseded_at IS NULL THEN 0 ELSE 1 END ASC, created_at DESC, id DESC
		  LIMIT $4`), accountID, threadID, like, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanReplacements(rows)
}

func searchChunks(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, like string, limit int) ([]contextChunk, error) {
	rows, err := tx.Query(ctx, chunkSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND payload_text ILIKE $3 ESCAPE '!'
		  ORDER BY context_seq DESC, id DESC
		  LIMIT $4`), accountID, threadID, like, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanChunks(rows)
}

func getReplacement(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, replacementID uuid.UUID) (contextReplacement, error) {
	rows, err := tx.Query(ctx, replacementSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND id = $3
		  LIMIT 1`), accountID, threadID, replacementID)
	if err != nil {
		return contextReplacement{}, err
	}
	defer rows.Close()
	replacements, err := scanReplacements(rows)
	if err != nil {
		return contextReplacement{}, err
	}
	if len(replacements) == 0 {
		return contextReplacement{}, fmt.Errorf("replacement_id not found in current thread")
	}
	return replacements[0], nil
}

func loadDirectChildren(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, replacementID uuid.UUID) ([]contextReplacement, []contextChunk, error) {
	replacementRows, err := tx.Query(ctx, replacementSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND id IN (
		      SELECT superseded_replacement_id
		        FROM replacement_supersession_edges
		       WHERE account_id = $1
		         AND thread_id = $2
		         AND replacement_id = $3
		         AND superseded_replacement_id IS NOT NULL
		    )
		  ORDER BY start_context_seq ASC, created_at ASC, id ASC`), accountID, threadID, replacementID)
	if err != nil {
		return nil, nil, err
	}
	defer replacementRows.Close()
	replacements, err := scanReplacements(replacementRows)
	if err != nil {
		return nil, nil, err
	}

	chunkRows, err := tx.Query(ctx, chunkSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND id IN (
		      SELECT superseded_chunk_id
		        FROM replacement_supersession_edges
		       WHERE account_id = $1
		         AND thread_id = $2
		         AND replacement_id = $3
		         AND superseded_chunk_id IS NOT NULL
		    )
		  ORDER BY context_seq ASC, id ASC`), accountID, threadID, replacementID)
	if err != nil {
		return nil, nil, err
	}
	defer chunkRows.Close()
	chunks, err := scanChunks(chunkRows)
	if err != nil {
		return nil, nil, err
	}
	return replacements, chunks, nil
}

func loadChunksByReplacementRange(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, threadID uuid.UUID, replacement contextReplacement) ([]contextChunk, error) {
	rows, err := tx.Query(ctx, chunkSelectSQL(`
		  WHERE account_id = $1
		    AND thread_id = $2
		    AND context_seq >= $3
		    AND context_seq <= $4
		  ORDER BY context_seq ASC, id ASC`), accountID, threadID, replacement.StartContextSeq, replacement.EndContextSeq)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanChunks(rows)
}

func replacementSelectSQL(suffix string) string {
	return `SELECT id, start_thread_seq, end_thread_seq, start_context_seq, end_context_seq,
	              summary_text, layer, superseded_at, created_at
	         FROM thread_context_replacements` + suffix
}

func chunkSelectSQL(suffix string) string {
	return `SELECT id, context_seq, chunk_seq, chunk_kind, payload_text, created_at
	         FROM thread_context_chunks` + suffix
}

func scanReplacements(rows pgx.Rows) ([]contextReplacement, error) {
	out := make([]contextReplacement, 0)
	for rows.Next() {
		var item contextReplacement
		if err := rows.Scan(
			&item.ID,
			&item.StartThreadSeq,
			&item.EndThreadSeq,
			&item.StartContextSeq,
			&item.EndContextSeq,
			&item.SummaryText,
			&item.Layer,
			&item.SupersededAt,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.SummaryText = strings.TrimSpace(item.SummaryText)
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func scanChunks(rows pgx.Rows) ([]contextChunk, error) {
	out := make([]contextChunk, 0)
	for rows.Next() {
		var item contextChunk
		if err := rows.Scan(&item.ID, &item.ContextSeq, &item.ChunkSeq, &item.ChunkKind, &item.PayloadText, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.ChunkKind = strings.TrimSpace(item.ChunkKind)
		item.PayloadText = strings.TrimSpace(item.PayloadText)
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func replacementPayload(item contextReplacement) map[string]any {
	return map[string]any{
		"replacement_id":    item.ID.String(),
		"active":            item.SupersededAt == nil,
		"layer":             item.Layer,
		"start_thread_seq":  item.StartThreadSeq,
		"end_thread_seq":    item.EndThreadSeq,
		"start_context_seq": item.StartContextSeq,
		"end_context_seq":   item.EndContextSeq,
		"created_at":        item.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func replacementWithSummaryPayload(item contextReplacement, maxRunes int) map[string]any {
	payload := replacementPayload(item)
	payload["summary"] = truncateRunes(item.SummaryText, maxRunes)
	return payload
}

func replacementListPayload(items []contextReplacement, maxRunes int) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, replacementWithSummaryPayload(item, maxRunes))
	}
	return out
}

func chunkPayload(item contextChunk) map[string]any {
	return map[string]any{
		"chunk_id":    item.ID.String(),
		"context_seq": item.ContextSeq,
		"chunk_seq":   item.ChunkSeq,
		"chunk_kind":  item.ChunkKind,
		"created_at":  item.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func chunkListPayload(items []contextChunk, maxRunes int) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		payload := chunkPayload(item)
		payload["content"] = truncateRunes(item.PayloadText, maxRunes)
		out = append(out, payload)
	}
	return out
}

func sortExpandItems(items []contextExpandItem) {
	sort.SliceStable(items, func(i, j int) bool {
		iStart, iEnd := expandItemContextRange(items[i])
		jStart, jEnd := expandItemContextRange(items[j])
		if iStart != jStart {
			return iStart < jStart
		}
		if iEnd != jEnd {
			return iEnd < jEnd
		}
		if items[i].kind != items[j].kind {
			return items[i].kind == "summary"
		}
		return expandItemID(items[i]) < expandItemID(items[j])
	})
}

func expandItemContextRange(item contextExpandItem) (int64, int64) {
	if item.replacement != nil {
		return item.replacement.StartContextSeq, item.replacement.EndContextSeq
	}
	if item.chunk != nil {
		return item.chunk.ContextSeq, item.chunk.ContextSeq
	}
	return 0, 0
}

func expandItemID(item contextExpandItem) string {
	if item.replacement != nil {
		return item.replacement.ID.String()
	}
	if item.chunk != nil {
		return item.chunk.ID.String()
	}
	return ""
}

func parseReplacementID(args map[string]any) (uuid.UUID, error) {
	raw, ok := args["replacement_id"].(string)
	if !ok || strings.TrimSpace(raw) == "" {
		return uuid.Nil, fmt.Errorf("replacement_id must be a non-empty UUID string")
	}
	id, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil {
		return uuid.Nil, fmt.Errorf("replacement_id must be a valid UUID")
	}
	return id, nil
}

func parseTokenCap(args map[string]any) int {
	cap := defaultContextTokenCap
	switch v := args["token_cap"].(type) {
	case float64:
		cap = int(v)
	case int:
		cap = v
	case int64:
		cap = int(v)
	case json.Number:
		if n, err := v.Int64(); err == nil {
			cap = int(n)
		}
	}
	if cap < 256 {
		return 256
	}
	if cap > maxContextTokenCap {
		return maxContextTokenCap
	}
	return cap
}

func consumeBudgetedText(value string, budget *int, truncated *bool) string {
	text := strings.TrimSpace(value)
	if text == "" || budget == nil || *budget <= 0 {
		if truncated != nil && text != "" {
			*truncated = true
		}
		return ""
	}
	maxRunes := *budget * 4
	runeCount := utf8.RuneCountInString(text)
	if runeCount > maxRunes {
		runes := []rune(text)
		text = string(runes[:maxRunes]) + "..."
		if truncated != nil {
			*truncated = true
		}
		*budget = 0
		return text
	}
	*budget -= approxTokensFromRunes(runeCount)
	return text
}

func approxTokensFromRunes(runes int) int {
	if runes <= 0 {
		return 0
	}
	return (runes + 3) / 4
}

func escapeLikePattern(value string) string {
	replacer := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_")
	return replacer.Replace(strings.TrimSpace(value))
}
