package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type DailySessionItemDTO = domain.DailySessionItemDTO
type DailySessionsStatsDTO = domain.DailySessionsStatsDTO
type ListDailySessionsResponse = domain.ListDailySessionsResponse
type ListDailySessionsFilter = domain.ListDailySessionsFilter
type SessionDetailDTO = domain.SessionDetailDTO
type SessionOrderDetailDTO = domain.SessionOrderDetailDTO
type SessionOrderItemDetailDTO = domain.SessionOrderItemDetailDTO
type SessionInvoiceDetailDTO = domain.SessionInvoiceDetailDTO

type ListDailySessions struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListDailySessions(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListDailySessions {
	return &ListDailySessions{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListDailySessions) Handle(ctx context.Context, filter ListDailySessionsFilter) (ListDailySessionsResponse, error) {
	return s.repo.ListDailySessions(ctx, s.defaultRestaurantID, filter)
}

type GetSessionDetail struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewGetSessionDetail(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *GetSessionDetail {
	return &GetSessionDetail{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GetSessionDetail) Handle(ctx context.Context, sessionID uuid.UUID) (SessionDetailDTO, error) {
	return s.repo.GetSessionDetail(ctx, s.defaultRestaurantID, sessionID)
}
