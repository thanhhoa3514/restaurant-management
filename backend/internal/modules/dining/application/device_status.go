package application

import (
	"context"
	"strings"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

// DeviceStatus lets a PENDING device learn it was approved without holding a
// usable session credential. The device polls this with its own token (the
// token is the secret; no other auth is possible because a pending device
// cannot pass device-access middleware) until status flips to APPROVED, then
// proceeds to the menu with the same token — which is now valid to order.
type DeviceStatusRequest struct {
	AccessToken string
}

type DeviceStatusResponse struct {
	Status string `json:"status"`
}

type DeviceStatus struct {
	repo domain.DiningRepository
}

func NewDeviceStatus(repo domain.DiningRepository) *DeviceStatus {
	return &DeviceStatus{repo: repo}
}

func (s *DeviceStatus) Handle(ctx context.Context, req DeviceStatusRequest) (DeviceStatusResponse, error) {
	token := strings.TrimSpace(req.AccessToken)
	if token == "" {
		return DeviceStatusResponse{}, apperr.New(apperr.CodeInvalid, "access token is required")
	}
	dev, err := s.repo.FindDeviceByToken(ctx, token)
	if err != nil {
		return DeviceStatusResponse{}, err
	}
	return DeviceStatusResponse{Status: string(dev.Status)}, nil
}
