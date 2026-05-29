package models

import (
	"time"
)

// CosPathMeta 对应存储桶路径拓扑表
type CosPathMeta struct {
	ID        int64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ParentID  int64     `gorm:"column:parent_id;not null;default:0;index:idx_parent_name,priority:1" json:"parent_id"`
	Name      string    `gorm:"column:name;type:varchar(255);not null;index:idx_parent_name,priority:2" json:"name"`
	Path      string    `gorm:"column:path;type:varchar(1024);not null;index:idx_path,length:255" json:"path"`
	IsDir     bool      `gorm:"column:is_dir;type:tinyint(1);not null;default:0" json:"is_dir"`
	CosKey    *string   `gorm:"column:cos_key;type:varchar(1024);default:null" json:"cos_key,omitempty"`
	Size      int64     `gorm:"column:size;not null;default:0" json:"size"`
	UpdatedAt time.Time `gorm:"column:updated_at;type:datetime;not null;default:CURRENT_TIMESTAMP;autoUpdateTime" json:"updated_at"`
}

// TableName 显式指定表名，保持全局语义统一
func (CosPathMeta) TableName() string {
	return "cos_path_meta"
}
