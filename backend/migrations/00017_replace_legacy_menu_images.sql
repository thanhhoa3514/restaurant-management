-- +goose Up
-- +goose StatementBegin

-- Replace the remaining legacy stock-photo URLs with item-specific assets
-- bundled in the frontend image. Existing orders/invoices keep their snapshots.
WITH generated_images(code, image_url) AS (
    VALUES
        ('TOM-SU', '/images/menu/tom-su-tuoi.webp?v=20260723b'),
        ('MUC-NUONG', '/images/menu/muc-nuong-sa-te.webp?v=20260723b'),
        ('HAU-NUONG', '/images/menu/hau-nuong-pho-mai.webp?v=20260723b'),
        ('RAU-THAP-CAM', '/images/menu/rau-thap-cam.webp?v=20260723b'),
        ('NAM-TONG-HOP', '/images/menu/nam-tong-hop.webp?v=20260723b'),
        ('DAU-HU', '/images/menu/dau-hu-trung.webp?v=20260723b'),
        ('MI-TRUNG', '/images/menu/mi-trung-tuoi.webp?v=20260723b'),
        ('KHOAI-CHIEN', '/images/menu/khoai-tay-chien.webp?v=20260723b'),
        ('NEM-RAN', '/images/menu/nem-chua-ran.webp?v=20260723b'),
        ('SALAD-BO', '/images/menu/salad-tron-bo-my.webp?v=20260723b'),
        ('TRA-DA', '/images/menu/tra-da.webp?v=20260723b'),
        ('TRA-DAO', '/images/menu/tra-dao-cam-sa.webp?v=20260723b'),
        ('COCA', '/images/menu/coca-cola.webp?v=20260723b'),
        ('BIA-SG', '/images/menu/bia-sai-gon.webp?v=20260723b'),
        ('KEM-VANI', '/images/menu/kem-vani.webp?v=20260723b'),
        ('TRAI-CAY', '/images/menu/dia-trai-cay.webp?v=20260723b')
)
UPDATE menu_items AS item
SET image_url = generated.image_url,
    images = jsonb_build_array(generated.image_url),
    updated_at = NOW()
FROM generated_images AS generated
WHERE item.code = generated.code
  AND item.deleted_at IS NULL;

WITH generated_category_images(name, image_url) AS (
    VALUES
        ('Hải sản', '/images/menu/tom-su-tuoi.webp?v=20260723b'),
        ('Rau & Nấm', '/images/menu/rau-thap-cam.webp?v=20260723b'),
        ('Khai vị', '/images/menu/khoai-tay-chien.webp?v=20260723b'),
        ('Đồ uống', '/images/menu/tra-dao-cam-sa.webp?v=20260723b'),
        ('Tráng miệng', '/images/menu/kem-vani.webp?v=20260723b')
)
UPDATE categories AS category
SET image_url = generated.image_url,
    updated_at = NOW()
FROM generated_category_images AS generated
WHERE category.name = generated.name
  AND category.deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- This data migration intentionally has no automatic rollback because the
-- previous per-environment stock-photo URL cannot be reconstructed safely.
SELECT 1;
