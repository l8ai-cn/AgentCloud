package agentworkbench

// Agent-ui submits answers as string[]; Claude AskUserQuestion expects a bare
// string for single-select and keeps arrays only when multi-select.
func normalizePermissionAnswers(updatedInput map[string]any) {
	raw, ok := updatedInput["answers"].(map[string]any)
	if !ok {
		return
	}
	for key, value := range raw {
		items, ok := value.([]any)
		if !ok {
			continue
		}
		if len(items) == 1 {
			raw[key] = items[0]
			continue
		}
		strings := make([]string, 0, len(items))
		for _, item := range items {
			text, ok := item.(string)
			if !ok {
				strings = nil
				break
			}
			strings = append(strings, text)
		}
		if strings != nil {
			raw[key] = strings
		}
	}
}
