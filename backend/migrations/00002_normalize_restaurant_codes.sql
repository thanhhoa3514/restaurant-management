-- +goose Up
UPDATE restaurants
SET code = UPPER(TRIM(code))
WHERE code <> UPPER(TRIM(code));

CREATE OR REPLACE FUNCTION normalize_restaurant_code() RETURNS TRIGGER AS $$
BEGIN
    NEW.code = UPPER(TRIM(NEW.code));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurants_normalize_code
BEFORE INSERT OR UPDATE OF code ON restaurants
FOR EACH ROW EXECUTE FUNCTION normalize_restaurant_code();

-- +goose Down
DROP TRIGGER IF EXISTS trg_restaurants_normalize_code ON restaurants;
DROP FUNCTION IF EXISTS normalize_restaurant_code();
