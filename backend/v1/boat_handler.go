package v1

import (
	"boatsales-backend/internal/models"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (a *app) handleGetBoats(c *gin.Context) {
	boats, err := a.boatDao.GetAllBoats()
	if err != nil {
		log.Printf("failed to get boats: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to retrieve boats",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved boats",
		Data:    boats,
	})
}

func (a *app) handleAddBoat(c *gin.Context) {
	var boat models.SysBoat
	if err := c.ShouldBindJSON(&boat); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if err := a.boatDao.CreateBoat(&boat); err != nil {
		log.Printf("failed to create boat: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to create boat",
		})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully created boat",
		Data:    boat,
	})
}

type DeleteBoatsInput struct {
	BoatIDs []uint `json:"boatIds"`
}

func (a *app) handleDeleteBoats(c *gin.Context) {
	var input DeleteBoatsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.BoatIDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "boatIds are required",
		})
		return
	}

	if err := a.boatDao.DeleteBoats(input.BoatIDs); err != nil {
		log.Printf("failed to delete boats: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete boats",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted boats",
	})
}
