package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// --- Boat Category Handlers ---
type BoatCategoryHandler struct {
	boatCategorySvc *services.BoatCategoryService
}

func NewBoatCategoryHandler(aSvc *services.BoatCategoryService,
) (*BoatCategoryHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewBoatCategoryHandler: aSvc cannot be nil")
	}

	err := aSvc.EnsureDefaultBoatCategoriesExist()
	if err != nil {
		return nil, fmt.Errorf("NewBoatCategoryHandler:failed to ensure default boat categories exist: %w", err)
	}

	return &BoatCategoryHandler{boatCategorySvc: aSvc}, nil
}

func (aH *BoatCategoryHandler) HandleGetBoatCategories(c *gin.Context) {
	categories, err := aH.boatCategorySvc.GetBoatCategories()
	if err != nil {
		log.Printf("failed to get boat categories: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to retrieve boat categories",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved boat categories",
		Data:    categories,
	})
}

type BoatCategoryInput struct {
	EnglishName string `json:"englishName"`
	ChineseName string `json:"chineseName"`
}

func (aH *BoatCategoryHandler) HandleAddBoatCategory(c *gin.Context) {
	log.Println("HandleAddBoatCategory,start")
	defer log.Println("HandleAddBoatCategory,end")

	var input BoatCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	err := aH.boatCategorySvc.AddBoatCategory(input.EnglishName, input.ChineseName)
	if err != nil {
		log.Printf("failed to create boat category: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to create boat category",
		})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully created boat category",
		Data:    nil,
	})
}

func (aH *BoatCategoryHandler) HandleUpdateBoatCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "invalid category ID",
		})
		return
	}

	var input BoatCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	err = aH.boatCategorySvc.UpdateBoatCategory(int(id),
		input.EnglishName, input.ChineseName)
	if err != nil {
		log.Printf("failed to update boat category: %v", err)
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

type DeleteBoatCategoriesInput struct {
	IDs []uint `json:"ids"`
}

func (aH *BoatCategoryHandler) HandleDeleteBoatCategories(c *gin.Context) {
	var input DeleteBoatCategoriesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "category IDs are required",
		})
		return
	}

	if err := aH.boatCategorySvc.DeleteBoatCategories(input.IDs); err != nil {
		log.Printf("failed to delete boat categories: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete boat categories",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted boat categories",
	})
}
