//  id: 1, englishName: 'New Energy Ship', chineseName: '新能源船'

package models

import (
	"gorm.io/gorm"
)

type SysBoatCategory struct {
	gorm.Model
	EnglishName string `json:"englishName" gorm:"type:varchar(64);comment:英文名称"`
	ChineseName string `json:"chineseName" gorm:"type:varchar(128);comment:中文名称"`
}

func (*SysBoatCategory) TableName() string {
	return "sys_boat_categories"
}

func BoatCategory_arrayToMap(categories []SysBoatCategory) map[string]string {
	m := make(map[string]string)
	for _, category := range categories {
		m[category.EnglishName] = category.ChineseName
	}
	return m
}

func BoatCategory_mapToArray(m map[string]string) []SysBoatCategory {
	categories := make([]SysBoatCategory, 0)

	for englishName, chineseName := range m {
		categories = append(categories, SysBoatCategory{
			EnglishName: englishName,
			ChineseName: chineseName,
		})
	}
	return categories
}
