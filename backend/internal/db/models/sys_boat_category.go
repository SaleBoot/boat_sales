package models

import (
	"gorm.io/gorm"
)

type SysBoatCategory struct {
	gorm.Model
	//
	CategoryStrID string `json:"categoryStrID" gorm:"type:varchar(64);uniqueIndex;comment:唯一标识ID"`
	EnName        string `json:"enName" gorm:"type:varchar(64);comment:英文名称"`
	CnName        string `json:"cnName" gorm:"type:varchar(128);comment:中文显示名称"`
}

func (*SysBoatCategory) TableName() string {
	return "sys_boat_categories"
}

func BoatCategory_arrayToMap(categories []SysBoatCategory) map[string]SysBoatCategory {
	m := make(map[string]SysBoatCategory)
	for _, category := range categories {
		m[category.CategoryStrID] = category
	}
	return m
}

func BoatCategory_mapToArray(m map[string]SysBoatCategory) []SysBoatCategory {
	categories := make([]SysBoatCategory, 0)

	for categoryStrID, category := range m {
		categories = append(categories, SysBoatCategory{
			CategoryStrID: categoryStrID,
			EnName:        category.EnName,
			CnName:        category.CnName,
		})
	}
	return categories
}
