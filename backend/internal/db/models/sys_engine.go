package models

import "gorm.io/gorm"

// Engine 动力型号（具体型号）
// 用于存储不同动力类型的型号信息，如柴油发动机、汽油发动机、电动机等。
type SysBoatEngine struct {
	gorm.Model

	// 关联EngineCategory.StrID
	EngineCategoryID string `json:"engineCategoryID" gorm:"index;comment:关联动力类型"`
	EngineName       string `json:"engineName" gorm:"type:varchar(128);comment:引擎型号名称"`

	PowerKW      float64 `json:"powerKW" gorm:"type:decimal(6,2);comment:额定功率(kW)"`
	BatteryKWh   float64 `json:"batteryKWh" gorm:"type:decimal(6,2);comment:电池容量(kWh，电动用)"`
	Displacement float64 `json:"displacement" gorm:"type:real;comment:排量(L)，电动机型填0"`
	Description  string  `json:"description" gorm:"type:text;comment:引擎型号描述"`
}

func (*SysBoatEngine) TableName() string {
	return "sys_boat_engines"
}
