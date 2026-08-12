package testkit

func knowledgeBaseTableDDLs() []string {
	return []string{
		`CREATE TABLE IF NOT EXISTS knowledge_bases (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			organization_id INTEGER NOT NULL,
			slug TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			git_repo_path TEXT NOT NULL DEFAULT '',
			http_clone_url TEXT NOT NULL DEFAULT '',
			default_branch TEXT NOT NULL DEFAULT 'main',
			source_type TEXT NOT NULL DEFAULT 'git',
			source_config TEXT NOT NULL DEFAULT '{}',
			sync_status TEXT NOT NULL DEFAULT 'idle',
			sync_error TEXT,
			last_synced_at DATETIME,
			created_by_user_id INTEGER NOT NULL DEFAULT 0,
			visibility TEXT NOT NULL DEFAULT 'organization',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(organization_id, slug)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_base_agent_mounts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			organization_id INTEGER NOT NULL,
			knowledge_base_id INTEGER NOT NULL,
			agent_slug TEXT NOT NULL,
			mode TEXT NOT NULL DEFAULT 'ro',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}
}
