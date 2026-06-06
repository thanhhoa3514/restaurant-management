package httpx

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/shared/apperr"
)

type Envelope struct {
	Code  int        `json:"code"`
	Data  any        `json:"data"`
	Meta  any        `json:"meta,omitempty"`
	Error *ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func Respond(c *gin.Context, status int, data any, meta any) {
	c.JSON(status, Envelope{Code: status, Data: data, Meta: meta, Error: nil})
}
func RespondError(c *gin.Context, err error) {
	status, body := MapError(err)
	c.JSON(status, Envelope{Code: status, Data: nil, Error: body})
}

func MapError(err error) (int, *ErrorBody) {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return statusFor(ae.Code), &ErrorBody{Code: string(ae.Code), Message: ae.Message}
	}
	return http.StatusInternalServerError, &ErrorBody{Code: string(apperr.CodeInternal), Message: "internal error"}
}

func statusFor(code apperr.Code) int {
	switch code {
	case apperr.CodeInvalid:
		return http.StatusBadRequest
	case apperr.CodeUnauthorized:
		return http.StatusUnauthorized
	case apperr.CodeForbidden:
		return http.StatusForbidden
	case apperr.CodeNotFound:
		return http.StatusNotFound
	case apperr.CodeConflict:
		return http.StatusConflict
	case apperr.CodeNotImplemented:
		return http.StatusNotImplemented
	default:
		return http.StatusInternalServerError
	}
}
