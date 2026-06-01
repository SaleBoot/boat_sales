package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"net/http"
	"path/filepath"
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
type ModelsFrontOutput struct {
	Categories map[string]string         `json:"categories"`
	Boats      map[string][]BoatFrontOut `json:"boats"`
}

type BoatFrontOut struct {
	BoatName   string `json:"boatName"`
	BoatEnName string `json:"boatEnName"`
	// Category        string  `json:"category" gorm:"type:varchar(64);comment:船舶类型英文名"`
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
	Models []ModelFrontOut `json:"models"`
}

func (b *BoatFrontOut) fromModel(aSysBoat *models.SysBoat) {
	b.BoatName = aSysBoat.BoatName
	b.BoatEnName = aSysBoat.BoatEnName
	// b.Category = aSysBoat.Category
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

type ModelFrontOut struct {
	BoatEnName       string              `json:"boatEnName" gorm:"type:varchar(128);comment:无空格英文名，也是模型文件夹名"`
	ModelName        string              `json:"modelName" gorm:"type:varchar(255);comment:默认样式的名称"`
	ModelRuntimePath string              `json:"modelRuntimePath" gorm:"type:varchar(255);comment:运行时路径"`
	ModelMatSlots    map[string][]string `json:"modelMatSlots" gorm:"type:text;comment:材质槽列表"` // not in db
	// 外观相关
	ExteriorName       string  `json:"exteriorName" gorm:"type:varchar(255);comment:外观名称"`
	ExteriorDescr      string  `json:"exteriorDescr" gorm:"type:varchar(255);comment:外观描述"`
	ExteriorAddedPrice float64 `json:"exteriorAddedPrice" gorm:"type:decimal(10,2);comment:外观加价"`
	// 内饰相关
	InteriorName       string  `json:"interiorName" gorm:"type:varchar(255);comment:内饰名称"`
	InteriorDescr      string  `json:"interiorDescr" gorm:"type:varchar(255);comment:内饰描述"`
	InteriorAddedPrice float64 `json:"interiorAddedPrice" gorm:"type:decimal(10,2);comment:内饰加价"`
	// 甲板相关
	DeckName       string  `json:"deckName" gorm:"type:varchar(255);comment:甲板名称"`
	DeckDescr      string  `json:"deckDescr" gorm:"type:varchar(255);comment:甲板描述"`
	DeckAddedPrice float64 `json:"deckAddedPrice" gorm:"type:decimal(10,2);comment:甲板加价"`
	// 动力相关
	PowerName       string  `json:"powerName" gorm:"type:varchar(255);comment:动力名称"`
	PowerDescr      string  `json:"powerDescr" gorm:"type:varchar(255);comment:动力描述"`
	PowerAddedPrice float64 `json:"powerAddedPrice" gorm:"type:decimal(10,2);comment:动力加价"`
}

func (b *ModelFrontOut) fromModel(aSysBoatModel *models.SysBoatModel) {
	b.BoatEnName = aSysBoatModel.BoatEnName
	b.ModelName = aSysBoatModel.ModelName
	b.ModelRuntimePath = aSysBoatModel.ModelRuntimePath
	// b.ModelMatSlots = aSysBoatModel.ModelMatSlots //  not in db
	b.ExteriorName = aSysBoatModel.ExteriorName
	b.ExteriorDescr = aSysBoatModel.ExteriorDescr
	b.ExteriorAddedPrice = aSysBoatModel.ExteriorAddedPrice
	b.InteriorName = aSysBoatModel.InteriorName
	b.InteriorDescr = aSysBoatModel.InteriorDescr
	b.InteriorAddedPrice = aSysBoatModel.InteriorAddedPrice
	b.DeckName = aSysBoatModel.DeckName
	b.DeckDescr = aSysBoatModel.DeckDescr
	b.DeckAddedPrice = aSysBoatModel.DeckAddedPrice
	b.PowerName = aSysBoatModel.PowerName
	b.PowerDescr = aSysBoatModel.PowerDescr
	b.PowerAddedPrice = aSysBoatModel.PowerAddedPrice
}

// 	// 测试用例 1：2个下划线
// 	path1 := "/gltf01/boatA/model01/mat_xx01_xx.png"
// 	fmt.Println(getMatSlot(path1)) // 输出: mat_xx01

// 	// 测试用例 2：4个下划线（数量不确定）
// 	path2 := "/gltf01/mat_heavy_iron_tank_02_damaged.png"
// 	fmt.Println(getMatSlot(path2)) // 输出: mat_heavy_iron_tank_02

// // 测试用例 3：只有1个下划线
// path3 := "/gltf01/mat_01.png"
// fmt.Println(getMatSlot(path3)) // 输出: mat
func getMatSlot(p string) string {
	// 1. 无论路径多深，先拿到文件名（例如: "mat_xx01_xx.png" 或 "mat_special_cover_02_v2.png"）
	fileName := filepath.Base(p)

	// 2. 从后往前，找出【最后一个】下划线 "_" 的位置
	lastUnderscore := strings.LastIndex(fileName, "_")

	// 安全检查：如果文件名里根本没有下划线，直接返回原文件名（或空）
	if lastUnderscore == -1 {
		return fileName
	}

	// 3. 截取最后一个下划线之前的所有内容
	return fileName[:lastUnderscore]
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
				Message: fmt.Sprintf("failed to get categories: %s", err.Error())})
		return
	}
	mapCategoryEn2Cn := models.BoatCategory_arrayToMap(svcCategories)

	// Get all boats
	svcBoats, err := aH.boatSvc.GetBoatsByCategory("")
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get boats: %s", err.Error())})
		return
	}

	// get all models
	allModels, err := aH.boatModelSvc.GetAllModels()
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get users: %s", err.Error())})
		return
	}

	cosFilePaths, err := aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
	if err != nil {
		log.Printf("HandleGetAllModelPaths(): Error getting all model folders with files: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("获取模型列表失败: %v", err),
				Data:    nil,
			})
		return
	}

	//------+ 内存拼接,构造响应数据 +-----------
	outputData := &ModelsFrontOutput{ // 响应的数据结构
		Categories: mapCategoryEn2Cn,
	}

	// construct mapCategory2Boats
	outBoats := make(map[string][]BoatFrontOut, len(svcCategories))
	for _, boat := range svcBoats {
		boatFrontOut := BoatFrontOut{}
		boatFrontOut.fromModel(&boat)

		boatFrontOut.Models = make([]ModelFrontOut, 6)
		for _, model := range allModels {

			if model.BoatEnName == boat.BoatEnName {
				modelFrontOut := ModelFrontOut{}
				modelFrontOut.fromModel(model)

				modelFrontOut.ModelMatSlots = make(map[string][]string)

				modelDirPath := filepath.Dir(model.ModelRuntimePath)
				for _, path := range cosFilePaths {
					if strings.HasPrefix(path.Path, modelDirPath) {
						// path.Path is like "/gltf01/boatA/model01/mat_xx01_xx.png"
						// matSlot is like "mat_xx01"
						log.Printf("HandleGetModels(): modelDirPath: %s,path.Path: %s",
							modelDirPath, path.Path)
						matSlot := getMatSlot(path.Path)
						modelFrontOut.ModelMatSlots[matSlot] = append(modelFrontOut.ModelMatSlots[matSlot], path.Path)
					}
				}
				boatFrontOut.Models = append(boatFrontOut.Models, modelFrontOut)
			}
		}

		outBoats[boat.Category] = append(outBoats[boat.Category], boatFrontOut)
	}

	outputData.Boats = outBoats

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got allModels",
		Data:    outputData,
	})
}
