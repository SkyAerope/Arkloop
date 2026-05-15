package accountapi

import (
	"strings"
	"testing"

	"arkloop/services/shared/telegrambot"
)

func TestBuildPreferenceKeyboard_showsCanonicalSelector(t *testing.T) {
	pref := &PreferenceResult{
		AvailableModels: []ModelOption{
			{Model: "cmd-cred^gpt-command", IsSelected: false},
			{Model: "openrouter-main^anthropic/claude-sonnet-4-5", IsSelected: true},
		},
	}
	kb := buildPreferenceKeyboard(pref)
	if kb == nil {
		t.Fatal("expected keyboard")
	}
	if len(kb.InlineKeyboard) < 3 {
		t.Fatalf("expected at least 3 rows (2 models + dismiss), got %d", len(kb.InlineKeyboard))
	}

	// first model button
	btn0 := kb.InlineKeyboard[0][0]
	if btn0.Text != "cmd-cred^gpt-command" {
		t.Errorf("first button text: got %q, want %q", btn0.Text, "cmd-cred^gpt-command")
	}
	if btn0.CallbackData != "model:cmd-cred^gpt-command" {
		t.Errorf("first button callback: got %q, want %q", btn0.CallbackData, "model:cmd-cred^gpt-command")
	}

	// second model button (selected, gets ✓ suffix)
	btn1 := kb.InlineKeyboard[1][0]
	want := "openrouter-main^anthropic/claude-sonnet-4-5 ✓"
	if btn1.Text != want {
		t.Errorf("second button text: got %q, want %q", btn1.Text, want)
	}
	wantCB := "model:openrouter-main^anthropic/claude-sonnet-4-5"
	if btn1.CallbackData != wantCB {
		t.Errorf("second button callback: got %q, want %q", btn1.CallbackData, wantCB)
	}
}

func TestModelOptionIsSelected_matchesCanonicalAndBare(t *testing.T) {
	candidates := []telegramSelectorCandidate{
		{credentialName: "cmd-cred", model: "gpt-command", accountScoped: true},
		{credentialName: "openrouter-main", model: "anthropic/claude-sonnet-4-5", accountScoped: true},
	}

	cases := []struct {
		name       string
		stored     string
		wantIdx    int
		wantSelected bool
	}{
		{"canonical match", "cmd-cred^gpt-command", 0, true},
		{"bare model match", "gpt-command", 0, true},
		{"canonical with slash model", "openrouter-main^anthropic/claude-sonnet-4-5", 1, true},
		{"bare model with slash", "anthropic/claude-sonnet-4-5", 1, true},
		{"no match", "nonexistent", -1, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for i, c := range candidates {
				selector := c.credentialName + "^" + c.model
				isSelected := strings.EqualFold(selector, strings.TrimSpace(tc.stored)) || strings.EqualFold(c.model, strings.TrimSpace(tc.stored))
				if i == tc.wantIdx && isSelected != tc.wantSelected {
					t.Errorf("candidate %d (%s): IsSelected = %v, want %v", i, selector, isSelected, tc.wantSelected)
				}
				if i != tc.wantIdx && isSelected {
					t.Errorf("candidate %d (%s): unexpected IsSelected = true", i, selector)
				}
			}
		})
	}
}

func TestBuildPreferenceKeyboard_emptyResultReturnsNil(t *testing.T) {
	kb := buildPreferenceKeyboard(&PreferenceResult{})
	if kb != nil {
		t.Error("expected nil keyboard for empty PreferenceResult")
	}
	kb = buildPreferenceKeyboard(nil)
	if kb != nil {
		t.Error("expected nil keyboard for nil input")
	}
}

func TestBuildPreferenceKeyboard_thinkMode(t *testing.T) {
	pref := &PreferenceResult{ThinkingMode: "medium"}
	kb := buildPreferenceKeyboard(pref)
	if kb == nil {
		t.Fatal("expected keyboard")
	}
	// 6 modes + 1 dismiss = 7 rows
	if len(kb.InlineKeyboard) != 7 {
		t.Fatalf("expected 7 rows, got %d", len(kb.InlineKeyboard))
	}
	// medium row should have ✓
	mediumRow := kb.InlineKeyboard[3][0] // off=0, minimal=1, low=2, medium=3
	if mediumRow.Text != "medium ✓" {
		t.Errorf("medium button text: got %q", mediumRow.Text)
	}
	if mediumRow.CallbackData != "think:medium" {
		t.Errorf("medium button callback: got %q", mediumRow.CallbackData)
	}
	_ = telegrambot.InlineKeyboardMarkup{}
}
