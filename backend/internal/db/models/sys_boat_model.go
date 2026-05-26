package models

import "gorm.io/gorm"

// SysBoat represents the boat model in the database.
type SysBoatModel struct {
	gorm.Model
	ChineseName string `json:"chineseName" gorm:"type:varchar(128);comment:船舶中文名称"`
	EnglishName string `json:"englishName" gorm:"type:varchar(128);comment:船舶英文名称"`
	Category    string `json:"Category" gorm:"type:varchar(64);comment:船舶类型"`
	// Order Config 订购页配置

	// 模型渲染参数配置
}

func (*SysBoatModel) TableName() string {
	return "sys_boat_model"
}
