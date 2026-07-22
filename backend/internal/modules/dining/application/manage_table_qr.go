package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type ManageTableQRRequest struct {
	TableID uuid.UUID `json:"table_id"`
	Rotate  bool      `json:"rotate"`
	ActorID uuid.UUID `json:"-"`
}

type ManageTableQRResponse struct {
	ID      uuid.UUID `json:"id"`
	TableID uuid.UUID `json:"table_id"`
	Token   string    `json:"token"`
	Status  string    `json:"status"`
	Rotated bool      `json:"rotated"`
}

type ManageTableQR struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewManageTableQR(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *ManageTableQR {
	return &ManageTableQR{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *ManageTableQR) Handle(ctx context.Context, in ManageTableQRRequest) (ManageTableQRResponse, error) {
	var out ManageTableQRResponse
	restaurantID := s.defaultRestaurantID

	var actor *uuid.UUID
	if in.ActorID != uuid.Nil {
		actor = &in.ActorID
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if _, err := s.repo.FindTable(ctx, restaurantID, in.TableID); err != nil {
			return err
		}

		existing, err := s.repo.ActiveQRForTable(ctx, restaurantID, in.TableID)
		if err != nil {
			return err
		}

		if existing != nil && !in.Rotate {
			out = ManageTableQRResponse{
				ID:      existing.ID,
				TableID: in.TableID,
				Token:   existing.Token,
				Status:  "active",
				Rotated: false,
			}
			return nil
		}

		if existing != nil {
			if err := s.repo.DeactivateActiveQR(ctx, restaurantID, in.TableID, actor, "rotated"); err != nil {
				return err
			}
		}

		token, err := randomToken(24)
		if err != nil {
			return err
		}
		qr := &domain.QRCode{
			RestaurantID: restaurantID,
			TableID:      in.TableID,
			Token:        token,
			IsActive:     true,
			CreatedBy:    actor,
		}
		if err := s.repo.CreateQR(ctx, qr); err != nil {
			return err
		}

		out = ManageTableQRResponse{
			ID:      qr.ID,
			TableID: in.TableID,
			Token:   qr.Token,
			Status:  "active",
			Rotated: existing != nil,
		}
		_ = s.outbox
		return nil
	})
	return out, err
}
