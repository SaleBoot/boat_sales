package models

import "gorm.io/gorm"

// SysBoatModel represents the boat model in the database.
// 在cos上的模型文件夹结构 见 internal/db/models/sys_cos_path.go
type SysBoatModel struct {
	gorm.Model
	// BoatEnName + ModelName 共同唯一确定一个具体的模型文件夹（即默认样式文件夹）
	// todo: BoatEnName 改成 BoatID,
	BoatEnName string `json:"boatEnName" gorm:"type:varchar(128);comment:船型名称,无空格英文名，也是模型文件夹名"`
	// ModelName 改成 ModelID
	ModelName        string `json:"modelName" gorm:"type:varchar(255);comment:默认样式的名称"`
	ModelRuntimePath string `json:"modelRuntimePath" gorm:"type:varchar(255);comment:默认样式运行时使用的模型路径"`

	// 外观相关
	ExteriorName       string `json:"exteriorName" gorm:"type:varchar(255);comment:外观名称"`
	ExteriorDescr      string `json:"exteriorDescr" gorm:"type:text;comment:外观描述"`
	ExteriorAddedPrice int    `json:"exteriorAddedPrice" gorm:"type:integer;comment:外观加价"`
	// 内饰相关
	InteriorName       string `json:"interiorName" gorm:"type:varchar(255);comment:内饰名称"`
	InteriorDescr      string `json:"interiorDescr" gorm:"type:text;comment:内饰描述"`
	InteriorAddedPrice int    `json:"interiorAddedPrice" gorm:"type:integer;comment:内饰加价"`
	// 甲板相关
	DeckName       string `json:"deckName" gorm:"type:varchar(255);comment:甲板名称"`
	DeckDescr      string `json:"deckDescr" gorm:"type:text;comment:甲板描述"`
	DeckAddedPrice int    `json:"deckAddedPrice" gorm:"type:integer;comment:甲板加价"`
	// 动力相关
	PowerName       string `json:"powerName" gorm:"type:varchar(255);comment:动力名称"`
	PowerDescr      string `json:"powerDescr" gorm:"type:text;comment:动力描述"`
	PowerAddedPrice int    `json:"powerAddedPrice" gorm:"type:integer;comment:动力加价"`
	// 智能系统相关
	SmartSystemName       string `json:"smartSystemName" gorm:"type:varchar(255);comment:智能系统名称"`
	SmartSystemDescr      string `json:"smartSystemDescr" gorm:"type:text;comment:智能系统描述"`
	SmartSystemAddedPrice int    `json:"smartSystemAddedPrice" gorm:"type:integer;comment:智能系统加价"`
}

func (*SysBoatModel) TableName() string {
	return "sys_boat_model"
}
