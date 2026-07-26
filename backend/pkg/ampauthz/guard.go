package ampauthz

import (
	"fmt"
	"log/slog"
)

// MustCatalogReady logs and returns an error when the embedded authz bundle
// failed to load. Call from process startup so mis-packaged images fail fast.
func MustCatalogReady() error {
	if err := CatalogError(); err != nil {
		slog.Error("ampauthz catalog failed to load", "error", err)
		return fmt.Errorf("ampauthz catalog: %w", err)
	}
	for _, code := range requiredPermissionConsts {
		if _, ok := knownPerms[code]; !ok {
			err := fmt.Errorf("ampauthz catalog missing permission %s", code)
			slog.Error(err.Error())
			return err
		}
	}
	return nil
}
