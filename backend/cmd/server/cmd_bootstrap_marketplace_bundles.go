package main

func marketplaceCredentialBundleIDs(
	options marketplaceBootstrapOptions,
) map[string]int64 {
	ids := map[string]int64{}
	if options.lovartBundleID > 0 {
		ids["lovart"] = options.lovartBundleID
	}
	if options.doAgentSettingsBundleID > 0 {
		ids["do-agent-settings"] = options.doAgentSettingsBundleID
	}
	return ids
}
