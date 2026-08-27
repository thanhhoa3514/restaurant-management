package migrations

import (
	"math"
	"testing"

	"github.com/pressly/goose/v3"
)

func TestEmbeddedMigrationsHaveUniqueVersions(t *testing.T) {
	goose.SetBaseFS(FS)
	t.Cleanup(func() { goose.SetBaseFS(nil) })

	rows, err := goose.CollectMigrations(".", 0, math.MaxInt64)
	if err != nil {
		t.Fatalf("collect embedded migrations: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("expected embedded migrations")
	}
}
