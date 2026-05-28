package models

import "gorm.io/gorm"

// SysBoat represents the boat model in the database.
type SysBoatModel struct {
	gorm.Model
	ModelName        string `json:"modelName" gorm:"type:varchar(128);comment:船舶模型名称"`
	FolderPath       string `json:"folderPath" gorm:"type:varchar(255);comment:模型文件夹路径"`
	RuntimeModelPath string `json:"runtimeModelPath" gorm:"type:varchar(255);comment:运行时使用 的模型路径"`
	// Order Config 订购页配置

	// 模型渲染参数配置

}

func (*SysBoatModel) TableName() string {
	return "sys_boat_model"
}
