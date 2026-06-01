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

type BoatModelHandler struct {
	boatModelSvc *services.BoatModelService
}

func NewBoatModelHandler(aSvc *services.BoatModelService) (*BoatModelHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewBoatModelHandler: aSvc cannot be nil")
	}

	return &BoatModelHandler{boatModelSvc: aSvc}, nil
}

func (aH *BoatModelHandler) HandleGetModelsByBoatEnName(c *gin.Context) {
	boatEnName := c.Param("boatEnName")
	boatEnName = strings.TrimSpace(boatEnName)
	if boatEnName == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "boatEnName is required",
		})
		return
	}

	models, err := aH.boatModelSvc.GetModelsByBoatEnName(boatEnName)
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get users: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got models",
		Data:    models,
	})
}

func (aH *BoatModelHandler) HandleUpdateModelWithBoatEnName(c *gin.Context) {
	boatEnName := c.Param("boatEnName")
	boatEnName = strings.TrimSpace(boatEnName)
	if boatEnName == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "boatEnName is required",
		})
		return
	}

	var modelsToUpdate []*models.SysBoatModel
	if err := c.ShouldBindJSON(&modelsToUpdate); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("Invalid request body: %s", err.Error()),
		})
		return
	}

	// Validate that the boatEnName in the path matches the one in the payload
	for _, model := range modelsToUpdate {
		if model.BoatEnName != boatEnName {
			c.JSON(http.StatusBadRequest, types.ApiResponse{
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("boatEnName in path (%s) does not match boatEnName in payload (%s)", boatEnName, model.BoatEnName),
			})
			return
		}
	}

	if err := aH.boatModelSvc.ReplaceModelsByBoatEnName(boatEnName, modelsToUpdate); err != nil {
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("Failed to update boat (%s) models: %s ", boatEnName, err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Models updated successfully",
		Data:    nil,
	})
}
