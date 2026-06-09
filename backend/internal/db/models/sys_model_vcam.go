package models

import "gorm.io/gorm"

// 一张“虚拟相机参数表”，在船舶 3D 预览系统里，它是视角预设（Focus Target）的核心数据源
type SysModelVCam struct {
	gorm.Model
	// 模型路径， "/gltf01/boat01/model01/model01.fbx"
	// 给前端提供 "/gltf01/boat01/model01"              这部分路径
	ModelPath  string  `json:"modelPath" gorm:"type:varchar(255);comment:模型路径"`
	CameraName string  `json:"cameraName" gorm:"type:varchar(255);comment:虚拟相机名称"`
	Zoom       int     `json:"zoom" gorm:"type:int;comment:缩放比例"`
	TargetX    float64 `json:"targetX" gorm:"type:float64;comment:焦点目标点X"`
	TargetY    float64 `json:"targetY" gorm:"type:float64;comment:焦点目标点Y"`
	TargetZ    float64 `json:"targetZ" gorm:"type:float64;comment:焦点目标点Z"`
	RotationX  float64 `json:"rotationX" gorm:"type:float64;comment:旋转角度X"`
	RotationY  float64 `json:"rotationY" gorm:"type:float64;comment:旋转角度Y"`
	RotationZ  float64 `json:"rotationZ" gorm:"type:float64;comment:旋转角度Z"`
	// 只有两个值：orbit 和 first-person
	CameraMode string `json:"cameraMode" gorm:"type:varchar(255);comment:相机模式"`
}

func (*SysModelVCam) TableName() string {
	return "sys_model_vcam"
}
