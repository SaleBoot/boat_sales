package dao

import (
	"boatsales-backend/internal/db/models"
	"context"
	"errors"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
)

type SysModelVCamDao struct {
	db *gorm.DB
}

func NewSysModelVCamDao(db *gorm.DB) *SysModelVCamDao {

	return &SysModelVCamDao{db: db}
}

// --------------------------------------------------
// AddModelVCam 添加模型相机配置
// --------------------------------------------------
// @param ctx 上下文
// @param aModelVCam 模型相机配置列表
// @return error 错误信息
func (d *SysModelVCamDao) AddModelVCams(
	ctx context.Context,
	aModelVCam []*models.SysModelVCam,
) error {
	if len(aModelVCam) == 0 {
		return nil
	}

	return d.db.Transaction(func(tx *gorm.DB) error {
		for _, vcam := range aModelVCam {
			// 检查是否已存在相同 ModelPath 和 CameraName 的配置
			var existing models.SysModelVCam
			err := tx.WithContext(ctx).Where(
				"model_path = ? AND camera_name = ?",
				vcam.ModelPath,
				vcam.CameraName,
			).First(&existing).Error

			if err == nil {
				// 已存在，可以选择更新或跳过
				continue
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			// 不存在，创建新记录
			if err := tx.WithContext(ctx).Create(vcam).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *SysModelVCamDao) GetModelVCamsByModelPath(
	ctx context.Context,
	aModelPath string,
) ([]*models.SysModelVCam, error) {
	modelPathTmp := strings.TrimSpace(aModelPath)
	fileName := filepath.Base(modelPathTmp)
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext != ".glb" && ext != ".fbx" {
		return nil, nil
	}

	modelPathTmp = filepath.Dir(modelPathTmp)
	if modelPathTmp == "." || modelPathTmp == "" {
		return nil, nil
	}

	var models []*models.SysModelVCam
	err := s.db.WithContext(ctx).Where("model_path like ?", modelPathTmp+"%").Find(&models).Error
	if err != nil {
		return nil, err
	}
	return models, nil
}
