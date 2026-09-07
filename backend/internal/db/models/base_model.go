package models

import (
	"time"

	"gorm.io/gorm"
	// "gorm.io/gorm"
)

// BaseModel 自定义项目通用基础模型,代替 gorm.Model
type BaseModel struct {
	// 主键不用 uint，改用 int64。兼容自增、雪花ID，且前端安全
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id,string"`
	CreatedAt time.Time `gorm:"comment:创建时间" json:"createdAt"`
	UpdatedAt time.Time `gorm:"comment:更新时间" json:"updatedAt"`
	// 把软删除剥离出去，作为可选组件
}

// 带软删除的扩展基础模型，需要软删的表再内嵌它
type SoftDeleteModel struct {
	BaseModel
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// 全局钩子，统一自动填充时间，所有继承BaseModel的表自动生效
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	now := time.Now()
	b.CreatedAt = now
	b.UpdatedAt = now
	return nil
}

func (b *BaseModel) BeforeUpdate(tx *gorm.DB) error {
	b.UpdatedAt = time.Now()
	return nil
}
