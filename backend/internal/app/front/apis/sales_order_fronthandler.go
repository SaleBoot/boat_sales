package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	log "log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// --- SaleOrder Handlers ---
type SalesOrderFrontHandler struct {
	saleOrderSvc *services.SalesOrderService
}

func NewSalesOrderFrontHandler(
	aSvc *services.SalesOrderService,
) (*SalesOrderFrontHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewSaleOrderFrontHandler: aSvc cannot be nil")
	}

	return &SalesOrderFrontHandler{saleOrderSvc: aSvc}, nil
}

func (aH *SalesOrderFrontHandler) HandleAddSalesOrder(c *gin.Context) {
	log.Println("HandleAddSalesOrder,start")
	defer log.Println("HandleAddSalesOrder,end")

	var input services.FrontSalesOrder
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}
	log.Printf("Received AddSaleOrder request: %+v", input)
	dbOrder := input.ToDb()
	log.Printf("Converted to SalesOrder model: %+v", dbOrder)

	err := aH.saleOrderSvc.AddSaleOrder(c.Request.Context(), dbOrder)
	if err != nil {
		log.Printf("failed to add sale order: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to add sale order",
		})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully add sale order",
		Data:    nil,
	})
}
