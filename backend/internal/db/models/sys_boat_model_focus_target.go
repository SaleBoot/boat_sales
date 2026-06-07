package models

import "gorm.io/gorm"

// SysBoatModel represents the boat model in the database.
// 在cos上的模型文件夹结构 见 internal/db/models/sys_cos_path.go
type SysBoatModelFocusTarget struct {
	gorm.Model
	ModelRuntimePath string `json:"modelRuntimePath" gorm:"type:varchar(255);comment:焦点目标运行时使用的模型路径"`
}

func (*SysBoatModelFocusTarget) TableName() string {
	return "sys_boat_model_focus_target"
}
