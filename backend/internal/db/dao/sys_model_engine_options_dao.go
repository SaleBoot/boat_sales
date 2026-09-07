package dao

import (
	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type SysModelEngineOptionsDao struct {
	db *gorm.DB
}

func NewSysModelEngineOptionsDao(db *gorm.DB) *SysModelEngineOptionsDao {
	return &SysModelEngineOptionsDao{db: db}
}

func (d *SysModelEngineOptionsDao) GetAllOptions() ([]*models.SysModelEngineOption, error) {
	var options []*models.SysModelEngineOption
	err := d.db.
		Model(&models.SysModelEngineOption{}).
		Find(&options).Error
	if err != nil {
		return nil, err
	}
	return options, nil
}

// 1. 根据 样式ID(modelID) 获取该模型已绑定的所有动力
// GET /api/admin/model-engine-options/list?modelId=xxx
// 返回：当前样式已勾选 / 已绑定的 modelID/engineID 列表
func (d *SysModelEngineOptionsDao) GetEngineOptionsByModelID(
	modelID uint,
) ([]models.SysModelEngineOption, error) {

	var engineOptions []models.SysModelEngineOption
	result := d.db.
		Model(&models.SysModelEngineOption{}).
		Where("modelID = ?", modelID).
		Find(&engineOptions)

	return engineOptions, result.Error
}

// 批量 ModelID 查询
func (d *SysModelEngineOptionsDao) GetEngineOptionsByModelIDs(
	modelIDs []uint,
) ([]models.SysModelEngineOption, error) {
	// 空切片直接返回，避免无效 SQL
	if len(modelIDs) == 0 {
		return []models.SysModelEngineOption{}, nil
	}

	var engineOptions []models.SysModelEngineOption
	// 使用数据库标准蛇形字段 model_id
	result := d.db.
		Model(&models.SysModelEngineOption{}).
		Where("model_id IN (?)", modelIDs).
		Find(&engineOptions)
	return engineOptions, result.Error
}

// 2. 为样式 新增一条动力绑定
// POST /api/admin/model-engine-options
// Body: { modelID: 样式ID, engineID: 引擎ID }
func (d *SysModelEngineOptionsDao) AddEngineOption(
	engineOption *models.SysModelEngineOption,
) error {
	return d.db.
		Model(&models.SysModelEngineOption{}).
		Where("model_id = ? AND engine_id = ?",
			engineOption.ModelID,
			engineOption.EngineID,
		).
		FirstOrCreate(engineOption).
		Error
}

// SysModelEngineOptionsDao 新增方法
// DeleteByBoatEnName 根据船英文名，级联删除所有动力关联配置
func (d *SysModelEngineOptionsDao) DeleteByBoatEnName(
	tx *gorm.DB,
	boatEnName string,
) error {
	if boatEnName == "" {
		return nil
	}

	// 子查询：查出该船所有 model_id
	subQuery := tx.
		Model(&models.SysBoatModel{}).
		Where("boat_en_name = ?", boatEnName).
		Select("id")

	// 删除关联表中属于这些 model_id 的数据
	return tx.
		Where("model_id IN (?)", subQuery).
		Delete(&models.SysModelEngineOption{}).Error
}

func (d *SysModelEngineOptionsDao) DeleteByBoatModelIDs(
	aTx *gorm.DB,
	aModelIDs []uint,
) error {

	// 删除关联表中属于这些 model_id 的数据
	return aTx.
		Where("model_id IN (?)", aModelIDs).
		Delete(&models.SysModelEngineOption{}).Error
}

func (d *SysModelEngineOptionsDao) ReplaceEngineOptionsByModelIDs(
	aModelIDs []uint,
	aOptions []models.SysModelEngineOption,
) error {

	return d.db.Transaction(func(tx *gorm.DB) error {
		// 1. Delete all old records for the given modelIDs
		err := tx.Where("model_id IN (?)", aModelIDs).
			Delete(&models.SysModelEngineOption{}).Error
		if err != nil {
			return err
		}

		// 2. Create the new records
		// Note: Only proceed to create if there are models to add.
		if len(aOptions) > 0 {
			// IMPORTANT: Zero out the ID of each model before creating.
			// This ensures that GORM treats them as new records and allows the database
			// to assign a new auto-incremented primary key.
			// This prevents "UNIQUE constraint failed: sys_boat_model.id" errors
			// when the client sends back models with their old IDs.
			for _, model := range aOptions {
				model.ID = 0
			}

			if err := tx.Create(&aOptions).Error; err != nil {
				return err
			}
		}

		// return nil will commit the transaction
		return nil
	})
}
