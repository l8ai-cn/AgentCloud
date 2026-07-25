package operatorcatalog

import "github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"

func validBootstrapRequest() BootstrapRequest {
	return BootstrapRequest{
		OrganizationID:   7,
		OrganizationSlug: slugkit.MustNewForTest("dev-org"),
		PublisherUserID:  11,
		ReviewerUserID:   13,
		ModelResourceID:  17,
		RuntimeImageID:   19,
		CredentialBundleIDs: map[string]int64{
			"lovart": 31,
		},
	}
}
