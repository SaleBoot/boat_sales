package dao

import (
	"context"
	"errors"
	"log"

	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type SysCosPathDao struct {
	db *gorm.DB
}

func NewSysCosPathDao(db *gorm.DB) *SysCosPathDao {
	return &SysCosPathDao{db: db}
}

// FindDirPaths 查询所有目录路径，用于缓存预热
func (dao *SysCosPathDao) FindDirPaths(
	ctx context.Context,
) ([]struct {
	ID   int64
	Path string
}, error) {
	var results []struct {
		ID   int64
		Path string
	}
	err := dao.db.
		WithContext(ctx).
		Model(&models.CosPathMeta{}).
		Where("is_dir = ?", true).
		Select("id", "path").
		Find(&results).Error
	return results, err
}

// Create 创建一条新的CosPathMeta记录
func (dao *SysCosPathDao) Create(
	ctx context.Context,
	record *models.CosPathMeta,
) error {
	return dao.db.WithContext(ctx).Create(record).Error
}

// FindByPath 根据路径查询节点
func (dao *SysCosPathDao) FindByPath(
	ctx context.Context,
	path string,
) (*models.CosPathMeta, error) {

	var node models.CosPathMeta
	err := dao.db.
		WithContext(ctx).
		Select("id").
		Where("path = ?", path).
		First(&node).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &node, nil
}

// FindSubNodes 查询指定父节点下的所有子节点
func (dao *SysCosPathDao) FindSubNodes(
	ctx context.Context,
	parentID int64,
) ([]models.CosPathMeta, error) {
	var subNodes []models.CosPathMeta
	err := dao.db.WithContext(ctx).
		Where("parent_id = ?", parentID).
		Order("is_dir DESC, name ASC").
		Find(&subNodes).Error
	return subNodes, err
}

// FindSubFiles 查询指定父节点下的所有子文件
func (dao *SysCosPathDao) FindSubFiles(
	ctx context.Context,
	parentID int64,
) ([]models.CosPathMeta, error) {
	var subFiles []models.CosPathMeta
	err := dao.db.WithContext(ctx).
		Where("parent_id = ? AND is_dir = ?", parentID, false).
		Order("name ASC").
		Find(&subFiles).Error
	return subFiles, err
}

// FindSubDirs 查询指定父节点下的所有子目录
func (dao *SysCosPathDao) FindSubDirs(
	ctx context.Context,
	parentID int64,
) ([]models.CosPathMeta, error) {
	var subDirs []models.CosPathMeta
	err := dao.db.WithContext(ctx).
		Where("parent_id = ? AND is_dir = ?", parentID, true).
		Order("name ASC").
		Find(&subDirs).Error
	return subDirs, err
}

// FindAllDescendantFilesByPath 查询指定路径下的所有后代文件节点
func (dao *SysCosPathDao) FindAllDescendantFilesByPath(
	ctx context.Context,
	pathPrefix string,
) ([]models.CosPathMeta, error) {
	var descendantFiles []models.CosPathMeta
	// 使用 LIKE 查询来匹配所有以给定路径为前缀的记录
	// pathPrefix 应该类似于 "/gltf/57sites/"
	err := dao.db.WithContext(ctx).
		Where("path LIKE ? AND is_dir = ?", pathPrefix+"%", false).
		Order("path ASC").
		Find(&descendantFiles).Error
	return descendantFiles, err
}

// DeleteAll 删除表中的所有记录
func (dao *SysCosPathDao) DeleteAll(ctx context.Context) error {
	// 使用 Unscoped().Delete 而不是 Delete 是为了确保物理删除，而不是软删除
	return dao.db.
		WithContext(ctx).
		Unscoped().
		Where("1 = 1").
		Delete(&models.CosPathMeta{}).Error
}

// BatchInsert 批量插入节点
func (dao *SysCosPathDao) BatchInsert(
	ctx context.Context,
	nodes []models.CosPathMeta,
) error {
	if len(nodes) == 0 {
		return nil
	}
	return dao.db.
		WithContext(ctx).
		CreateInBatches(nodes, 100).Error // 每100条记录一个批次
}

// BatchCreate 批量创建
// 注意：由于GORM的SQLite驱动在批量插入时对nil指针的处理存在兼容性问题（会生成不支持的DEFAULT关键字），
// 此处采用“在单个事务中循环创建”的策略。
// 这样既利用了单条Create对nil指针的正确处理，又通过事务大幅提升了写入性能，并保证了操作的原子性。
func (dao *SysCosPathDao) BatchCreate(
	ctx context.Context,
	records []*models.CosPathMeta,
) error {
	if len(records) == 0 {
		return nil
	}

	return dao.db.
		WithContext(ctx).
		Transaction(func(tx *gorm.DB) error {
			for _, record := range records {
				if err := tx.Create(record).Error; err != nil {
					// 任何一次创建失败，都会导致整个事务回滚
					return err
				}
			}
			// 所有记录创建成功，事务将在此处自动提交
			return nil
		})
}

// DeleteAll 删除表中的所有记录FindAll 获取所有记录
func (dao *SysCosPathDao) FindAll(
	ctx context.Context,
) ([]models.CosPathMeta, error) {
	var allPaths []models.CosPathMeta
	err := dao.db.
		WithContext(ctx).
		Find(&allPaths).Error
	return allPaths, err
}

// UpdateParentID 更新指定节点的ParentID
func (dao *SysCosPathDao) UpdateParentID(
	ctx context.Context,
	nodeID int64,
	parentID int64,
) error {

	return dao.db.
		WithContext(ctx).
		Model(&models.CosPathMeta{}).
		Where("id = ?", nodeID).
		Update("parent_id", parentID).Error
}

func (dao *SysCosPathDao) ExecInTransaction(
	ctx context.Context,
	aF func(tx *gorm.DB) error,
) error {
	return dao.db.WithContext(ctx).Transaction(aF)
}

func (dao *SysCosPathDao) GetFilesTotalSize(
	ctx context.Context,
) int64 {
	var totalSize int64

	// 1. 使用 Scan 替代 First
	// 2. 将 false 显式写作 0，确保与 tinyint(1) 完美匹配
	err := dao.db.
		WithContext(ctx).
		Model(&models.CosPathMeta{}).
		Where("is_dir = ?", 0).
		Select("COALESCE(SUM(size), 0)"). // 进阶：使用 COALESCE 防御 NULL
		Scan(&totalSize).
		Error

	if err != nil {
		// 这里打印日志，能帮你真正看清到底是数据库没数据，还是 SQL 报错了
		log.Printf("GetFilesTotalSize error: %v", err)
		return 0
	}

	return totalSize
}
