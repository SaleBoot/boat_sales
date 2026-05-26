//  id: 1, englishName: 'New Energy Ship', chineseName: '新能源船'

package models

import "gorm.io/gorm"

type SysBoatCategory struct {
	gorm.Model
	EnglishName string `json:"englishName" gorm:"type:varchar(64);comment:英文名称"`
	ChineseName string `json:"chineseName" gorm:"type:varchar(128);comment:中文名称"`
}

func (*SysBoatCategory) TableName() string {
	return "sys_boat_categories"
}
