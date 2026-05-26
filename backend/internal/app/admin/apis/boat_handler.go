package apis

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type BoatHandler struct {
	boatDao *dao.SysBoatDao
}

func NewBoatHandler(aBoatDao *dao.SysBoatDao) *BoatHandler {
	return &BoatHandler{boatDao: aBoatDao} // 依赖注入
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

// BoatInput defines the structure for creating or updating a boat.
// It uses pointers for numeric fields to distinguish between a zero value and a missing field.
type BoatInput struct {
	BoatName        string   `json:"boatName"`
	ModelName       string   `json:"modelName"`
	Category        string   `json:"Category"`
	Price           *int     `json:"Price"`
	Description     string   `json:"description"`
	OverallLength   *float64 `json:"overallLength"`
	WaterlineLength *float64 `json:"waterlineLength"`
	Beam            *float64 `json:"beam"`
	MoldedDepth     *float64 `json:"moldedDepth"`
	Draft           *float64 `json:"draft"`
	NavigationArea  string   `json:"navigationArea"`
	MainEnginePower string   `json:"mainEnginePower"`
	DesignSpeed     *float64 `json:"designSpeed"`
	RatedCrew       *int     `json:"ratedCrew"`
	PropulsionType  string   `json:"propulsionType"`
	Material        string   `json:"material"`
	CertificateType string   `json:"certificateType"`
}

// toModel converts a BoatInput DTO to a models.SysBoat database model.
// It handles nil pointers by assigning zero values.
func (input *BoatInput) toModel() *models.SysBoat {
	boat := &models.SysBoat{
		BoatName:        input.BoatName,
		ModelName:       input.ModelName,
		Category:        input.Category,
		Description:     input.Description,
		NavigationArea:  input.NavigationArea,
		MainEnginePower: input.MainEnginePower,
		PropulsionType:  input.PropulsionType,
		Material:        input.Material,
		CertificateType: input.CertificateType,
	}

	if input.Price != nil {
		boat.Price = *input.Price
	}
	if input.OverallLength != nil {
		boat.OverallLength = *input.OverallLength
	}
	if input.WaterlineLength != nil {
		boat.WaterlineLength = *input.WaterlineLength
	}
	if input.Beam != nil {
		boat.Beam = *input.Beam
	}
	if input.MoldedDepth != nil {
		boat.MoldedDepth = *input.MoldedDepth
	}
	if input.Draft != nil {
		boat.Draft = *input.Draft
	}
	if input.DesignSpeed != nil {
		boat.DesignSpeed = *input.DesignSpeed
	}
	if input.RatedCrew != nil {
		boat.RatedCrew = *input.RatedCrew
	}

	return boat
}

func (aH *BoatHandler) HandleAddBoat(c *gin.Context) {
	var input BoatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	boat := input.toModel()

	// Check for uniqueness of BoatName and ModelName
	existingBoat, err := aH.boatDao.FindByNameOrModel(boat.BoatName, boat.ModelName)
	if err != nil {
		log.Printf("failed to check for existing boat: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to check for existing boat",
		})
		return
	}
	if existingBoat != nil {
		var conflictField string
		if existingBoat.BoatName == boat.BoatName {
			conflictField = "BoatName"
		} else {
			conflictField = "ModelName"
		}
		c.JSON(http.StatusConflict, types.ApiResponse{
			Code:    http.StatusConflict,
			Message: fmt.Sprintf("a boat with this %s already exists", conflictField),
		})
		return
	}

	if err := aH.boatDao.CreateBoat(boat); err != nil {
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
