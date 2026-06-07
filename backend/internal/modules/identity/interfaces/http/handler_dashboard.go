package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"restaurant-management/internal/platform/httpx"
)

func (h *Handler) dashboard(c *gin.Context) {
	// MOCK DATA for AdminDashboard
	data := map[string]interface{}{
		"revenue": map[string]string{
			"value": "12.450.000 ₫",
			"sub":   "24 · +15%",
		},
		"tables": map[string]string{
			"value": "18 / 24",
			"sub":   "T1: 8 · T2: 6 · Garden: 4",
		},
		"kitchen": map[string]string{
			"value": "8",
			"sub":   "~14'",
		},
		"payments": map[string]string{
			"value": "3",
			"sub":   "POS",
		},
		"staffs": []map[string]interface{}{
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
