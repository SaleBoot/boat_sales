package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	log "log"

	"github.com/gin-gonic/gin"
)

type BoatModelFrontHandler struct {
	boatCategorySvc *services.BoatCategoryService
	cosPathSvc      *services.CosPathService
	boatSvc         *services.BoatService
	boatModelSvc    *services.BoatModelService
}

func NewBoatModelFrontHandler(
	aBoatCategorySvc *services.BoatCategoryService,
	aCosPathSvc *services.CosPathService,
	aBoatSvc *services.BoatService,
	aModelSvc *services.BoatModelService,
) (*BoatModelFrontHandler, error) {

	if aBoatCategorySvc == nil ||
		aCosPathSvc == nil ||
		aBoatSvc == nil ||
		aModelSvc == nil {

		log.Printf("NewBoatModelFrontHandler: one or more params cannot be nil: %v, %v, %v, %v",
			aBoatCategorySvc, aCosPathSvc, aBoatSvc, aModelSvc)
		return nil, fmt.Errorf("NewBoatModelFrontHandler: one or more params cannot be nil")
	}

	return &BoatModelFrontHandler{
		boatCategorySvc: aBoatCategorySvc,
		cosPathSvc:      aCosPathSvc,
		boatSvc:         aBoatSvc,
		boatModelSvc:    aModelSvc,
	}, nil
}

// -----------------------------------
// HandleGetModels 获取所有模型列表，包含每个模型的基本信息和对应的材质槽列表
// -----------------------------------
/*
{
  "menuData": [ // 直接用于菜单渲染
    { "id": "cat1", "label": "Category One", "models": [{ "id": "YachtA", "label": "Yacht A" }, ...] },
    { "id": "cat2", "label": "Category Two", "models": [...] }
  ],
  "boatsMap": { // 一个以 boatEnName 为键的对象/Map
    "YachtA": { "boatEnName": "YachtA", "price": 10000, "models": [...] },
    "YachtB": { "boatEnName": "YachtB", "price": 20000, "models": [...] },
    "FishBoatC": { "boatEnName": "FishBoatC", "price": 5000, "models": [...] }
  }
}
*/
type Models4Front struct {
	BoatMenu []BoatMenu `json:"menu"`
	BoatMap  BoatMap    `json:"boatMap"` // boatEnName -> list of BoatInfo
}

type BoatMenuMap = map[string]*BoatMenu
type BoatMenu struct {
	Id    string        `json:"id"`    // 船的类别ID category.CategoryStrID
	Label string        `json:"label"` // 船的类别中文名称 category.CnName
	Boats []BoatSubMenu `json:"boats"` // 船的模型列表
}

func BoatMenuMap2Array(aBoatMenuMap *BoatMenuMap) []BoatMenu {
	var out []BoatMenu
	for _, v := range *aBoatMenuMap {
		out = append(out, *v)
	}

	// ✅ 排序：按 Id 字母顺序（category.EnlishName）
	sort.Slice(out, func(i, j int) bool {
		return out[i].Id < out[j].Id
	})
	return out
}

type BoatSubMenu struct {
	Id    string `json:"id"`    // 船的模型英文名称 boat.boatEnName,
	Label string `json:"label"` // 船的模型中文名称 boat.boatName,
}

type BoatMap = map[string]BoatInfo
type BoatInfo struct {
	Id    string `json:"id"`    // 船的模型英文名称 boat.boatEnName,
	Label string `json:"label"` // 船的模型中文名称 boat.boatName,
	// BoatName   string `json:"boatName"`
	// BoatEnName string `json:"boatEnName"`
	Category        string  `json:"category"` // 船舶类别英文名
	Price           int     `json:"price"`
	Description     string  `json:"description" gorm:"type:text;comment:简介"`
	OverallLength   float64 `json:"overallLength" gorm:"comment:总长"`
	WaterlineLength float64 `json:"waterlineLength" gorm:"comment:水线长"`
	Beam            float64 `json:"beam" gorm:"comment:船宽"`
	MoldedDepth     float64 `json:"moldedDepth" gorm:"comment:型深"`
	Draft           float64 `json:"draft" gorm:"comment:吃水"`
	NavigationArea  string  `json:"navigationArea" gorm:"type:varchar(64);comment:航区"`
	MainEnginePower string  `json:"mainEnginePower" gorm:"type:varchar(128);comment:主机功率"`
	DesignSpeed     float64 `json:"designSpeed" gorm:"comment:设计航速"`
	RatedCrew       int     `json:"ratedCrew" gorm:"comment:额定乘员"`
	PropulsionType  string  `json:"propulsionType" gorm:"type:varchar(64);comment:动力形式"`
	Material        string  `json:"material" gorm:"type:varchar(64);comment:材质"`
	CertificateType string  `json:"certificateType" gorm:"type:varchar(64);comment:证书类型"`
	// 其他字段...
	Models []ModelInfo `json:"models"`
}

