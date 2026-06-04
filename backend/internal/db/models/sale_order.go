package models

import "gorm.io/gorm"

// SalesOrder 完全对应 sales_order 表
type SalesOrder struct {
	gorm.Model
	Status          string `json:"status" gorm:"column:status;type:TEXT;not null"`
	ModelID         string `json:"modelID" gorm:"column:model_id;type:TEXT;not null;default:''"`
	ModelLabel      string `json:"modelLabel" gorm:"column:model_label;type:TEXT;not null;default:''"`
	CustomerName    string `json:"customerName" gorm:"column:customer_name;type:TEXT;not null"`
	CustomerContact string `json:"customerContact" gorm:"column:customer_contact;type:TEXT;not null"`
	Category        string `json:"category" gorm:"column:category;type:TEXT;not null;default:''"`
	//
	ExteriorLabel      string `json:"exteriorLabel" gorm:"column:exterior_label;type:TEXT;not null;default:''"`
	ExteriorColorLabel string `json:"exteriorColorLabel" gorm:"column:exterior_color_label;type:TEXT;default:''"`
	ExteriorColor      string `json:"exteriorColor" gorm:"column:exterior_color;type:TEXT;default:''"`
	//
	InteriorLabel      string `json:"interiorLabel" gorm:"column:interior_label;type:TEXT;not null;default:''"`
	InteriorColorLabel string `json:"interiorColorLabel" gorm:"column:interior_color_label;type:TEXT;default:''"`
	InteriorColor      string `json:"interiorColor" gorm:"column:interior_color;type:TEXT;default:''"`
	//
	DeckLabel      string `json:"deckLabel" gorm:"column:deck_label;type:TEXT;not null;default:''"`
	DeckColorLabel string `json:"deckColorLabel" gorm:"column:deck_color_label;type:TEXT;default:''"`
	DeckColor      string `json:"deckColor" gorm:"column:deck_color;type:TEXT;default:''"`
	//
	PowerLabel string `json:"powerLabel" gorm:"column:power_label;type:TEXT;not null;default:''"`
	//
	OptionalPackageLabels []string `json:"optionalPackageLabels" gorm:"column:optional_package_labels;type:JSON;not null;default:'[]'"` // 改这里
	//
	TotalPrice int    `json:"totalPrice" gorm:"column:total_price;type:INTEGER;not null;default:0"`
	Source     string `json:"source" gorm:"column:source;type:TEXT;not null;default:'showcase-web'"`
}

// 绑定表名
func (SalesOrder) TableName() string {
	return "sales_order"
}

// // 索引：idx_sales_orders_status_created (status, created_at DESC)
// type SalesOrderIndex struct{}

// func (SalesOrderIndex) TableName() string {
// 	return "sales_orders"
// }

// func (SalesOrderIndex) Indexes() []gorm.Index {
// 	return []gorm.Index{
// 		{
// 			Name:    "idx_sales_orders_status_created",
// 			Columns: []string{"status", "created_at"},
// 			Desc:    []bool{false, true}, // created_at DESC
// 		},
// 	}
// }
