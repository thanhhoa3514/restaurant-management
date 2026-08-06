-- +goose Up
-- +goose StatementBegin

-- Bound dining-area growth at a scale the restaurant staff can operate safely.
-- Every operational table belongs to one area. Reuse the restaurant's first
-- area for legacy unassigned tables, or create a bounded fallback when the
-- restaurant did not have any areas yet.
INSERT INTO areas (restaurant_id, name, description, display_order, is_active)
SELECT DISTINCT t.restaurant_id, 'Khu vực chung', 'Khu vực được tạo khi nâng cấp dữ liệu bàn', 0, TRUE
FROM tables t
WHERE t.area_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM areas a
      WHERE a.restaurant_id = t.restaurant_id
        AND a.deleted_at IS NULL
  )
ON CONFLICT (restaurant_id, name) DO UPDATE
SET deleted_at = NULL,
    is_active = TRUE,
    updated_at = NOW();

UPDATE tables t
SET area_id = (
        SELECT a.id
        FROM areas a
        WHERE a.restaurant_id = t.restaurant_id
          AND a.deleted_at IS NULL
        ORDER BY a.display_order, a.created_at, a.id
        LIMIT 1
    ),
    updated_at = NOW()
WHERE t.area_id IS NULL;

ALTER TABLE tables
    ALTER COLUMN area_id SET NOT NULL;

CREATE OR REPLACE FUNCTION enforce_restaurant_area_limit()
RETURNS trigger AS $$
DECLARE
    active_count integer;
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('dining-area:' || NEW.restaurant_id::text, 0));

    SELECT COUNT(*)
    INTO active_count
    FROM areas a
    WHERE a.restaurant_id = NEW.restaurant_id
      AND a.deleted_at IS NULL
      AND a.id <> NEW.id;

    IF active_count >= 6 THEN
        RAISE EXCEPTION 'restaurant may have at most 6 active areas'
            USING ERRCODE = '23514', CONSTRAINT = 'chk_areas_max_per_restaurant';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurant_area_limit
BEFORE INSERT OR UPDATE OF deleted_at ON areas
FOR EACH ROW
EXECUTE FUNCTION enforce_restaurant_area_limit();

CREATE OR REPLACE FUNCTION enforce_area_table_limit()
RETURNS trigger AS $$
DECLARE
    active_count integer;
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.deleted_at IS NULL
       AND OLD.area_id IS NOT DISTINCT FROM NEW.area_id THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('dining-table:' || NEW.area_id::text, 0));

    SELECT COUNT(*)
    INTO active_count
    FROM tables t
    WHERE t.restaurant_id = NEW.restaurant_id
      AND t.area_id = NEW.area_id
      AND t.deleted_at IS NULL
      AND t.id <> NEW.id;

    IF active_count >= 24 THEN
        RAISE EXCEPTION 'area may have at most 24 active tables'
            USING ERRCODE = '23514', CONSTRAINT = 'chk_tables_max_per_area';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_area_table_limit
BEFORE INSERT OR UPDATE OF area_id, deleted_at ON tables
FOR EACH ROW
EXECUTE FUNCTION enforce_area_table_limit();

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TRIGGER IF EXISTS trg_area_table_limit ON tables;
DROP FUNCTION IF EXISTS enforce_area_table_limit();
DROP TRIGGER IF EXISTS trg_restaurant_area_limit ON areas;
DROP FUNCTION IF EXISTS enforce_restaurant_area_limit();

ALTER TABLE tables
    ALTER COLUMN area_id DROP NOT NULL;

-- +goose StatementEnd
