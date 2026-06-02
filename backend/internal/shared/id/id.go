package id

import "github.com/google/uuid"

type ID = uuid.UUID

func New() ID                    { return uuid.New() }
func Parse(s string) (ID, error) { return uuid.Parse(s) }
func Nil() ID                    { return uuid.Nil }
