package routing

const DefaultContextWindowTokens = 128000

// RouteContextWindowTokens 读取路由的有效上下文窗口（tokens）。
func RouteContextWindowTokens(rule ProviderRouteRule) int {
	if n := RouteModelCapabilities(rule).ContextLength; n > 0 {
		return n
	}
	return DefaultContextWindowTokens
}
