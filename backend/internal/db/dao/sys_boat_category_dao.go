package dao

import (
	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type SysBoatCategoryDao struct {
	DB *gorm.DB
}

func NewSysBoatCategoryDao(db *gorm.DB) *SysBoatCategoryDao {
	return &SysBoatCategoryDao{DB: db}
}

// GetAllBoatCategories retrieves all boat categories.
func (d *SysBoatCategoryDao) GetAllBoatCategories() ([]models.SysBoatCategory, error) {
	var categories []models.SysBoatCategory
	result := d.DB.Find(&categories)
	return categories, result.Error
}

// CreateBoatCategory creates a new boat category.
func (d *SysBoatCategoryDao) CreateBoatCategory(category *models.SysBoatCategory) error {
	return d.DB.Create(category).Error
}

// GetBoatCategoryByID retrieves a boat category by its ID.
func (d *SysBoatCategoryDao) GetBoatCategoryByID(id uint) (*models.SysBoatCategory, error) {
	var category models.SysBoatCategory
	result := d.DB.First(&category, id)
	return &category, result.Error
}

// UpdateBoatCategory updates an existing boat category.
func (d *SysBoatCategoryDao) UpdateBoatCategory(category *models.SysBoatCategory) error {
	return d.DB.Save(category).Error
}

// DeleteBoatCategories deletes boat categories by their IDs.
func (d *SysBoatCategoryDao) DeleteBoatCategories(ids []uint) error {
	return d.DB.Delete(&models.SysBoatCategory{}, ids).Error
}

// Count returns the total number of boat categories.
func (d *SysBoatCategoryDao) Count() (int64, error) {
	var count int64
	if err := d.DB.Model(&models.SysBoatCategory{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
