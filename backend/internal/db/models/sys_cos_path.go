package models

import (
	"time"
)

/*
无空格英文船型名称 作为该船型的模型文件夹名，该文件夹下包含 3-4个子文件夹，
分别装着默认样式的模型。

在cos上的模型文件夹结构如下面所示：

gltf
|----57sites（无空格、小写英文的 船型名称）
|       |
|       |----57sites01（默认样式1）
|       |       |----  adimg1.png  ( 宣传图1，一个模型对应4张宣传图)
|       |       |----  adimg2.png  ( 宣传图2)
|       |       |----  adimg3.png  ( 宣传图3)
|       |       |----  adimg4.png  ( 宣传图4)
|       |       |----  57sites01.fbx
|       |       |----  57sites01.glb
|       |       |----  mat_part01_basecolor.png
|       |       |----  mat_part01_normal.png
|       |       |----  mat_part01_ao.png
|       |       |------mat_part01_roughness.png
|       |       |------mat_part01_metalness.png
|       |       |----  mat_part02_basecolor.png
|       |       |----  mat_part02_normal.png
|       |       |----  mat_part02_ao.png
|       |       |------mat_part02_roughness.png
|       |       |------mat_part02_metalness.png
|       |----57sites02（默认样式2）
|       |          .............
|       |----57sites03（默认样式3）
|       |        ..................
|       |----57sites04（默认样式4）
|----another_boat_type

*/

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
