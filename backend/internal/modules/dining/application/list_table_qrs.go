package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type TableQRDTO struct {
	TableID     uuid.UUID  `json:"table_id"`
	TableCode   string     `json:"table_code"`
	TableName   string     `json:"table_name"`
	TableStatus string     `json:"table_status"`
	Capacity    int        `json:"capacity"`
	AreaName    string     `json:"area_name"`
	AreaOrder   int        `json:"area_order"`
	QRCodeID    *uuid.UUID `json:"qr_code_id,omitempty"`
	QRToken     *string    `json:"qr_token,omitempty"`
	HasActiveQR bool       `json:"has_active_qr"`
}

type ListTableQRs struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListTableQRs(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListTableQRs {
	return &ListTableQRs{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListTableQRs) Handle(ctx context.Context) ([]TableQRDTO, error) {
	restaurantID := s.defaultRestaurantID
	rows, err := s.repo.ListTablesWithActiveQR(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]TableQRDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, TableQRDTO{
			TableID:     row.TableID,
			TableCode:   row.TableCode,
			TableName:   row.TableName,
			TableStatus: row.Status,
			Capacity:    row.Capacity,
			AreaName:    row.AreaName,
			AreaOrder:   row.AreaOrder,
			QRCodeID:    row.QRCodeID,
			QRToken:     row.QRToken,
			HasActiveQR: row.QRCodeID != nil,
		})
	}
	return out, nil
}
