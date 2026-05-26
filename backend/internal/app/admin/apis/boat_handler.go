package apis

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BoatHandler struct {
	boatDao *dao.SysBoatDao
}

func NewBoatHandler(db *gorm.DB) *BoatHandler {
	return &BoatHandler{boatDao: dao.NewSysBoatDao(db)}
}

func (aH *BoatHandler) HandleGetBoats(c *gin.Context) {
	boats, err := aH.boatDao.GetAllBoats()
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

func (aH *BoatHandler) HandleAddBoat(c *gin.Context) {
	var boat models.SysBoat
	if err := c.ShouldBindJSON(&boat); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if err := aH.boatDao.CreateBoat(&boat); err != nil {
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

func (aH *BoatHandler) HandleDeleteBoats(c *gin.Context) {
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

	if err := aH.boatDao.DeleteBoats(input.BoatIDs); err != nil {
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
