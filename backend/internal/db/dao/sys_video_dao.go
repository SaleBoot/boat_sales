package dao

import (
	"boatsales-backend/internal/db/models"

	"gorm.io/gorm"
)

type SysVideoDao struct {
	DB *gorm.DB
}

func NewSysVideoDao(db *gorm.DB) *SysVideoDao {
	return &SysVideoDao{DB: db}
}

// GetAllVideos retrieves all videos.
func (d *SysVideoDao) GetAllVideos() ([]models.SysVideo, error) {
	var videos []models.SysVideo
	result := d.DB.Find(&videos)
	return videos, result.Error
}

func (d *SysVideoDao) AddVideo(video *models.SysVideo) error {
	return d.DB.Create(video).Error
}

// 更新 ID 为 intId 的视频记录
func (d *SysVideoDao) UpdateVideo(intId uint, updateData *models.SysVideo) error {
	err := d.DB.Model(&models.SysVideo{}).
		Where("id = ?", intId).
		Updates(updateData).Error

	return err
}

func (d *SysVideoDao) DeleteVideos(ids []uint) error {
	return d.DB.Delete(&models.SysVideo{}, ids).Error
}

func (d *SysVideoDao) Count() (int64, error) {
	var count int64
	if err := d.DB.Model(&models.SysVideo{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