func (b *BoatInfo) fromModel(aSysBoat *models.SysBoat) {
	b.Id = aSysBoat.BoatEnName
	b.Label = aSysBoat.BoatName

	// b.BoatName = aSysBoat.BoatName
	// b.BoatEnName = aSysBoat.BoatEnName
	b.Category = aSysBoat.CategoryStrID
	b.Price = aSysBoat.Price
	b.Description = aSysBoat.Description
	b.OverallLength = aSysBoat.OverallLength
	b.WaterlineLength = aSysBoat.WaterlineLength
	b.Beam = aSysBoat.Beam
	b.MoldedDepth = aSysBoat.MoldedDepth
	b.Draft = aSysBoat.Draft
	b.NavigationArea = aSysBoat.NavigationArea
	b.MainEnginePower = aSysBoat.MainEnginePower
	b.DesignSpeed = aSysBoat.DesignSpeed
	b.RatedCrew = aSysBoat.RatedCrew
	b.PropulsionType = aSysBoat.PropulsionType
	b.Material = aSysBoat.Material
	b.CertificateType = aSysBoat.CertificateType
}

type ModelInfo struct {
	Id         string   `json:"id"`         // boatEnName+序号
	Label      string   `json:"label"`      // ModelName
	BoatEnName string   `json:"boatEnName"` // 无空格英文名，也是模型文件夹名
	ModelName  string   `json:"modelName"`  // 默认样式的名称
	AdImgs     []string `json:"adImgs"`
	PartPaths  []string `json:"partPaths"` // 模型部件运行时路径列表
	// 材质槽列表 not in table "sys_boat_model", from "cos_path_meta" table
	//
	//   "matSlots": [
	//     {
	//       "matSlotName": "mat_xx01",
	//       "textures": ["/gltf01/boatA/model01/mat_xx01_a.png"]
	//     },
	MatSlots []MatSlot `json:"matSlots"` // 材质槽列表
	// 外观相关
	ExteriorName       string `json:"exteriorName"`       // 外观名称
	ExteriorDescr      string `json:"exteriorDescr"`      // 外观描述
	ExteriorAddedPrice int    `json:"exteriorAddedPrice"` // 外观加价
	// 内饰相关
	InteriorName       string `json:"interiorName"`       // 内饰名称
	InteriorDescr      string `json:"interiorDescr"`      // 内饰描述
	InteriorAddedPrice int    `json:"interiorAddedPrice"` // 内饰加价
	// 甲板相关
	DeckName       string `json:"deckName"`       // 甲板名称
	DeckDescr      string `json:"deckDescr"`      // 甲板描述
	DeckAddedPrice int    `json:"deckAddedPrice"` // 甲板加价
	// 动力相关
	PowerName       string `json:"powerName"`       // 动力名称
	PowerDescr      string `json:"powerDescr"`      // 动力描述
	PowerAddedPrice int    `json:"powerAddedPrice"` // 动力加价
}

type MatSlot struct {
	MatName  string     `json:"matName"`
	Textures TextureSet `json:"textures"` // 用对象，不用数组
}

// 所有 PBR 通道都定义，但可以为空
type TextureSet struct {
	BaseColor string `json:"basecolor"`
	Normal    string `json:"normal"`
	Roughness string `json:"roughness"`
	Metalness string `json:"metalness"`
	AO        string `json:"ao"`
	Emissive  string `json:"emissive"`
}

