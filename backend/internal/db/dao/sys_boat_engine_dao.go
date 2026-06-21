package dao

import (
	"boatsales-backend/internal/db/models"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type SysBoatEngineDao struct {
	DB *gorm.DB
}

func NewSysBoatEngineDao(db *gorm.DB) *SysBoatEngineDao {
	return &SysBoatEngineDao{DB: db}
}

func (d *SysBoatEngineDao) GetBoatEngines(
	aCategoryID string, // 传具体ID则按分类查，传 "" 则查全部
	aPage int,
	aPageSize int,
) ([]models.SysBoatEngine, int64, error) {
	categoryID := strings.TrimSpace(aCategoryID)

	var engines []models.SysBoatEngine
	var total int64

	// 1. 创建初始的 query 实例
	query := d.DB.Model(&models.SysBoatEngine{})

	// 2. 动态拼接条件（替代了旧版 GetAll 的逻辑）
	if categoryID != "" {
		query = query.Where("engine_category_id = ?", categoryID)
	}

	// 3. 【核心修复】使用 .Session(&gorm.Session{}) 分离 Count 和 Find 的上下文，防止互相污染
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 4. 执行分页查询
	result := query.Offset((aPage - 1) * aPageSize).
		Limit(aPageSize).
		Find(&engines)

	return engines, total, result.Error
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

func (d *SysBoatEngineDao) GetEnginesByIDs(
	aIDs []uint,
) ([]models.SysBoatEngine, error) {
	if len(aIDs) == 0 {
		return []models.SysBoatEngine{}, nil
	}

	var engines []models.SysBoatEngine
	result := d.DB.
		Model(&models.SysBoatEngine{}).
		Where("id IN (?)", aIDs).
		Find(&engines)

	return engines, result.Error
}

// UpdateBoatCategory updates an existing boat category.
func (d *SysBoatEngineDao) UpdateBoatCategory(engine *models.SysBoatEngine) error {
	return d.DB.
		Model(&models.SysBoatEngine{}).
		Save(engine).Error
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
func (d *SysBoatEngineDao) DeleteBoatEngines(aIDs []uint) error {
	if len(aIDs) == 0 {
		return nil
	}

	result := d.DB.
		Where("id IN ?", aIDs).
		Delete(&models.SysBoatEngine{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("no boat engine deleted")
	}

	return nil
}

// Count returns the total number of boat engines.
func (d *SysBoatEngineDao) Count() (int64, error) {
	var count int64
	err := d.DB.
		Model(&models.SysBoatEngine{}).
		Count(&count).
		Error
	if err != nil {
		return 0, err
	}
	return count, nil
}
