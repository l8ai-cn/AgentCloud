package extension

type UserInstalledSkill struct {
	Install        *InstalledSkill
	RepositoryName string
	RepositorySlug string
}

func (s *UserInstalledSkill) DisplayName() string {
	if s == nil || s.Install == nil {
		return ""
	}
	if s.Install.Skill != nil && s.Install.Skill.DisplayName != "" {
		return s.Install.Skill.DisplayName
	}
	return s.Install.Slug
}

type UserInstalledMcpServer struct {
	Install        *InstalledMcpServer
	RepositoryName string
	RepositorySlug string
}

func (s *UserInstalledMcpServer) MarketItemName() string {
	if s == nil || s.Install == nil || s.Install.MarketItem == nil {
		return ""
	}
	return s.Install.MarketItem.Name
}

func (s *UserInstalledMcpServer) MarketItemSlug() string {
	if s == nil || s.Install == nil || s.Install.MarketItem == nil {
		return ""
	}
	return s.Install.MarketItem.Slug
}
