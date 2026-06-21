package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// BoatEngineListResponse 结构体用于封装分页的船只引擎列表
type BoatEngineListResponse struct {
	List     []models.SysBoatEngine `json:"list"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
}

// --- Boat Engine Handlers ---
type BoatEngineHandler struct {
	boatEngineSvc *services.BoatEngineService
}

func NewBoatEngineHandler(aSvc *services.BoatEngineService,
) (*BoatEngineHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewBoatEngineHandler: aSvc cannot be nil")
	}

	return &BoatEngineHandler{boatEngineSvc: aSvc}, nil
}

func (aH *BoatEngineHandler) HandleGetBoatEngines(c *gin.Context) {
	log.Println("HandleGetBoatEngines,start")
	defer log.Println("HandleGetBoatEngines,end")

	engineCategoryID := c.Query("engineCategoryID")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("pageSize", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 10
	}

	log.Printf("HandleGetBoatEngines..engineCategoryID=%s, page=%d, pageSize=%d",
		engineCategoryID, page, pageSize)
	engines, total, err := aH.boatEngineSvc.GetBoatEngines(engineCategoryID, page, pageSize)
	if err != nil {
		log.Printf("failed to get boat engines: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to retrieve boat engines",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved boat engines",
		Data: BoatEngineListResponse{
			List:     engines,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
	})
}

type BoatEngineInput struct {
	EngineCategoryID string `json:"engineCategoryID"`
	EngineName       string `json:"engineName"`

	PowerKW      float64 `json:"powerKW"`
	BatteryKWh   float64 `json:"batteryKWh"`
	Displacement float64 `json:"displacement"`
	Description  string  `json:"description"`
}

func (input *BoatEngineInput) ToDb() *models.SysBoatEngine {
	return &models.SysBoatEngine{
		EngineCategoryID: input.EngineCategoryID,
		EngineName:       input.EngineName,
		PowerKW:          input.PowerKW,
		BatteryKWh:       input.BatteryKWh,
		Displacement:     input.Displacement,
		Description:      input.Description,
	}
}

func (aH *BoatEngineHandler) HandleAddBoatEngine(c *gin.Context) {
	log.Println("HandleAddBoatEngine,start")
	defer log.Println("HandleAddBoatEngine,end")

	var input BoatEngineInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}
	log.Printf("Received AddBoatEngine request: %+v", input)
	dbEngine := input.ToDb()
	log.Printf("Converted to SysBoatEngine model: %+v", dbEngine)

	err := aH.boatEngineSvc.AddBoatEngine(dbEngine)
	if err != nil {
		log.Printf("failed to add boat engine: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to add boat engine",
		})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully add boat engine",
		Data:    nil,
	})
}

func (aH *BoatEngineHandler) HandleUpdateBoatEngine(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "invalid boat engine ID",
		})
		return
	}

	var input BoatEngineInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}
	dbEngine := input.ToDb()

	err = aH.boatEngineSvc.UpdateBoatEngine(int(id), dbEngine)
	if err != nil {
		log.Printf("failed to update boat engine: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "failed to update category"})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated boat category",
		Data:    nil,
	})
}

type DeleteBoatEnginesInput struct {
	IDs []uint `json:"ids"`
}

func (aH *BoatEngineHandler) HandleDeleteBoatEngines(c *gin.Context) {
	var input DeleteBoatEnginesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("DeleteBoatEngines: invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "engine IDs are required",
		})
		return
	}

	if err := aH.boatEngineSvc.DeleteBoatEngines(input.IDs); err != nil {
		log.Printf("failed to delete boat engines: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete boat engines",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted boat engines",
	})
}
