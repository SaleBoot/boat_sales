package dao

import (
	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type SysModelEngineOptionsDao struct {
	DB *gorm.DB
}

func NewSysModelEngineOptionsDao(db *gorm.DB) *SysModelEngineOptionsDao {
	return &SysModelEngineOptionsDao{DB: db}
}

// 1. 根据 样式 ID 获取该模型已绑定的所有动力
// GET /api/admin/model-engine-options/list?modelId=xxx
// 返回：当前样式已勾选 / 已绑定的 engineID 列表 + 引擎详情（分类、名称、参数等）
func (d *SysModelEngineOptionsDao) GetEngineOptionsByModelID(
	modelID uint,
) ([]models.SysModelEngineOption, error) {

	var engineOptions []models.SysModelEngineOption
	result := d.DB.Where("modelID = ?", modelID).Find(&engineOptions)
	return engineOptions, result.Error
}

// 2. 为样式 新增一条动力绑定
// POST /api/admin/model-engine-options
// Body: { modelID: 样式ID, engineID: 引擎ID }
func (d *SysModelEngineOptionsDao) AddEngineOption(
	engineOption *models.SysModelEngineOption,
) error {
	return d.DB.
		Where("model_id = ? AND engine_id = ?",
			engineOption.ModelID,
			engineOption.EngineID,
		).
		FirstOrCreate(engineOption).
		Error
}

// 3. 删除样式下某一条动力绑定
// DELETE /api/admin/model-engine-options?modelID=xxx&engineID=xxx
func (d *SysModelEngineOptionsDao) DeleteEngineOption(
	aEngineOption *models.SysModelEngineOption,
) error {
	return d.DB.
		Where("model_id = ? AND engine_id = ?",
			aEngineOption.ModelID,
			aEngineOption.EngineID,
		).
		Delete(&models.SysModelEngineOption{}).
		Error
}

// DELETE /api/admin/model-engine-options/:modelID
func (d *SysModelEngineOptionsDao) DeleteEngineOptionsWithModelID(
	aModelID uint,
) error {
	return d.DB.
		Where("model_id = ?", aModelID).
		Delete(&models.SysModelEngineOption{}).
		Error
}

// 4. 批量保存（推荐，前端批量操作后一次性提交）
// POST /api/admin/model-engine-options/batch-save
//
//	Body: {
//	  modelID: 样式ID,
//	  engineIds: [1,2,3] // 最终保留的所有引擎ID
//	}
func (d *SysModelEngineOptionsDao) BatchSaveEngineOptions(
	aEngineOptions []models.SysModelEngineOption,
) error {
	return d.DB.
		Save(aEngineOptions).
		Error
}
