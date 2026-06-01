package models

import "gorm.io/gorm"

//  BoatName、BoatEnName 是“双重唯一性约束” 或 “独立唯一索引”，类似于用户表中的手机号和身份证号。
//  也就是说，BoatName 和 BoatEnName 都必须是唯一的，不能重复。
//  无论是 BoatName 还是 BoatEnName，只要有一个重复了，就不能插入新的记录。
//
// 某系统用户表中的手机号和身份证号 。a 字段是 手机号（Unique）， b 字段是 身份证号（Unique）
// 业务逻辑： * 如果一个新用户来注册，只要他的手机号被人用过了（a相同），拒绝！
//          * 或者他的身份证号被人用过了（b相同），也拒绝！
//          * 只有当手机号和身份证号都是全新的，才允许注册。

// SysBoat represents the boat model in the database.
type SysBoat struct {
	gorm.Model
	BoatName        string  `json:"boatName" gorm:"type:varchar(128);comment:船舶名称"`
	BoatEnName      string  `json:"boatEnName" gorm:"type:varchar(128);comment:无空格英文名，也是模型文件夹名;unique"`
	Category        string  `json:"category" gorm:"type:varchar(64);comment:船舶类型英文名"`
	Price           int     `json:"price" gorm:"type:int;comment:价格" `
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
}

func (*SysBoat) TableName() string {
	return "sys_boats"
}
