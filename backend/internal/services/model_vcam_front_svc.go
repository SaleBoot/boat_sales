package services

import (
	"boatsales-backend/internal/db/models"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// VCamTarget 对应 JSON 中的 target 结构
type VCamTarget struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// VCamRotation 对应 JSON 中的 rotation 结构
type VCamRotation struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// VCamFocusTargetDetail 对应 JSON 中 focusTargets 内部的每个相机配置
type VCamFocusTargetDetail struct {
	Zoom       int          `json:"zoom"`
	Target     VCamTarget   `json:"target"`
	Rotation   VCamRotation `json:"rotation"`
	CameraMode string       `json:"cameraMode"`
}

// VCamJSONData 对应整个 JSON 文件的结构
type VCamJSONData struct {
	ModelID      string                           `json:"modelId"`
	ModelPath    string                           `json:"modelPath"`
	UpdatedAt    string                           `json:"updatedAt"`
	FocusTargets map[string]VCamFocusTargetDetail `json:"focusTargets"`
}

func MakeModelFocusTargets(
	aModelPath string,
	aModelVCams []*models.SysModelVCam,
) (VCamJSONData, error) {
	if len(aModelVCams) == 0 {
		return VCamJSONData{}, nil
	}

	var vcamJSONData VCamJSONData

	// 1. 从 aModelPath 中提取 modelId
	vcamJSONData.ModelID = filepath.Base(aModelPath)
	vcamJSONData.ModelPath = aModelPath

	// 2. 初始化 FocusTargets map
	vcamJSONData.FocusTargets = make(map[string]VCamFocusTargetDetail)

	// 3. 遍历 aModelVCams，填充 FocusTargets
	for _, vcam := range aModelVCams {
		detail := VCamFocusTargetDetail{
			Zoom: vcam.Zoom,
			Target: VCamTarget{
				X: vcam.TargetX,
				Y: vcam.TargetY,
				Z: vcam.TargetZ,
			},
			Rotation: VCamRotation{
				X: vcam.RotationX,
				Y: vcam.RotationY,
				Z: vcam.RotationZ,
			},
			CameraMode: vcam.CameraMode,
		}
		vcamJSONData.FocusTargets[vcam.CameraName] = detail
	}

	// 4. 设置 UpdatedAt 为当前时间
	vcamJSONData.UpdatedAt = time.Now().Format(time.RFC3339)

	return vcamJSONData, nil
}

func (aS *ModelVCamService) TmpInitModelVCamTable() error {
	jsonRoot := "/mnt/disk2/abner/zdev/jobs/task/SalesBoat02/backend/focus-targets/"

	files, err := os.ReadDir(jsonRoot)
	if err != nil {
		return err
	}

	var allVCams []*models.SysModelVCam

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(jsonRoot, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return err
		}

		var jsonData VCamJSONData
		if err := json.Unmarshal(content, &jsonData); err != nil {
			return err
		}

		for cameraName, detail := range jsonData.FocusTargets {
			vCam := &models.SysModelVCam{
				ModelPath:  jsonData.ModelPath,
				CameraName: cameraName,
				Zoom:       detail.Zoom,
				TargetX:    detail.Target.X,
				TargetY:    detail.Target.Y,
				TargetZ:    detail.Target.Z,
				RotationX:  detail.Rotation.X,
				RotationY:  detail.Rotation.Y,
				RotationZ:  detail.Rotation.Z,
				CameraMode: detail.CameraMode,
			}
			allVCams = append(allVCams, vCam)
		}
	}

	if len(allVCams) > 0 {
		return aS.AddModelVCams(context.Background(), allVCams)
	}

	return nil
}

// ----------------------------------------------------
// GetModelVCamsByModelPath 根据模型路径获取所有相机配置
// ----------------------------------------------------
func (aS *ModelVCamService) GetModelVCamsByModelPath(
	aCtx context.Context,
	aModelPath string,
) ([]*models.SysModelVCam, error) {
	// 从数据库中查询所有相机配置
	vcams, err := aS.modelVCamDao.GetModelVCamsByModelPath(aCtx, aModelPath)
	if err != nil {
		return nil, err
	}
	return vcams, nil
}