func (b *ModelInfo) fromModel(aSysBoatModel *models.SysBoatModel) {
	b.Id = aSysBoatModel.BoatEnName + strconv.Itoa(int(aSysBoatModel.ID))
	b.Label = aSysBoatModel.ModelName
	//
	b.BoatEnName = aSysBoatModel.BoatEnName
	b.ModelName = aSysBoatModel.ModelName
	//
	// b.PartPaths = append(b.PartPaths, aSysBoatModel.ModelRuntimePath)
	// b.MatSlots = aSysBoatModel.MatSlots //  not in db
	b.ExteriorName = aSysBoatModel.ExteriorName
	b.ExteriorDescr = aSysBoatModel.ExteriorDescr
	b.ExteriorAddedPrice = int(aSysBoatModel.ExteriorAddedPrice)
	b.InteriorName = aSysBoatModel.InteriorName
	b.InteriorDescr = aSysBoatModel.InteriorDescr
	b.InteriorAddedPrice = int(aSysBoatModel.InteriorAddedPrice)
	b.DeckName = aSysBoatModel.DeckName
	b.DeckDescr = aSysBoatModel.DeckDescr
	b.DeckAddedPrice = int(aSysBoatModel.DeckAddedPrice)
	b.PowerName = aSysBoatModel.PowerName
	b.PowerDescr = aSysBoatModel.PowerDescr
	b.PowerAddedPrice = int(aSysBoatModel.PowerAddedPrice)
}

// 	// --- 示例 ---
// 	// 1. 带有变体后缀的文件名: "mat_xx01_xx.png" -> "mat_xx01"
// 	path1 := "/gltf01/boatA/model01/mat_xx01_xx.png"
// 	fmt.Println(getMatSlot(path1)) // 输出: mat_xx01

