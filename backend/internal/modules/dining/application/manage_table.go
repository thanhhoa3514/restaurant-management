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
	TableID  *uuid.UUID `json:"-"`
	AreaID   *uuid.UUID `json:"area_id"`
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	Capacity int        `json:"capacity"`
	Status   string     `json:"status"`
}

type SaveTableResponse struct {
	ID       uuid.UUID  `json:"id"`
	AreaID   *uuid.UUID `json:"area_id"`
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	Capacity int        `json:"capacity"`
	Status   string     `json:"status"`
	Created  bool       `json:"created"`
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

	table := &domain.Table{
		RestaurantID: restaurantID,
		Code:         code,
		Name:         name,
		Capacity:     in.Capacity,
		Status:       status,
	}
	if in.AreaID != nil {
		table.AreaID = *in.AreaID
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if in.TableID == nil {
			return s.repo.CreateTable(ctx, table)
		}
		table.ID = *in.TableID
		if _, err := s.repo.FindTable(ctx, restaurantID, table.ID); err != nil {
			return err
		}
		return s.repo.UpdateTable(ctx, table)
	})
	if err != nil {
		return out, err
	}

	out = SaveTableResponse{
		ID:       table.ID,
		AreaID:   in.AreaID,
		Code:     table.Code,
		Name:     table.Name,
		Capacity: table.Capacity,
		Status:   table.Status,
		Created:  in.TableID == nil,
	}
	return out, nil
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
