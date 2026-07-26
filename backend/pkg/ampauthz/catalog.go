package ampauthz

import (
	"embed"
	"fmt"
	"sync"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"gopkg.in/yaml.v3"
)

//go:embed authz/*.yaml
var authzFS embed.FS

type permissionsDoc struct {
	// Legacy flat list (pre AMP resources schema).
	Permissions []struct {
		Code string `yaml:"code"`
		Name string `yaml:"name"`
	} `yaml:"permissions"`
	// AMP local-file standard: resources[].permissions[].code
	Resources []struct {
		Permissions []struct {
			Code string `yaml:"code"`
		} `yaml:"permissions"`
	} `yaml:"resources"`
}

type rolesDoc struct {
	Roles []struct {
		Code        string   `yaml:"code"`
		RoleType    string   `yaml:"roleType"`
		Permissions []string `yaml:"permissions"`
	} `yaml:"roles"`
}

var (
	catalogOnce sync.Once
	catalogErr  error
	permByRole  map[string][]string
	knownPerms  map[string]struct{}
)

func loadCatalog() {
	catalogOnce.Do(func() {
		permByRole = map[string][]string{}
		knownPerms = map[string]struct{}{}

		var perms permissionsDoc
		if err := unmarshalAuthz("authz/permissions.yaml", &perms); err != nil {
			catalogErr = err
			return
		}
		for _, p := range perms.Permissions {
			if p.Code != "" {
				knownPerms[p.Code] = struct{}{}
			}
		}
		for _, resource := range perms.Resources {
			for _, p := range resource.Permissions {
				if p.Code != "" {
					knownPerms[p.Code] = struct{}{}
				}
			}
		}

		var roles rolesDoc
		if err := unmarshalAuthz("authz/roles.yaml", &roles); err != nil {
			catalogErr = err
			return
		}
		for _, role := range roles.Roles {
			acRole := acRoleForBundleCode(role.Code)
			if acRole == "" {
				continue
			}
			if _, exists := permByRole[acRole]; exists {
				continue
			}
			copied := append([]string(nil), role.Permissions...)
			permByRole[acRole] = copied
		}
		if len(permByRole[organization.RoleOwner]) == 0 ||
			len(permByRole[organization.RoleAdmin]) == 0 ||
			len(permByRole[organization.RoleMember]) == 0 {
			catalogErr = fmt.Errorf("ampauthz: roles.yaml missing ORG_OWNER/ORG_ADMIN/ORG_MEMBER")
		}
	})
}

func unmarshalAuthz(path string, dest any) error {
	raw, err := authzFS.ReadFile(path)
	if err != nil {
		return fmt.Errorf("ampauthz: read %s: %w", path, err)
	}
	if err := yaml.Unmarshal(raw, dest); err != nil {
		return fmt.Errorf("ampauthz: parse %s: %w", path, err)
	}
	return nil
}

func acRoleForBundleCode(code string) string {
	switch normalizeRoleCode(code) {
	case "ORG_OWNER":
		return organization.RoleOwner
	case "ORG_ADMIN":
		return organization.RoleAdmin
	case "ORG_MEMBER":
		return organization.RoleMember
	default:
		return ""
	}
}

// CatalogError exposes bundle load failures (tests / readiness).
func CatalogError() error {
	loadCatalog()
	return catalogErr
}
