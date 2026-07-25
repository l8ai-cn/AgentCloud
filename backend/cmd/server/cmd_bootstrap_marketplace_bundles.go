package main

func marketplaceCredentialBundleIDs(
	options marketplaceBootstrapOptions,
) map[string]int64 {
	ids := map[string]int64{}
	if options.lovartBundleID > 0 {
		ids["lovart"] = options.lovartBundleID
	}
	return ids
}
