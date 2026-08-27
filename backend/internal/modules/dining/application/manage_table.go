package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

var validTableStatus = map[string]bool{
	"AVAILABLE": true,
	"OCCUPIED":  true,
	"RESERVED":  true,
	"CLEANING":  true,
	"INACTIVE":  true,
}

type SaveTableRequest struct {
	TableID   *uuid.UUID `json:"-"`
	AreaID    *uuid.UUID `json:"area_id"`
	Code      string     `json:"code"`
	Name      string     `json:"name"`
	Capacity  int        `json:"capacity"`
	Status    string     `json:"status"`
	PositionX *int       `json:"position_x"` // bỏ trống khi sửa = giữ nguyên chỗ trên sơ đồ
	PositionY *int       `json:"position_y"`
}

type SaveTableResponse struct {
	ID        uuid.UUID  `json:"id"`
	AreaID    *uuid.UUID `json:"area_id"`
	Code      string     `json:"code"`
	Name      string     `json:"name"`
	Capacity  int        `json:"capacity"`
	Status    string     `json:"status"`
	PositionX *int       `json:"position_x"`
	PositionY *int       `json:"position_y"`
	Created   bool       `json:"created"`
}

type SaveTable struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewSaveTable(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *SaveTable {
	return &SaveTable{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *SaveTable) Handle(ctx context.Context, in SaveTableRequest) (SaveTableResponse, error) {
	var out SaveTableResponse
	restaurantID := s.defaultRestaurantID

	code := strings.ToUpper(strings.TrimSpace(in.Code))
	name := strings.TrimSpace(in.Name)
	if code == "" {
		return out, apperr.New(apperr.CodeInvalid, "table code is required")
	}
	if name == "" {
		name = code
	}
	if in.Capacity <= 0 || in.Capacity > 50 {
		return out, apperr.New(apperr.CodeInvalid, "capacity must be between 1 and 50")
	}
	status := strings.ToUpper(strings.TrimSpace(in.Status))
	if status == "" {
		status = "AVAILABLE"
	}
	if !validTableStatus[status] {
		return out, apperr.New(apperr.CodeInvalid, "invalid table status")
	}
	if in.AreaID == nil || *in.AreaID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "area_id is required")
	}

	table := &domain.Table{
		RestaurantID: restaurantID,
		Code:         code,
		Name:         name,
		Capacity:     in.Capacity,
		Status:       status,
		PositionX:    clampPercent(in.PositionX),
		PositionY:    clampPercent(in.PositionY),
	}
	table.AreaID = *in.AreaID

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		area, err := s.repo.FindArea(ctx, restaurantID, table.AreaID)
		if err != nil {
			return err
		}
		if !area.IsActive {
			return apperr.New(apperr.CodeInvalid, "area is inactive")
		}

		if in.TableID == nil {
			count, err := s.repo.CountTablesInArea(ctx, restaurantID, table.AreaID)
			if err != nil {
				return err
			}
			if count >= MaxTablesPerArea {
				return apperr.New(apperr.CodeConflict, "area has reached the 24-table limit")
			}
			return s.repo.CreateTable(ctx, table)
		}
		table.ID = *in.TableID
		existing, err := s.repo.FindTable(ctx, restaurantID, table.ID)
		if err != nil {
			return err
		}
		if existing.AreaID != table.AreaID {
			count, err := s.repo.CountTablesInArea(ctx, restaurantID, table.AreaID)
			if err != nil {
				return err
			}
			if count >= MaxTablesPerArea {
				return apperr.New(apperr.CodeConflict, "area has reached the 24-table limit")
			}
		}
		return s.repo.UpdateTable(ctx, table)
	})
	if err != nil {
		return out, err
	}

	out = SaveTableResponse{
		ID:        table.ID,
		AreaID:    in.AreaID,
		Code:      table.Code,
		Name:      table.Name,
		Capacity:  table.Capacity,
		Status:    table.Status,
		PositionX: table.PositionX,
		PositionY: table.PositionY,
		Created:   in.TableID == nil,
	}
	return out, nil
}

// clampPercent giữ toạ độ trong khung sơ đồ 0–100%.
func clampPercent(v *int) *int {
	if v == nil {
		return nil
	}
	c := *v
	if c < 0 {
		c = 0
	}
	if c > 100 {
		c = 100
	}
	return &c
}

// ── Lưu sơ đồ bàn ───────────────────────────────────────────────────────────

type TablePositionInput struct {
	TableID uuid.UUID `json:"table_id"`
	X       int       `json:"x"`
	Y       int       `json:"y"`
}

type SaveTablePositionsRequest struct {
	Positions []TablePositionInput `json:"positions"`
}

type SaveTablePositions struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewSaveTablePositions(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *SaveTablePositions {
	return &SaveTablePositions{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *SaveTablePositions) Handle(ctx context.Context, in SaveTablePositionsRequest) error {
	if len(in.Positions) == 0 {
		return apperr.New(apperr.CodeInvalid, "positions is required")
	}
	if len(in.Positions) > 500 {
		return apperr.New(apperr.CodeInvalid, "too many positions")
	}

	rows := make([]domain.TablePosition, 0, len(in.Positions))
	for _, p := range in.Positions {
		if p.TableID == uuid.Nil {
			return apperr.New(apperr.CodeInvalid, "table_id is required")
		}
		rows = append(rows, domain.TablePosition{TableID: p.TableID, X: *clampPercent(&p.X), Y: *clampPercent(&p.Y)})
	}

	return s.tx.Run(ctx, func(ctx context.Context) error {
		return s.repo.UpdateTablePositions(ctx, s.defaultRestaurantID, rows)
	})
}

type DeleteTable struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewDeleteTable(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *DeleteTable {
	return &DeleteTable{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *DeleteTable) Handle(ctx context.Context, tableID uuid.UUID) error {
	restaurantID := s.defaultRestaurantID
	return s.tx.Run(ctx, func(ctx context.Context) error {
		if _, err := s.repo.FindTable(ctx, restaurantID, tableID); err != nil {
			return err
		}
		session, err := s.repo.FindActiveSessionByTable(ctx, restaurantID, tableID)
		if err != nil && !apperr.Is(err, apperr.CodeNotFound) {
			return err
		}
		if session != nil {
			return apperr.New(apperr.CodeConflict, "table has an active session")
		}
		// Printed codes for a removed table must stop resolving.
		if err := s.repo.DeactivateActiveQR(ctx, restaurantID, tableID, nil, "table deleted"); err != nil {
			return err
		}
		return s.repo.SoftDeleteTable(ctx, restaurantID, tableID)
	})
}
