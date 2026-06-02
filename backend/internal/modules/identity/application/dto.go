package application

import "github.com/google/uuid"

type Input struct {
	RestaurantID uuid.UUID `json:"restaurant_id"`
}
type Output struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}
