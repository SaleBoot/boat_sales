package dao

import (
	"boatsales-backend/internal/db/models"
	"context"
	"errors"

	"gorm.io/gorm"
)

type SysBoatDao struct {
	db *gorm.DB
}

func NewSysBoatDao(db *gorm.DB) *SysBoatDao {
	return &SysBoatDao{db: db}
}

// GetAllBoats retrieves all boats from the database.
// TODO: Add pagination and filtering in the future.
func (dao *SysBoatDao) GetAllBoats() ([]models.SysBoat, error) {
	var boats []models.SysBoat
	// Add debug logging to see the generated SQL
	if err := dao.db.Order("created_at desc").Find(&boats).Error; err != nil {
		return nil, err
	}
	return boats, nil
}

// CreateBoat adds a new boat to the database.
func (dao *SysBoatDao) CreateBoat(boat *models.SysBoat) error {
	return dao.db.Create(boat).Error
}

// FindByName checks if a boat with the given BoatName already exists.
func (dao *SysBoatDao) FindByName(boatName string) (*models.SysBoat, error) {
	var boat models.SysBoat
	err := dao.db.Where("boat_name = ?", boatName).First(&boat).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Not found, which is not an error in this context
		}
		return nil, err // Other database error
	}
	return &boat, nil // Found a conflicting record
}

// FindByBoatEnName checks if a boat with the given BoatEnName already exists.
func (dao *SysBoatDao) FindByBoatEnName(boatEnName string) (*models.SysBoat, error) {
	var boat models.SysBoat
	err := dao.db.Where("boat_en_name = ?", boatEnName).First(&boat).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Not found, which is not an error in this context
		}
		return nil, err // Other database error
	}
	return &boat, nil // Found a conflicting record
}

// GetBoatByID retrieves a single boat by its ID.
func (dao *SysBoatDao) GetBoatByID(id uint) (*models.SysBoat, error) {
	var boat models.SysBoat
	if err := dao.db.First(&boat, id).Error; err != nil {
		return nil, err
	}
	return &boat, nil
}

// GetBoatsByCategory retrieves boats that match a specific category.
func (dao *SysBoatDao) GetBoatsByCategoryStrID(
	aCategoryStrID string,
) ([]models.SysBoat, error) {

	var boats []models.SysBoat
	if err := dao.db.Where(
		"category_id = ?",
		aCategoryStrID).Order("created_at desc").Find(&boats).Error; err != nil {
		return nil, err
	}
	return boats, nil
}

func (dao *SysBoatDao) ExecInTransaction(
	ctx context.Context,
	aF func(tx *gorm.DB) error,
) error {
	return dao.db.WithContext(ctx).Transaction(aF)
}

// DeleteBoats removes boats from the database by their IDs.
func (dao *SysBoatDao) DeleteBoatsWithTx(tx *gorm.DB, ids []uint) error {
	db := tx
	if db == nil {
		db = dao.db
	}
	return db.Where("id IN ?", ids).
		Delete(&models.SysBoat{}).Error
}

func (dao *SysBoatDao) GetBoatEnNamesWithTx(tx *gorm.DB, ids []uint) ([]string, error) {
	db := tx
	if db == nil {
		db = dao.db
	}
	var boatEnNames []string
	err := db.Model(&models.SysBoat{}).
		Where("id IN ?", ids).
		Pluck("boat_en_name", &boatEnNames).Error
	if err != nil {
		return nil, err
	}
	return boatEnNames, nil
}

// UpdateBoatWithTx updates an existing boat in the database.
func (dao *SysBoatDao) UpdateBoatWithTx(tx *gorm.DB, boat *models.SysBoat) error {
	db := tx
	if db == nil {
		db = dao.db
	}
	// return db.Save(boat).Error
	return db.Model(&models.SysBoat{}).
		Where("id = ?", boat.ID).
		Updates(boat).Error
}
