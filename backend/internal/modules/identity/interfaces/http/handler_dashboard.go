package http

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/money"
)

func (h *Handler) dashboard(c *gin.Context) {
	// revenue + tables are real (read-model); kitchen/payments/staffs are MOCK.
	revenue := map[string]string{
		"value": "12.450.000 ₫",
		"sub":   "24 · +15%",
	}
	tables := map[string]string{
		"value": "18 / 24",
		"sub":   "T1: 8 · T2: 6 · Garden: 4",
	}

	if h.DashboardStats != nil {
		if stats, err := h.DashboardStats.Handle(c.Request.Context()); err == nil {
			revenue = map[string]string{
				"value": money.VND(stats.RevenueTodayVND).String(),
				"sub":   fmt.Sprintf("%d hóa đơn", stats.PaidInvoiceCount),
			}
			tables = map[string]string{
				"value": fmt.Sprintf("%d / %d", stats.ActiveTables, stats.TotalTables),
				"sub":   fmt.Sprintf("%d bàn trống", stats.TotalTables-stats.ActiveTables),
			}
		}
	}

	data := map[string]interface{}{
		"revenue": revenue,
		"tables":  tables,
		"kitchen": map[string]string{ // MOCK
			"value": "8",
			"sub":   "~14'",
		},
		"payments": map[string]string{ // MOCK
			"value": "3",
			"sub":   "POS",
		},
		"staffs": []map[string]interface{}{ // MOCK
			{
				"name": "Nguyễn Quản Trị",
				"code": "ADMIN001",
				"role": "Admin",
				"tone": "purple",
				"time": "6h 45m",
			},
			{
				"name": "Trần Thu Ngân",
				"code": "CASH001",
				"role": "Cashier",
				"tone": "green",
				"time": "4h 12m",
			},
			{
				"name": "Lê Phục Vụ",
				"code": "WAIT001",
				"role": "Waiter",
				"tone": "blue",
				"time": "3h 28m",
			},
			{
				"name": "Phạm Đầu Bếp",
				"code": "KITCH001",
				"role": "Kitchen",
				"tone": "orange",
				"time": "5h 02m",
			},
		},
	}
	httpx.Respond(c, http.StatusOK, data, nil)
}
