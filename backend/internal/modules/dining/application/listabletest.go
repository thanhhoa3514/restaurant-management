package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type ListTableRespone struct {
	TableId   uuid.UUID `json:"table_id"`
	TableName string    `json:"table_name"`
}
type ListTable struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListTable(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListTable {
	return &ListTable{repo: repo, defaultRestaurantID: defaultRestaurantID}
}
func (s *ListTable) Handle(ctx context.Context) ([]ListTableRespone, error) {
	defaultRestaurantID := s.defaultRestaurantID

	rows, err := s.repo.FindListTableTest(ctx, defaultRestaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]ListTableRespone, 0, len(rows))

	for _, row := range rows {
		out = append(out, ListTableRespone{
			TableId:   row.TableId,
			TableName: row.Tablename,
		})
	}
	return out, nil
}
