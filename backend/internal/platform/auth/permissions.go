package auth

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

const (
	PermissionBillingProcess  = "billing.process"
	PermissionIdentityManage  = "identity.manage"
	PermissionOrderingOperate = "ordering.operate"
	PermissionOrderingStaff   = "ordering.staff"
	PermissionKitchenOperate  = "kitchen.operate"
	PermissionDiningServe     = "dining.serve"
	PermissionDiningCashier   = "dining.cashier"
	PermissionDiningManage    = "dining.manage"
	PermissionCatalogManage   = "catalog.manage"
)

type PermissionResolver interface {
	ResolvePermissionCodes(ctx context.Context, restaurantID, userID uuid.UUID) ([]string, error)
}

func RequirePermission(resolver PermissionResolver, code string) gin.HandlerFunc {
	return func(c *gin.Context) {
		restaurantID, ok := tenant.RestaurantID(c.Request.Context())
		if !ok {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant"))
			c.Abort()
			return
		}
		userID, err := uuid.Parse(c.GetString(CtxUserID))
		if err != nil || userID == uuid.Nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
			c.Abort()
			return
		}
		codes, err := resolver.ResolvePermissionCodes(c.Request.Context(), restaurantID, userID)
		if err != nil {
			httpx.RespondError(c, err)
			c.Abort()
			return
		}
		for _, granted := range codes {
			if granted == code {
				c.Next()
				return
			}
		}
		httpx.RespondError(c, apperr.New(apperr.CodeForbidden, "forbidden"))
		c.Abort()
	}
}
