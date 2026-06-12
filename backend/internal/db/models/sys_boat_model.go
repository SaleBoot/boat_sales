package models

import "gorm.io/gorm"

// SysBoatModel represents the boat model舰船模型（不是“舰船型号”） in the database.
// 在cos上的模型文件夹结构 见 internal/db/models/sys_cos_path.go
type SysBoatModel struct {
	gorm.Model
	// BoatEnName + ModelName 共同唯一确定一个具体的模型文件夹（即默认样式文件夹）
	// todo: BoatEnName 改成 BoatID,
	BoatEnName string `json:"boatEnName" gorm:"type:varchar(128);comment:船型名称,无空格英文名，也是模型文件夹名"`

	ModelName        string `json:"modelName" gorm:"type:varchar(255);comment:默认样式的名称"`
	ModelRuntimePath string `json:"modelRuntimePath" gorm:"type:varchar(255);comment:默认样式运行时使用的模型路径"`
	// ==============================
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

	// 关联 SysModelEngineOption， 用来限定「某个3D模型/样式，能选哪些动力」

	// ===== Panel 2：动力与性能（针对该3D模型的默认参数）=====
	DesignSpeed  float64 `json:"designSpeed" gorm:"type:decimal(6,2);comment:设计航速(km/h)"`
	CruiseSpeed  float64 `json:"cruiseSpeed" gorm:"type:decimal(6,2);comment:巡航航速(km/h)"`
	CruiseRange  float64 `json:"cruiseRange" gorm:"type:decimal(6,2);comment:续航能力,单位km"`
	CabinType    string  `json:"cabinType"   gorm:"type:varchar(32);comment:驾舱形式,BoatCabinType.StrID"`
	ControlMode  string  `json:"controlMode" gorm:"type:varchar(64);comment:操控方式,BoatCtrlMode.StrID"`
	PassengerNum int     `json:"passengerNum" gorm:"comment:额定乘员"`

	// ===== Panel 3：智能系统（针对该3D模型的默认配置）=====
	SmartSystemName  string `json:"smartSystemName" gorm:"type:varchar(255);comment:智能系统名称"`
	SmartSystemDescr string `json:"smartSystemDescr" gorm:"type:text;comment:智能系统描述"`
}

func (*SysBoatModel) TableName() string {
	return "sys_boat_model"
}
