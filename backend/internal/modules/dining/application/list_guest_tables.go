package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

// GuestTableDTO is a public subset of table info exposed without auth.
type GuestTableDTO struct {
	TableID          uuid.UUID `json:"table_id"`
	TableCode        string    `json:"table_code"`
	TableName        string    `json:"table_name"`
	AreaName         string    `json:"area_name"`
	Capacity         int       `json:"capacity"`
	HasActiveQR      bool      `json:"has_active_qr"`
	HasActiveSession bool      `json:"has_active_session"`
	QRToken          *string   `json:"qr_token,omitempty"`
}

type ListGuestTables struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListGuestTables(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListGuestTables {
	return &ListGuestTables{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListGuestTables) Handle(ctx context.Context) ([]GuestTableDTO, error) {
	restaurantID := s.defaultRestaurantID
	rows, err := s.repo.ListTablesWithActiveQR(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]GuestTableDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, GuestTableDTO{
			TableID:          row.TableID,
			TableCode:        row.TableCode,
			TableName:        row.TableName,
			AreaName:         row.AreaName,
			Capacity:         row.Capacity,
			HasActiveQR:      row.QRCodeID != nil,
			HasActiveSession: row.HasActiveSession,
			QRToken:          row.QRToken,
		})
	}
	return out, nil
}
