package conversation

import (
	sharedtoolmeta "arkloop/services/shared/toolmeta"
	"arkloop/services/worker/internal/llm"
	"arkloop/services/worker/internal/tools"
)

func stringPtr(s string) *string { return &s }

var SearchAgentSpec = tools.AgentToolSpec{
	Name:        "conversation_search",
	Version:     "1",
	Description: "search visible conversation history for the current user",
	RiskLevel:   tools.RiskLevelLow,
	SideEffects: false,
}

var ContextAgentSpec = tools.AgentToolSpec{
	Name:        "conversation_context",
	Version:     "1",
	Description: "inspect and expand compacted context for the current thread",
	RiskLevel:   tools.RiskLevelLow,
	SideEffects: false,
}

var SearchLlmSpec = llm.ToolSpec{
	Name:        "conversation_search",
	Description: stringPtr(sharedtoolmeta.Must("conversation_search").LLMDescription),
	JSONSchema: map[string]any{
		"type": "object",
		"properties": map[string]any{
			"query": map[string]any{"type": "string"},
			"limit": map[string]any{"type": "integer", "minimum": 1, "maximum": 20},
		},
		"required":             []string{"query"},
		"additionalProperties": false,
	},
}

var ContextLlmSpec = llm.ToolSpec{
	Name:        "conversation_context",
	Description: stringPtr(sharedtoolmeta.Must("conversation_context").LLMDescription),
	JSONSchema: map[string]any{
		"type": "object",
		"properties": map[string]any{
			"action": map[string]any{
				"type": "string",
				"enum": []string{"status", "search", "describe", "expand"},
			},
			"query": map[string]any{"type": "string"},
			"scope": map[string]any{
				"type": "string",
				"enum": []string{"summaries", "chunks", "both"},
			},
			"replacement_id": map[string]any{"type": "string"},
			"limit":          map[string]any{"type": "integer", "minimum": 1, "maximum": 20},
			"token_cap":      map[string]any{"type": "integer", "minimum": 256, "maximum": 12000},
		},
		"required":             []string{"action"},
		"additionalProperties": false,
	},
}

func AgentSpecs() []tools.AgentToolSpec {
	return []tools.AgentToolSpec{SearchAgentSpec, ContextAgentSpec}
}

func LlmSpecs() []llm.ToolSpec {
	return []llm.ToolSpec{SearchLlmSpec, ContextLlmSpec}
}
