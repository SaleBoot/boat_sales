package models

import "gorm.io/gorm"

// 用来限定「某个3D模型/样式，能选哪些动力」
type SysModelEngineOption struct {
	gorm.Model
	//
	ModelID  uint `json:"modelID" gorm:"index;comment:关联默认样式ID,SysBoatModel.ID"`
	EngineID uint `json:"engineID" gorm:"index;comment:关联动力型号,SysEngine.ID"`
	// IsDefault bool `gorm:"default:false;comment:是否默认动力"`
}

func (*SysModelEngineOption) TableName() string {
	return "sys_model_engine_options"
}
