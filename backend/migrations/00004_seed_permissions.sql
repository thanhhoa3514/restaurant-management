-- +goose Up
INSERT INTO permissions (code, display_name, module, description) VALUES
('billing.process', 'Xử lý thanh toán', 'billing', 'Lập hóa đơn, điều chỉnh và xử lý thanh toán'),
('identity.manage', 'Quản lý nhân sự', 'identity', 'Quản lý tài khoản nhân viên'),
('ordering.operate', 'Vận hành đơn hàng', 'ordering', 'Tạo và cập nhật đơn hàng nội bộ'),
('ordering.staff', 'Theo dõi phục vụ', 'ordering', 'Xem bàn và cập nhật trạng thái phục vụ'),
('kitchen.operate', 'Vận hành bếp', 'kitchen', 'Xem hàng đợi và cập nhật món trong bếp'),
('dining.serve', 'Phục vụ bàn', 'dining', 'Mở phiên phục vụ bàn'),
('dining.cashier', 'Kết toán bàn', 'dining', 'Đóng phiên và chuyển bàn sang thanh toán'),
('dining.manage', 'Quản lý phòng ăn', 'dining', 'Quản lý mã QR và cấu hình bàn'),
('catalog.manage', 'Quản lý thực đơn', 'catalog', 'Tạo, sửa và cập nhật trạng thái món')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (
    VALUES
        ('cashier', 'billing.process'),
        ('manager', 'billing.process'),
        ('manager', 'identity.manage'),
        ('server', 'ordering.operate'),
        ('kitchen', 'ordering.operate'),
        ('manager', 'ordering.operate'),
        ('server', 'ordering.staff'),
        ('kitchen', 'ordering.staff'),
        ('cashier', 'ordering.staff'),
        ('manager', 'ordering.staff'),
        ('kitchen', 'kitchen.operate'),
        ('manager', 'kitchen.operate'),
        ('server', 'dining.serve'),
        ('manager', 'dining.serve'),
        ('server', 'dining.cashier'),
        ('cashier', 'dining.cashier'),
        ('manager', 'dining.cashier'),
        ('manager', 'dining.manage'),
        ('manager', 'catalog.manage')
) AS grant_matrix(role_name, permission_code)
JOIN roles r ON r.name = grant_matrix.role_name AND r.deleted_at IS NULL
JOIN permissions p ON p.code = grant_matrix.permission_code AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- +goose Down
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'billing.process',
        'identity.manage',
        'ordering.operate',
        'ordering.staff',
        'kitchen.operate',
        'dining.serve',
        'dining.cashier',
        'dining.manage',
        'catalog.manage'
    )
);

DELETE FROM permissions WHERE code IN (
    'billing.process',
    'identity.manage',
    'ordering.operate',
    'ordering.staff',
    'kitchen.operate',
    'dining.serve',
    'dining.cashier',
    'dining.manage',
    'catalog.manage'
);
