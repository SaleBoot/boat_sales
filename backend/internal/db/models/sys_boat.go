package models

import "gorm.io/gorm"

// SysBoat represents the boat model in the database.
type SysBoat struct {
	gorm.Model
	BoatName        string  `json:"boatName" gorm:"type:varchar(128);comment:船舶名称"`
	ModelName       string  `json:"modelName" gorm:"type:varchar(128);comment:模型名(无空格英文名，唯一)，也是模型文件夹名"`
	Category        string  `json:"Category" gorm:"type:varchar(64);comment:船舶类型"`
	Price           int     `json:"Price" gorm:"type:int;comment:价格" `
	Description     string  `json:"description" gorm:"type:text;comment:简介"`
	OverallLength   float64 `json:"overallLength" gorm:"comment:总长"`
	WaterlineLength float64 `json:"waterlineLength" gorm:"comment:水线长"`
	Beam            float64 `json:"beam" gorm:"comment:船宽"`
	MoldedDepth     float64 `json:"moldedDepth" gorm:"comment:型深"`
	Draft           float64 `json:"draft" gorm:"comment:吃水"`
	NavigationArea  string  `json:"navigationArea" gorm:"type:varchar(64);comment:航区"`
	MainEnginePower string  `json:"mainEnginePower" gorm:"type:varchar(128);comment:主机功率"`
	DesignSpeed     float64 `json:"designSpeed" gorm:"comment:设计航速"`
	RatedCrew       int     `json:"ratedCrew" gorm:"comment:额定乘员"`
	PropulsionType  string  `json:"propulsionType" gorm:"type:varchar(64);comment:动力形式"`
	Material        string  `json:"material" gorm:"type:varchar(64);comment:材质"`
	CertificateType string  `json:"certificateType" gorm:"type:varchar(64);comment:证书类型"`
	AdImg0          string  `json:"adImg0" gorm:"type:varchar(255);comment:宣传图0路径"`
	AdImg1          string  `json:"adImg1" gorm:"type:varchar(255);comment:宣传图1路径"`
	AdImg2          string  `json:"adImg2" gorm:"type:varchar(255);comment:宣传图2路径"`
}

func (*SysBoat) TableName() string {
	return "sys_boats"
}
