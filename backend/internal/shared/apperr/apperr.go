package apperr

import "errors"

type Code string

const (
	CodeInternal       Code = "internal"
	CodeInvalid        Code = "invalid"
	CodeUnauthorized   Code = "unauthorized"
	CodeForbidden      Code = "forbidden"
	CodeNotFound       Code = "not_found"
	CodeConflict       Code = "conflict"
	CodeNotImplemented  Code = "not_implemented"
	CodeRateLimited     Code = "rate_limited"
)

type Error struct {
	Code    Code   `json:"code"`
	Message string `json:"message"`
	Err     error  `json:"-"`
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func New(code Code, message string) *Error { return &Error{Code: code, Message: message} }
func Wrap(code Code, message string, err error) *Error {
	return &Error{Code: code, Message: message, Err: err}
}
func Is(err error, code Code) bool { var e *Error; return errors.As(err, &e) && e.Code == code }

var ErrNotImplemented = New(CodeNotImplemented, "not implemented")
