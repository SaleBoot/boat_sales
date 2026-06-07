package services

import (
	"boatsales-backend/internal/db/models"
	"fmt"
	"path/filepath"
	"strings"
)

func (aH *BoatModelService) GetAllModels() ([]*models.SysBoatModel, error) {

	models, err := aH.BoatModelDao.GetAllModels()
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	return models, nil
}

// 	// --- 示例 ---
// 	// 1. 带有变体后缀的文件名: "mat_xx01_xx.png" -> "mat_xx01"
// 	path1 := "/gltf01/boatA/model01/mat_xx01_xx.png"
// 	fmt.Println(getMatSlot(path1)) // 输出: mat_xx01

// // 2. 基础材质文件名: "mat_01.png" -> "mat_01"
// path2 := "/gltf01/mat_01.png"
// fmt.Println(getMatSlot(path2)) // 输出: mat_01
func ParseMatSlotNameAndTexType(p string) (string, string) {
	// 1. 提取文件名，例如 "mat_xx01_xx.png"
	fileName := filepath.Base(p)

	// 2. 检查是否以 "mat_" 开头
	if !strings.HasPrefix(fileName, "mat_") {
		// log.Printf("getMatSlot(): fileName does not start with 'mat_': %s", fileName)
		return "", ""
	}

	// 3. 移除文件扩展名，得到 "mat_xx01_xx"
	fileNameNoExt := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	var matSlotName string = fileNameNoExt
	var texType string = "basecolor"
	// 4. 查找最后一个下划线的位置
	lastUnderscore := strings.LastIndex(fileNameNoExt, "_")

	// 5. 如果最后一个下划线是 "mat_" 的一部分（即位置<=3），
	//    或者根本没有其他下划线，则整个无扩展名的文件名就是槽位名。
	//    例如 "mat_engine" -> "mat_engine"
	if lastUnderscore <= 3 {
		matSlotName = fileNameNoExt
		texType = "basecolor"
		return matSlotName, texType
	}

	// 6. 否则，槽位名是最后一个下划线之前的部分。
	//    例如 "mat_xx01_xx" -> "mat_xx01"
	matSlotName = fileNameNoExt[:lastUnderscore]
	texType = fileNameNoExt[lastUnderscore+1:]
	return matSlotName, texType
}

func FilterModelPartPaths(
	aModelRuntimePath string,
	aCosFilePaths []models.CosPathMeta,
) ([]string, error) {
	modelDirPath := filepath.Dir(aModelRuntimePath)
	modelDirPath = strings.TrimSpace(modelDirPath)
	if modelDirPath == "." || modelDirPath == "" {
		return []string{}, nil
	}
	// if strings.Contains(modelDirPath, "950FUGUsites") {// for debug
	// 	log.Println("950FUGUsites...")
	// }
	const cPartCount int = 8
	partPaths := make([]string, 0, cPartCount)

	// 获取aModelRuntimePath的文件类型并判断
	runtimeFileName := strings.ToLower(filepath.Base(aModelRuntimePath)) // 提取纯文件名，防止 curPath 是 "../"
	if runtimeFileName == "." || runtimeFileName == ".." {
		return []string{}, nil
	}

	allowedExt := strings.ToLower(filepath.Ext(runtimeFileName))
	if allowedExt != ".glb" && allowedExt != ".fbx" {
		return []string{}, nil
	}

	//
	for _, path := range aCosFilePaths {
		curPath := strings.TrimSpace(path.Path)
		if curPath == "" {
			continue
		}
		// if strings.Contains(curPath, "950FUGUsites") {
		// 	log.Println("950FUGUsites...")
		// }

		// 只要当前模型目录下的 文件
		rel, err := filepath.Rel(modelDirPath, curPath)
		if err != nil || strings.HasPrefix(rel, "..") {
			continue
		}

		// 检查文件类型
		fileName := strings.ToLower(filepath.Base(curPath)) // 提取纯文件名，防止 curPath 是 "../"
		if fileName == "." || fileName == ".." {            // 防御路径穿越
			continue
		}

		ext := strings.ToLower(filepath.Ext(fileName))
		if ext != allowedExt {
			continue
		}

		// 写回 alice
		partPaths = append(partPaths, curPath)
		if len(partPaths) >= cPartCount {
			break
		}
	}

	return partPaths, nil
}

func FilterModelAdImgs(
	aModelRuntimePath string,
	aCosFilePaths []models.CosPathMeta,
) ([]string, error) {
	modelDirPath := filepath.Dir(aModelRuntimePath)
	modelDirPath = strings.TrimSpace(modelDirPath)
	if modelDirPath == "." || modelDirPath == "" {
		return []string{}, nil
	}
	// if strings.Contains(modelDirPath, "950FUGUsites") {
	// 	log.Println("950FUGUsites...")
	// }
	adimgs := make([]string, 0, 4)

	allowedExts := map[string]bool{
		".jpg":  true,
		".png":  true,
		".jpeg": true,
		".webp": true,
	}

	for _, path := range aCosFilePaths {
		curPath := strings.TrimSpace(path.Path)
		if curPath == "" {
			continue
		}
		// if strings.Contains(curPath, "950FUGUsites") {
		// 	log.Println("950FUGUsites...")
		// }

		// 只处理当前模型目录下的 文件
		rel, err := filepath.Rel(modelDirPath, curPath)
		if err != nil || strings.HasPrefix(rel, "..") {
			continue
		}

		// 检查文件类型
		fileName := strings.ToLower(filepath.Base(curPath)) // 提取纯文件名，防止 curPath 是 "../"
		if fileName == "." || fileName == ".." {            // 防御路径穿越
			continue
		}

		ext := strings.ToLower(filepath.Ext(fileName))
		if !allowedExts[ext] {
			continue
		}

		// 宣传图必须有前缀"adimg"
		if !strings.HasPrefix(fileName, "adimg") {
			continue
		}

		// 写回 alice
		adimgs = append(adimgs, curPath)
		if len(adimgs) >= 4 {
			break
		}
	}

	return adimgs, nil
}
