// Package api embeds the OpenAPI contract in the backend binary.
package api

import _ "embed"

// OpenAPISpec is the API contract served to Swagger UI.
//
//go:embed openapi.yaml
var OpenAPISpec []byte
