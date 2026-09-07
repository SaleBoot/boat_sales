package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	log "log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ModelVCamFrontHandler struct {
	cosPathSvc   *services.CosPathService
	modelVCamSvc *services.ModelVCamService
}

func NewModelVCamFrontHandler(
	aCosPathSvc *services.CosPathService,
	aModelVCamSvc *services.ModelVCamService,
) (*ModelVCamFrontHandler, error) {

	if aCosPathSvc == nil || aModelVCamSvc == nil {

		log.Printf("NewModelVCamFrontHandler: one or more params cannot be nil: %v, %v",
			aCosPathSvc, aModelVCamSvc)
		return nil, fmt.Errorf("NewModelVCamFrontHandler: one or more params cannot be nil")
	}

	return &ModelVCamFrontHandler{
		cosPathSvc:   aCosPathSvc,
		modelVCamSvc: aModelVCamSvc,
	}, nil
}

func (aH *ModelVCamFrontHandler) HandleGetVCamsByModelPath(c *gin.Context) {
	modelPath := c.Param("modelPath")

	// 清理多余的斜杠
	for strings.Contains(modelPath, "//") {
		modelPath = strings.ReplaceAll(modelPath, "//", "/")
	}

	if modelPath == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "modelPath is required",
			Data:    nil,
		})
		return
	}

	// 根据 modelPath 查询数据库
	vcams, err := aH.modelVCamSvc.GetModelVCamsByModelPath(c.Request.Context(), modelPath)
	if err != nil {
		log.Printf("HandleGetVCamsByModelPath: failed to get virtual cameras: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to get virtual cameras",
			Data:    nil,
		})
		return
	}

	vcamJSONData, err := services.MakeModelFocusTargets(modelPath, vcams)
	if err != nil {
		log.Printf("HandleGetVCamsByModelPath: failed to make model focus targets: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "Failed to make model focus targets",
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got virtual cameras",
		Data:    vcamJSONData,
	})
}
