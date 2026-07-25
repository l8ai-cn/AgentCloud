package infra

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestExpertRepositoryListUsesStableIDOrder(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`
		CREATE TABLE experts (
			id INTEGER PRIMARY KEY,
			organization_id INTEGER NOT NULL,
			updated_at DATETIME
		)
	`).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO experts (id, organization_id, updated_at) VALUES
			(1, 7, '2026-07-24 03:00:00'),
			(2, 7, '2026-07-24 02:00:00'),
			(3, 7, '2026-07-24 01:00:00')
	`).Error)

	repo := NewExpertRepository(db)
	rows, total, err := repo.List(context.Background(), 7, 2, 0, nil)

	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, rows, 2)
	require.Equal(t, int64(3), rows[0].ID)
	require.Equal(t, int64(2), rows[1].ID)

	snapshotMaxID := int64(2)
	rows, total, err = repo.List(context.Background(), 7, 2, 0, &snapshotMaxID)

	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, rows, 2)
	require.Equal(t, int64(2), rows[0].ID)
	require.Equal(t, int64(1), rows[1].ID)
}
