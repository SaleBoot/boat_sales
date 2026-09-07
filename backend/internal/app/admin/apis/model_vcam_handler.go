package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ModelVCamHandler struct {
	modelVCamSvc *services.ModelVCamService
}

func NewModelVCamHandler(aSvc *services.ModelVCamService) (*ModelVCamHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewModelVCamHandler: aSvc cannot be nil")
	}

	return &ModelVCamHandler{modelVCamSvc: aSvc}, nil
}

func (aH *ModelVCamHandler) HandleUpdateVCams(c *gin.Context) {

	var recordsToUpdate []*models.SysModelVCam
	if err := c.ShouldBindJSON(&recordsToUpdate); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("Invalid request body: %s", err.Error()),
		})
		return
	}

	if err := aH.modelVCamSvc.UpdateModelVCams(c.Request.Context(), recordsToUpdate); err != nil {
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("Failed to add model v-cams: %s ", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Model v-cams added successfully",
		Data:    nil,
	})
}

func (aH *ModelVCamHandler) HandleGetVCam(c *gin.Context) {
	modelPath := c.Param("modelPath")
	modelPath = strings.TrimSpace(modelPath)
	if modelPath == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "modelPath is required",
		})
		return
	}

	vcams, err := aH.modelVCamSvc.GetModelVCamsByModelPath(c.Request.Context(), modelPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get model v-cams: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got models",
		Data:    vcams,
	})
}
