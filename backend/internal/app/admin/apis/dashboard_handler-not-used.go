package apis

import (
	"boatsales-backend/internal/services"
	"fmt"

	"github.com/gin-gonic/gin"
)

// --- Boat Category Handlers ---
type DashBoardHandler struct {
	boatCategSvc  *services.BoatCategoryService
	cosPathSvc    *services.CosPathService
	boatModelSvc  *services.BoatModelService
	boatEngineSvc *services.BoatEngineService
	salesOrderSvc *services.SalesOrderService
}

func NewDashBoardHandler(
	aBoatCategSvc *services.BoatCategoryService,
	aCosPathSvc *services.CosPathService,
	aBoatModelSvc *services.BoatModelService, // 依赖注入
	aBoatEngineSvc *services.BoatEngineService, // 依赖注入
	aSalesOrderSvc *services.SalesOrderService, // 依赖注入
) (*DashBoardHandler, error) {
	if aBoatCategSvc == nil {
		return nil, fmt.Errorf("NewDashBoardHandler: aBoatCategSvc cannot be nil")
	}
	if aCosPathSvc == nil {
		return nil, fmt.Errorf("NewDashBoardHandler: aCosPathSvc cannot be nil")
	}
	if aBoatModelSvc == nil {
		return nil, fmt.Errorf("NewDashBoardHandler: aBoatModelSvc cannot be nil")
	}
	if aBoatEngineSvc == nil {
		return nil, fmt.Errorf("NewDashBoardHandler: aBoatEngineSvc cannot be nil")
	}
	if aSalesOrderSvc == nil {
		return nil, fmt.Errorf("NewDashBoardHandler: aSalesOrderSvc cannot be nil")
	}

	return &DashBoardHandler{
		boatCategSvc:  aBoatCategSvc,
		cosPathSvc:    aCosPathSvc,
		boatModelSvc:  aBoatModelSvc,
		boatEngineSvc: aBoatEngineSvc,
		salesOrderSvc: aSalesOrderSvc,
	}, nil
}

func (aH *DashBoardHandler) HandleAdminDashboard(c *gin.Context) {

	aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
}
