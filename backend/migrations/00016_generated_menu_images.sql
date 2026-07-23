-- +goose Up
-- +goose StatementBegin

-- Seed/demo menu assets are bundled with the frontend image. Updating by code
-- keeps existing production data and transactional history intact.
UPDATE menu_items
SET image_url = CASE code
    WHEN 'LAU-THAI' THEN '/images/menu/lau-thai-tomyum.webp?v=20260723'
    WHEN 'LAU-BO-MY' THEN '/images/menu/lau-bo-my-nam.webp?v=20260723'
    WHEN 'LAU-GA-LA-E' THEN '/images/menu/lau-ga-la-e.webp?v=20260723'
    WHEN 'LAU-HAI-SAN' THEN '/images/menu/lau-hai-san.webp?v=20260723'
    WHEN 'BA-CHI-BO' THEN '/images/menu/ba-chi-bo-my-nuong.webp?v=20260723'
    WHEN 'SUON-NUONG' THEN '/images/menu/suon-heo-nuong-mat-ong.webp?v=20260723'
    WHEN 'BO-CUON-NAM' THEN '/images/menu/bo-cuon-nam-kim-cham.webp?v=20260723'
    WHEN 'GA-NUONG' THEN '/images/menu/canh-ga-nuong-sa-te.webp?v=20260723'
END,
images = jsonb_build_array(
    CASE code
        WHEN 'LAU-THAI' THEN '/images/menu/lau-thai-tomyum.webp?v=20260723'
        WHEN 'LAU-BO-MY' THEN '/images/menu/lau-bo-my-nam.webp?v=20260723'
        WHEN 'LAU-GA-LA-E' THEN '/images/menu/lau-ga-la-e.webp?v=20260723'
        WHEN 'LAU-HAI-SAN' THEN '/images/menu/lau-hai-san.webp?v=20260723'
        WHEN 'BA-CHI-BO' THEN '/images/menu/ba-chi-bo-my-nuong.webp?v=20260723'
        WHEN 'SUON-NUONG' THEN '/images/menu/suon-heo-nuong-mat-ong.webp?v=20260723'
        WHEN 'BO-CUON-NAM' THEN '/images/menu/bo-cuon-nam-kim-cham.webp?v=20260723'
        WHEN 'GA-NUONG' THEN '/images/menu/canh-ga-nuong-sa-te.webp?v=20260723'
    END
),
updated_at = NOW()
WHERE code IN (
    'LAU-THAI',
    'LAU-BO-MY',
    'LAU-GA-LA-E',
    'LAU-HAI-SAN',
    'BA-CHI-BO',
    'SUON-NUONG',
    'BO-CUON-NAM',
    'GA-NUONG'
)
  AND deleted_at IS NULL;

UPDATE categories
SET image_url = CASE name
    WHEN 'Lẩu' THEN '/images/menu/lau-thai-tomyum.webp?v=20260723'
    WHEN 'Món nướng' THEN '/images/menu/ba-chi-bo-my-nuong.webp?v=20260723'
END,
updated_at = NOW()
WHERE name IN ('Lẩu', 'Món nướng')
  AND deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- This data migration intentionally has no automatic rollback because the
-- previous per-environment S3 URL cannot be reconstructed safely.
SELECT 1;
