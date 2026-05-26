package apis

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/types"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Boat Category Handlers ---
type BoatCategoryHandler struct {
	boatCategoryDao *dao.SysBoatCategoryDao
}

func NewBoatCategoryHandler(aBoatCategoryDao *dao.SysBoatCategoryDao) *BoatCategoryHandler {
	return &BoatCategoryHandler{boatCategoryDao: aBoatCategoryDao} // 依赖注入
}

func (aH *BoatCategoryHandler) HandleGetBoatCategories(c *gin.Context) {
	categories, err := aH.boatCategoryDao.GetAllBoatCategories()
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

	category := models.SysBoatCategory{
		EnglishName: input.EnglishName,
		ChineseName: input.ChineseName,
	}

	if err := aH.boatCategoryDao.CreateBoatCategory(&category); err != nil {
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
		Data:    category,
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

	category, err := aH.boatCategoryDao.GetBoatCategoryByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound,
				types.ApiResponse{Code: http.StatusNotFound, Message: "category not found"})
			return
		}
		log.Printf("failed to find boat category for update: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError, Message: "failed to find category"})
		return
	}

	category.EnglishName = input.EnglishName
	category.ChineseName = input.ChineseName

	if err := aH.boatCategoryDao.UpdateBoatCategory(category); err != nil {
		log.Printf("failed to update boat category: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError, Message: "failed to update category"})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated boat category",
		Data:    category,
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

	if err := aH.boatCategoryDao.DeleteBoatCategories(input.IDs); err != nil {
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
