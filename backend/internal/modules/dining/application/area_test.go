package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/shared/apperr"
)

func TestSaveArea_RejectsSeventhArea(t *testing.T) {
	repo := &fakeRepo{areaCount: MaxAreasPerRestaurant}
	svc := NewSaveArea(fakeTx{}, repo, uuid.New())

	_, err := svc.Handle(context.Background(), SaveAreaRequest{Name: "Sân thượng"})
	if !apperr.Is(err, apperr.CodeConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func TestDeleteArea_RejectsAreaContainingTables(t *testing.T) {
	repo := &fakeRepo{areaTableCount: 1}
	svc := NewDeleteArea(fakeTx{}, repo, uuid.New())

	err := svc.Handle(context.Background(), uuid.New())
	if !apperr.Is(err, apperr.CodeConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
}
