package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

func TestSaveTable(t *testing.T) {
	rid := uuid.New()
	ctx := context.Background()

	t.Run("create normalises code and defaults name/status", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := NewSaveTable(fakeTx{}, repo, rid)
		areaID := uuid.New()
		out, err := svc.Handle(ctx, SaveTableRequest{AreaID: &areaID, Code: " v03 ", Capacity: 4})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !out.Created {
			t.Fatal("expected created")
		}
		if repo.createdTable.Code != "V03" || repo.createdTable.Name != "V03" {
			t.Fatalf("unexpected table: %+v", repo.createdTable)
		}
		if repo.createdTable.Status != "AVAILABLE" {
			t.Fatalf("unexpected status: %q", repo.createdTable.Status)
		}
		if repo.createdTable.AreaID != areaID {
			t.Fatalf("unexpected area: %s", repo.createdTable.AreaID)
		}
	})

	t.Run("rejects bad capacity and status", func(t *testing.T) {
		svc := NewSaveTable(fakeTx{}, &fakeRepo{}, rid)
		areaID := uuid.New()
		if _, err := svc.Handle(ctx, SaveTableRequest{AreaID: &areaID, Code: "V03", Capacity: 0}); !apperr.Is(err, apperr.CodeInvalid) {
			t.Fatalf("expected invalid for capacity, got %v", err)
		}
		if _, err := svc.Handle(ctx, SaveTableRequest{AreaID: &areaID, Code: "V03", Capacity: 4, Status: "PARTY"}); !apperr.Is(err, apperr.CodeInvalid) {
			t.Fatalf("expected invalid for status, got %v", err)
		}
		if _, err := svc.Handle(ctx, SaveTableRequest{AreaID: &areaID, Code: "  ", Capacity: 4}); !apperr.Is(err, apperr.CodeInvalid) {
			t.Fatalf("expected invalid for empty code, got %v", err)
		}
		if _, err := svc.Handle(ctx, SaveTableRequest{Code: "V03", Capacity: 4}); !apperr.Is(err, apperr.CodeInvalid) {
			t.Fatalf("expected invalid for missing area, got %v", err)
		}
	})

	t.Run("rejects a twenty-fifth table in one area", func(t *testing.T) {
		areaID := uuid.New()
		repo := &fakeRepo{areaTableCount: MaxTablesPerArea}
		svc := NewSaveTable(fakeTx{}, repo, rid)
		_, err := svc.Handle(ctx, SaveTableRequest{AreaID: &areaID, Code: "T25", Capacity: 4})
		if !apperr.Is(err, apperr.CodeConflict) {
			t.Fatalf("expected conflict, got %v", err)
		}
	})

	t.Run("update targets the existing table", func(t *testing.T) {
		tableID := uuid.New()
		areaID := uuid.New()
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid, AreaID: areaID}}
		svc := NewSaveTable(fakeTx{}, repo, rid)
		out, err := svc.Handle(ctx, SaveTableRequest{TableID: &tableID, AreaID: &areaID, Code: "T01", Name: "Bàn 1", Capacity: 6})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if out.Created {
			t.Fatal("expected update, not create")
		}
		if repo.updatedTable.ID != tableID || repo.updatedTable.Capacity != 6 {
			t.Fatalf("unexpected table: %+v", repo.updatedTable)
		}
	})
}

func TestDeleteTable(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	ctx := context.Background()

	t.Run("blocked while a session is active", func(t *testing.T) {
		repo := &fakeRepo{
			table:         &domain.Table{ID: tableID, RestaurantID: rid},
			activeSession: &domain.DiningSession{ID: uuid.New(), TableID: tableID},
		}
		err := NewDeleteTable(fakeTx{}, repo, rid).Handle(ctx, tableID)
		if !apperr.Is(err, apperr.CodeConflict) {
			t.Fatalf("expected conflict, got %v", err)
		}
		if repo.deletedTableID != uuid.Nil {
			t.Fatal("table must not be deleted while occupied")
		}
	})

	t.Run("free table is soft deleted", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}}
		if err := NewDeleteTable(fakeTx{}, repo, rid).Handle(ctx, tableID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo.deletedTableID != tableID {
			t.Fatalf("expected %s deleted, got %s", tableID, repo.deletedTableID)
		}
	})
}
