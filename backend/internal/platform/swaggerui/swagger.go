package swaggerui

import (
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"restaurant-management/api"
)

const (
	SpecPath = "/openapi.yaml"
	UIPath   = "/swagger/index.html"
)

func Register(router *gin.Engine) {
	router.GET(SpecPath, func(c *gin.Context) {
		c.Data(http.StatusOK, "application/yaml; charset=utf-8", api.OpenAPISpec)
	})
	router.GET("/swagger", func(c *gin.Context) {
		c.Redirect(http.StatusTemporaryRedirect, UIPath)
	})
	router.GET(
		"/swagger/*any",
		ginSwagger.WrapHandler(swaggerFiles.Handler, ginSwagger.URL(SpecPath)),
	)
}
