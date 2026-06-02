// Package migrations embeds the goose SQL migration files so they travel
// inside the compiled binary — no migration files needed in the container.
package migrations

import "embed"

// FS holds the embedded *.sql migrations. Files sit at the FS root, so pass
// "." as the goose directory.
//
//go:embed *.sql
var FS embed.FS
