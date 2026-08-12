package policy

var (
	PodPolicy = ResourcePolicy{Read: ReadOwnerOnly, Write: WriteCreatorAdmin}

	RunnerPolicy = ResourcePolicy{Read: ReadVisibility, Write: WriteAdminOnly}

	RepositoryPolicy = ResourcePolicy{Read: ReadVisibility, Write: WriteAdminOnly}

	KnowledgeBasePolicy = ResourcePolicy{Read: ReadVisibility, Write: WriteCreatorAdmin}

	SkillPolicy = ResourcePolicy{Read: ReadOrgOpen, Write: WriteCreatorAdmin}

	ExpertPolicy = ResourcePolicy{Read: ReadOrgOpen, Write: WriteCreatorAdmin}
)
