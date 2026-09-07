package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type BoatHandler struct {
	boatSvc *services.BoatService
}

func NewBoatHandler(aBoSvc *services.BoatService) (*BoatHandler, error) {
	if aBoSvc == nil {
		return nil, fmt.Errorf("NewBoatHandler: aBoSvc cannot be nil")
	}
	return &BoatHandler{boatSvc: aBoSvc}, nil
}

func (aH *BoatHandler) HandleGetBoats(c *gin.Context) {
	categoryStrID := c.Query("categoryStrID")
	var boats []models.SysBoat
	var err error

	boats, err = aH.boatSvc.GetBoatsByCategoryStrID(categoryStrID)
	if err != nil {
		log.Printf("failed to get boats: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to retrieve boats",
		})
		return
	}

	log.Printf("HandleGetBoats():Successfully retrieved %d boats", len(boats))
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: fmt.Sprintf("Successfully retrieved %d boats", len(boats)),
		Data:    boats,
	})
}

// BoatInput defines the structure for creating or updating a boat.
// It uses pointers for numeric fields to distinguish between a zero value and a missing field.
type BoatInput struct {
	BoatName        string   `json:"boatName" binding:"required"`
	BoatEnName      string   `json:"boatEnName" binding:"required"`
	CategoryStrID   string   `json:"categoryStrID" binding:"required"`
	Price           *int     `json:"price"`
	Description     string   `json:"description"`
	OverallLength   *float64 `json:"overallLength"`
	WaterlineLength *float64 `json:"waterlineLength"`
	Beam            *float64 `json:"beam"`
	MoldedDepth     *float64 `json:"moldedDepth"`
	Draft           *float64 `json:"draft"`
	NavigationArea  string   `json:"navigationArea"`
	// MainEnginePower string   `json:"mainEnginePower"`
	// DesignSpeed     *float64 `json:"designSpeed"`
	// RatedCrew       *int     `json:"ratedCrew"`
	// PropulsionType  string   `json:"propulsionType"`
	Material        string `json:"material"`
	CertificateType string `json:"certificateType"`
}

// toModel converts a BoatInput DTO to a models.SysBoat database model.
// It handles nil pointers by assigning zero values.
func (input *BoatInput) toModel() *models.SysBoat {
	boat := &models.SysBoat{
		BoatName:       input.BoatName,
		BoatEnName:     input.BoatEnName,
		CategoryStrID:  input.CategoryStrID,
		Description:    input.Description,
		NavigationArea: input.NavigationArea,
		// MainEnginePower: input.MainEnginePower,
		// PropulsionType:  input.PropulsionType,
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
	// if input.DesignSpeed != nil {
	// 	boat.DesignSpeed = *input.DesignSpeed
	// }
	// if input.RatedCrew != nil {
	// 	boat.RatedCrew = *input.RatedCrew
	// }

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
	log.Printf("Received AddBoat request: %+v", input)

	boat := input.toModel()
	log.Printf("Converted to SysBoat model: %+v", boat)

	// Check for uniqueness of BoatName
	if err := aH.boatSvc.AddBoat(boat); err != nil {
		log.Printf("failed to add boat: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to add boat",
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

	if err := aH.boatSvc.DeleteBoats(c, input.BoatIDs); err != nil {
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

func (aH *BoatHandler) HandleUpdateBoat(c *gin.Context) {
	id := c.Param("id")
	// Convert id from string to uint and assign to boat.ID
	var boatID uint
	_, err := fmt.Sscan(id, &boatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid boat ID",
		})
		return
	}

	var input BoatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}
	boat := input.toModel()
	boat.ID = boatID

	if err := aH.boatSvc.UpdateBoat(c, boat); err != nil {
		log.Printf("failed to update boat: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to update boat",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated boat",
		Data:    boat,
	})
}
