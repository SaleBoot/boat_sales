package dao

import (
	"boatsales-backend/internal/db/models"
	"context"
	"strings"

	"gorm.io/gorm"
)

type SysBoatModelDao struct {
	db *gorm.DB
}

func NewSysBoatModelDao(db *gorm.DB) *SysBoatModelDao {
	return &SysBoatModelDao{db: db}
}

func (dao *SysBoatModelDao) ExecInTransaction(
	ctx context.Context,
	aF func(tx *gorm.DB) error,
) error {
	return dao.db.WithContext(ctx).Transaction(aF)
}

func (s *SysBoatModelDao) GetModelsByBoatEnName(
	aBoatEnName string,
) ([]models.SysBoatModel, error) {

	if len(strings.TrimSpace(aBoatEnName)) == 0 {
		return []models.SysBoatModel{}, nil
	}

	// 指明从 models.SysBoatModel 对应表查询
	var models []models.SysBoatModel
	err := s.db.
		Where("boat_en_name = ?", aBoatEnName).
		Find(&models).Error

	if err != nil {
		return nil, err
	}
	return models, nil
}

func (s *SysBoatModelDao) GetModelIDsByBoatEnNameWithTx(
	aTx *gorm.DB,
	aBoatEnNames []string,
) ([]uint, error) {
	var modelIDs []uint

	// 指明从 models.SysBoatModel 对应表查询，只查 id 字段
	err := aTx.
		Model(&models.SysBoatModel{}).
		Where("boat_en_name IN ?", aBoatEnNames).
		Pluck("id", &modelIDs).Error

	if err != nil {
		return nil, err
	}
	return modelIDs, nil
}

// ReplaceModelsByBoatEnName atomically replaces all models for a given boatEnName.
// It does this within a transaction by first deleting all existing models for the boatEnName,
// and then creating the new ones from the provided slice.
// ReplaceModelsByBoatEnName atomically replaces all models for a given boatEnName.
// It does this within a transaction by first deleting all existing models for the boatEnName,
// and then creating the new ones from the provided slice.
func (s *SysBoatModelDao) ReplaceModelsByBoatEnName(
	boatEnName string,
	aModels []*models.SysBoatModel,
) error {

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Delete all old records for the given boat_en_name
		err := tx.Where("boat_en_name = ?", boatEnName).
			Delete(&models.SysBoatModel{}).Error
		if err != nil {
			return err
		}

		// 2. Create the new records
		// Note: Only proceed to create if there are models to add.
		if len(aModels) > 0 {
			// IMPORTANT: Zero out the ID of each model before creating.
			// This ensures that GORM treats them as new records and allows the database
			// to assign a new auto-incremented primary key.
			// This prevents "UNIQUE constraint failed: sys_boat_model.id" errors
			// when the client sends back models with their old IDs.
			for _, model := range aModels {
				model.ID = 0
			}

			if err := tx.Create(&aModels).Error; err != nil {
				return err
			}
		}

		// return nil will commit the transaction
		return nil
	})
}

func (s *SysBoatModelDao) GetAllModels() ([]*models.SysBoatModel, error) {

	var models []*models.SysBoatModel
	err := s.db.Find(&models).Error
	if err != nil {
		return nil, err
	}
	return models, nil
}

func (s *SysBoatModelDao) UpdateBoatEnNameWithTx(
	tx *gorm.DB,
	aOldBoatEnName string,
	aNewBoatEnName string,
) error {
	db := tx
	if db == nil {
		db = s.db
	}

	return db.Model(&models.SysBoatModel{}).
		Where("boat_en_name = ?", aOldBoatEnName).
		Update("boat_en_name", aNewBoatEnName).
		Error
}

func (s *SysBoatModelDao) DeleteByBoatEnNamesWithTx(
	tx *gorm.DB,
	aBoatEnNames []string,
) error {
	db := tx
	if db == nil {
		db = s.db
	}

	return tx.Where("boat_en_name IN ?", aBoatEnNames).
		Delete(&models.SysBoatModel{}).
		Error
}
