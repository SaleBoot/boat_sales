package dao

import (
	"boatsales-backend/internal/db/models"
	"fmt"

	"gorm.io/gorm"
)

type SysBoatEngineDao struct {
	DB *gorm.DB
}

func NewSysBoatEngineDao(db *gorm.DB) *SysBoatEngineDao {
	return &SysBoatEngineDao{DB: db}
}

// GetAllBoatEngines retrieves all boat engines.
func (d *SysBoatEngineDao) GetAllBoatEngines() ([]models.SysBoatEngine, error) {
	var engines []models.SysBoatEngine
	result := d.DB.Find(&engines)
	return engines, result.Error
}

// CreateBoatEngine creates a new boat engine.
func (d *SysBoatEngineDao) AddBoatEngine(engine *models.SysBoatEngine) error {
	// 查找条件：engine_name 一致
	// 查找不到则创建整条记录
	tx := d.DB.Where("engine_name = ?", engine.EngineName).FirstOrCreate(engine)

	// 处理数据库错误（如索引冲突、网络异常）
	if tx.Error != nil {
		return tx.Error
	}

	// tx.RowsAffected == 0 代表：查到已有数据，未新增
	if tx.RowsAffected == 0 {
		return fmt.Errorf("发动机名称[%s]已存在", engine.EngineName)
	}

	return nil
}

// GetBoatEngineByID retrieves a boat engine by its ID.
func (d *SysBoatEngineDao) GetBoatEngineByID(id uint) (*models.SysBoatEngine, error) {
	var engine models.SysBoatEngine
	result := d.DB.First(&engine, id)
	return &engine, result.Error
}

// UpdateBoatCategory updates an existing boat category.
func (d *SysBoatEngineDao) UpdateBoatCategory(engine *models.SysBoatEngine) error {
	return d.DB.Save(engine).Error
}

func (d *SysBoatEngineDao) UpdateBoatEngineByID(
	id uint,
	updateData *models.SysBoatEngine,
) error {

	return d.DB.Model(&models.SysBoatEngine{}).
		Where("id = ?", id).
		Updates(updateData). // Save(updateData)
		Error
}

// DeleteBoatEngines deletes boat engines by their IDs.
func (d *SysBoatEngineDao) DeleteBoatEngines(ids []uint) error {
	return d.DB.Delete(&models.SysBoatEngine{}, ids).Error
}

// Count returns the total number of boat engines.
func (d *SysBoatEngineDao) Count() (int64, error) {
	var count int64
	if err := d.DB.Model(&models.SysBoatEngine{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
