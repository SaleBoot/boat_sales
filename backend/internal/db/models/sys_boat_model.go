package models

import "gorm.io/gorm"

// SysBoatModel represents the boat model in the database.
// 在cos上的模型文件夹结构 见 internal/db/models/sys_cos_path.go
type SysBoatModel struct {
	gorm.Model
	// BoatEnName + ModelName 共同唯一确定一个具体的模型文件夹（即默认样式文件夹）
	BoatEnName       string  `json:"boatEnName" gorm:"type:varchar(128);comment:船型名称,无空格英文名，也是模型文件夹名"`
	ModelName        string  `json:"modelNb" gorm:"type:varchar(255);comment:默认样式的名称"`
	ModelDescription string  `json:"modelDescription" gorm:"type:varchar(255);comment:默认样式的描述"`
	ModelRuntimePath string  `json:"modelRuntimePath" gorm:"type:varchar(255);comment:默认样式运行时使用的模型路径"`
	ModelAddedPrice  float64 `json:"modelAddedPrice" gorm:"type:decimal(10,2);comment:默认样式的加价"`
}

func (*SysBoatModel) TableName() string {
	return "sys_boat_model"
}
