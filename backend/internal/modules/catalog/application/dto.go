package application

import "github.com/google/uuid"

type Input struct {
	RestaurantID uuid.UUID `json:"-"` // from auth tenant context, not client body
}
type Output struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}