// // 2. 基础材质文件名: "mat_01.png" -> "mat_01"
// path2 := "/gltf01/mat_01.png"
// fmt.Println(getMatSlot(path2)) // 输出: mat_01
func getMatSlotNameAndTexType(p string) (string, string) {
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

func filterModelPartPaths(
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

func filterModelAdImgs(
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

func filterModelMatSlots(
	aModelRuntimePath string,
	aCosFilePaths []models.CosPathMeta,
) ([]MatSlot, error) {

	modelDirPath := filepath.Dir(aModelRuntimePath)
	modelDirPath = strings.TrimSpace(modelDirPath)
	if modelDirPath == "." || modelDirPath == "" {
		return []MatSlot{}, nil
	}
	// 强制目录边界
	modelDirPath = strings.TrimSuffix(modelDirPath, "/") + "/"

	mapMatName2Textures := make(map[string]MatSlot)
	for _, path := range aCosFilePaths {
		curPath := strings.TrimSpace(path.Path)
		if curPath == "" {
			continue
		}

		// 只处理当前模型目录下的 文件
		if !strings.HasPrefix(curPath, modelDirPath) {
			continue
		}

		// 解析材质槽名 + 纹理类型
		matSlotName, texType := getMatSlotNameAndTexType(curPath)
		if matSlotName == "" || texType == "" {
			continue
		}

		// 从 map 中获取或新建 MatSlot
		matSlot, ok := mapMatName2Textures[matSlotName]
		if !ok {
			matSlot = MatSlot{
				MatName:  matSlotName,
				Textures: TextureSet{}, // 明确初始化，更干净
			}
		}

		// 填充对应纹理路径
		switch texType {
		case "basecolor":
			matSlot.Textures.BaseColor = curPath
		case "normal":
			matSlot.Textures.Normal = curPath
		case "roughness":
			matSlot.Textures.Roughness = curPath
		case "metallic", "metalness":
			matSlot.Textures.Metalness = curPath
		case "ao":
			matSlot.Textures.AO = curPath
		case "emissive":
			matSlot.Textures.Emissive = curPath
		}

		// 写回 map
		mapMatName2Textures[matSlotName] = matSlot
	}

	// map 转数组，容量直接用 map 长度，性能最优
	matSlots := make([]MatSlot, 0, len(mapMatName2Textures))
	for _, slot := range mapMatName2Textures {
		matSlots = append(matSlots, slot)
	}

	return matSlots, nil
}

/*
查询 + 内存拼接

查询 A 表： 拿到结果集 items。
提取 ID： 提取 items 中关联 B 表的 IDs（去重）。
批量查询 B 表： 使用 SELECT * FROM B WHERE id IN (...) 一次性查出所有关联数据。
内存拼接：(1) 在 Go 中将 B 表结果存入一个 map[int]*B。(2)遍历 A 表，从 Map 中直接取出 B 数据塞进 A 的结构体。
*/
func (aH *BoatModelFrontHandler) HandleGetModels(c *gin.Context) {
	// -----------查询 -----------
	// Get all categories
	svcCategories, err := aH.boatCategorySvc.GetBoatCategories()
	if err != nil || len(svcCategories) == 0 {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get categories: %s from db", err.Error())})
		return
	}
	categoryMapEn2Cn := models.BoatCategory_arrayToMap(svcCategories)

	// Get all boats
	svcBoats, err := aH.boatSvc.GetBoatsByCategoryStrID("")
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get boats: %s from db", err.Error())})
		return
	}

	// get all models
	svcModels, err := aH.boatModelSvc.GetAllModels()
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get models: %s", err.Error())})
		return
	}

	svcCosFilePaths, err := aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
	if err != nil {
		log.Printf("Error getting all model file paths: %v from db", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("获取模型Cos Path列表失败: %v", err),
				Data:    nil,
			})
		return
	}

	//------+ 内存拼接,构造响应数据 +-----------
	outputData := &Models4Front{} // 响应的数据结构

	boatMenuMap := make(BoatMenuMap) // category.EnlishName -> list of BoatMenu
	boatMap := make(BoatMap)         // boatEnName -> list of BoatInfo

	for _, boat := range svcBoats {
		// construct boatMenuMap
		boatMenu, ok := boatMenuMap[boat.CategoryStrID]
		if !ok {
			boatMenu = &BoatMenu{
				Id:    boat.CategoryStrID,
				Label: categoryMapEn2Cn[boat.CategoryStrID].CnName,
				Boats: make([]BoatSubMenu, 0, len(svcBoats)),
			}
			boatMenuMap[boat.CategoryStrID] = boatMenu
		}
		boatMenu.Boats = append(boatMenu.Boats, BoatSubMenu{
			Id:    boat.BoatEnName,
			Label: boat.BoatName,
		})

		// construct boatMap
		boatinfo, ok := boatMap[boat.BoatEnName]
		if !ok {
			boatinfo = BoatInfo{}
			boatinfo.fromModel(&boat)
			boatinfo.Models = make([]ModelInfo, 0, len(svcModels))
		}

		for _, svcModel := range svcModels {
			if svcModel.BoatEnName != boat.BoatEnName {
				continue
			}

			modelinfo := ModelInfo{}
			modelinfo.fromModel(svcModel)

			// 生成模型ID
			idx := len(boatinfo.Models)
			modelinfo.Id = boat.BoatEnName + "_" + strconv.Itoa(idx)
			modelinfo.Label = boat.BoatName + "_模型" + strconv.Itoa(idx)

			// 加载模型的文件路径
			partPaths, err := filterModelPartPaths(svcModel.ModelRuntimePath, svcCosFilePaths)
			if err != nil {
				log.Printf("模型 %s 加载模型文件失败: %v", svcModel.ModelRuntimePath, err)
				modelinfo.PartPaths = []string{} // 空切片，保证前端安全
			} else {
				modelinfo.PartPaths = partPaths
			}

			// 加载模型的宣传图
			adImgs, err := filterModelAdImgs(svcModel.ModelRuntimePath, svcCosFilePaths)
			if err != nil {
				log.Printf("模型 %s 加载宣传图失败: %v", svcModel.ModelRuntimePath, err)
				modelinfo.AdImgs = []string{} // 空切片，保证前端安全
			} else {
				modelinfo.AdImgs = adImgs
			}

			// 加载模型的材质
			slots, err := filterModelMatSlots(svcModel.ModelRuntimePath, svcCosFilePaths)
			if err != nil {
				log.Printf("模型 %s 加载材质失败: %v", svcModel.ModelRuntimePath, err)
				modelinfo.MatSlots = []MatSlot{} // 空切片，保证前端安全
			} else {
				modelinfo.MatSlots = slots
			}

			boatinfo.Models = append(boatinfo.Models, modelinfo)
		}
		boatMap[boat.BoatEnName] = boatinfo
	}

	outputData.BoatMenu = BoatMenuMap2Array(&boatMenuMap)
	outputData.BoatMap = boatMap

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got all models",
		Data:    outputData,
	})
}
