package imageutil

// PrepareModelInputImage returns the model-facing image variant.
// Attachment identity is carried as text by each provider adapter, so this
// function must not burn labels into the pixels.
func PrepareModelInputImage(data []byte, mimeType, attachmentKey string) ([]byte, string) {
	_ = attachmentKey
	return ProcessModelInputImage(data, mimeType)
}
