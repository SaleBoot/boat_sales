package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"boatsales-backend/pkg/utils"
	"fmt"
	log "log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// --- SaleOrder Handlers ---
type SalesOrderHandler struct {
	saleOrderSvc *services.SalesOrderService
	cosPathSvc   *services.CosPathService
}

func NewSalesOrderHandler(
	aSvc *services.SalesOrderService,
	aCosPathSvc *services.CosPathService,
) (*SalesOrderHandler, error) {
	if aSvc == nil || aCosPathSvc == nil {
		return nil, fmt.Errorf("NewSalesOrderHandler: aSvc or aCosPathSvc cannot be nil")
	}

	return &SalesOrderHandler{
		saleOrderSvc: aSvc,
		cosPathSvc:   aCosPathSvc,
	}, nil
}

type SalesOrderListResponse struct {
	List     []services.FrontSalesOrder `json:"list"`
	Total    int64                      `json:"total"`
	Page     int                        `json:"page"`
	PageSize int                        `json:"pageSize"`
}

func (aH *SalesOrderHandler) HandleGetSalesOrders(c *gin.Context) {
	log.Println("HandleGetSalesOrders,start")
	defer log.Println("HandleGetSalesOrders,end")

	page := utils.GetPage(c)
	pageSize := utils.GetPageSize(c)

	orders, total, err := aH.saleOrderSvc.GetAllSaleOrders(page, pageSize)
	if err != nil {
		log.Printf("failed to get sale orders: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to get sale orders",
		})
		return
	}

	dbCosFilePaths, err := aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
	if err != nil {
		log.Printf("failed to get file paths: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to get file paths",
		})
		return
	}

	var adminOrders []services.FrontSalesOrder
	for _, order := range orders {
		var adminOrder services.FrontSalesOrder
		adminOrder.FromDb(&order)

		// 加载模型的宣传图
		adImgs, err := services.FilterModelAdImgs(adminOrder.Model3DPath, dbCosFilePaths)
		if err != nil {
			log.Printf("模型 %s 加载宣传图失败: %v", adminOrder.Model3DPath, err)
			adminOrder.AdImgs = []string{} // 空切片，保证前端安全
		} else {
			adminOrder.AdImgs = adImgs
		}

		adminOrders = append(adminOrders, adminOrder)
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully get sale orders",
		Data: SalesOrderListResponse{
			List:     adminOrders,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
	})
}

func (aH *SalesOrderHandler) GetSaleOrdersByCustomerContact(c *gin.Context) {
	log.Println("GetSaleOrdersByCustomerContact,start")
	defer log.Println("GetSaleOrdersByCustomerContact,end")

	customerContact := c.Query("contact")
	if strings.TrimSpace(customerContact) == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "customerContact is required",
		})
		return
	}

	orders, err := aH.saleOrderSvc.GetSaleOrdersByCustomerContact(customerContact)
	if err != nil {
		log.Printf("failed to get sale orders: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to get sale orders",
		})
		return
	}

	dbCosFilePaths, err := aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
	if err != nil {
		log.Printf("failed to get file paths: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to get file paths",
		})
		return
	}

	var adminOrders []services.FrontSalesOrder
	for _, order := range orders {
		var adminOrder services.FrontSalesOrder
		adminOrder.FromDb(&order)

		// 加载模型的宣传图
		adImgs, err := services.FilterModelAdImgs(adminOrder.Model3DPath, dbCosFilePaths)
		if err != nil {
			log.Printf("模型 %s 加载宣传图失败: %v", adminOrder.Model3DPath, err)
			adminOrder.AdImgs = []string{} // 空切片，保证前端安全
		} else {
			adminOrder.AdImgs = adImgs
		}

		adminOrders = append(adminOrders, adminOrder)
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully get sale orders",
		Data: SalesOrderListResponse{
			List:     adminOrders,
			Total:    int64(len(adminOrders)),
			Page:     1,
			PageSize: len(adminOrders),
		},
	})
}

func (aH *SalesOrderHandler) HandleUpdateSaleOrders(c *gin.Context) {
	var input services.FrontSalesOrder
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("HandleDeleteSalesOrders: invalid request body: %s", err.Error()),
		})
		return
	}

	updateData := input.ToDb()
	if err := aH.saleOrderSvc.UpdateSaleOrderByID(updateData.ID, updateData); err != nil {
		log.Printf("failed to update sale order: %+v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to update sale order",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated sale order",
	})
}

type DeleteSalesOrdersInput struct {
	IDs []uint `json:"ids"`
}

func (aH *SalesOrderHandler) HandleDeleteSalesOrders(c *gin.Context) {
	var input DeleteSalesOrdersInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("HandleDeleteSalesOrders: invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "SalesOrder IDs are required",
		})
		return
	}

	if err := aH.saleOrderSvc.DeleteSaleOrders(input.IDs); err != nil {
		log.Printf("failed to delete sale orders: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete sale orders",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted boat engines",
	})
}

func (aH *SalesOrderHandler) HandleGetSalesOrdersOverview(c *gin.Context) {
	log.Println("HandleGetSalesOrdersOverview,start")
	defer log.Println("HandleGetSalesOrdersOverview,end")

	overview := aH.saleOrderSvc.GetSalesOrdersOverview()

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully get sales orders overview",
		Data:    overview,
	})
}
