package models

import "gorm.io/gorm"

type SysVideo struct {
	gorm.Model
	Title        string `json:"title" gorm:"type:varchar(128);comment:视频标题"`
	Url          string `json:"url" gorm:"type:varchar(128);comment:视频URL"`
	Introduction string `json:"introduction" gorm:"type:text;comment:视频简介"`
}

func (*SysVideo) TableName() string {
	return "sys_videos"
}
