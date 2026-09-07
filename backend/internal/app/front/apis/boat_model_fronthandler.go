package apis

import (
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"net/http"

	log "log"

	"github.com/gin-gonic/gin"
)

type BoatModelFrontHandler struct {
	boatCategorySvc *services.BoatCategoryService
	cosPathSvc      *services.CosPathService
	boatSvc         *services.BoatService
	boatModelSvc    *services.BoatModelService
	engineSvc       *services.BoatEngineService
	engineOptionSvc *services.ModelEngineOptionsService
}

func NewBoatModelFrontHandler(
	aBoatCategorySvc *services.BoatCategoryService,
	aCosPathSvc *services.CosPathService,
	aBoatSvc *services.BoatService,
	aModelSvc *services.BoatModelService,
	aEngineSvc *services.BoatEngineService,
	aEngineOptionSvc *services.ModelEngineOptionsService,
) (*BoatModelFrontHandler, error) {

	if aBoatCategorySvc == nil ||
		aCosPathSvc == nil ||
		aBoatSvc == nil ||
		aModelSvc == nil ||
		aEngineSvc == nil ||
		aEngineOptionSvc == nil {

		log.Printf("NewBoatModelFrontHandler: one or more params cannot be nil: %v, %v, %v, %v, %v, %v",
			aBoatCategorySvc, aCosPathSvc, aBoatSvc, aModelSvc, aEngineOptionSvc, aEngineSvc)
		return nil, fmt.Errorf("NewBoatModelFrontHandler: one or more params cannot be nil")
	}

	return &BoatModelFrontHandler{
		boatCategorySvc: aBoatCategorySvc,
		cosPathSvc:      aCosPathSvc,
		boatSvc:         aBoatSvc,
		boatModelSvc:    aModelSvc,
		engineSvc:       aEngineSvc,
		engineOptionSvc: aEngineOptionSvc,
	}, nil
}

// -----------------------------------
// HandleGetModels 获取所有模型列表，包含每个模型的基本信息和对应的材质槽列表
// -----------------------------------

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
	dbCategories, err := aH.boatCategorySvc.GetBoatCategories("")
	if err != nil || len(dbCategories) == 0 {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get categories: %s from db", err.Error())})
		return
	}
	categoryMapStrID2Cn := models.BoatCategory_arrayToMap(dbCategories)

	// Get all boats
	dbBoats, err := aH.boatSvc.GetBoatsByCategoryStrID("")
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get boats: %s from db", err.Error())})
		return
	}

	// get all models
	dbModels, err := aH.boatModelSvc.GetAllModels()
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get models: %s", err.Error())})
		return
	}

	// get dbOptions
	modelIDs := make([]uint, 0, 100)
	for _, dbModel := range dbModels {
		modelIDs = append(modelIDs, dbModel.ID)
	}
	dbOptions, err := aH.engineOptionSvc.GetEngineOptionsByModelIDs(modelIDs)
	if err != nil {
		log.Printf("engineOptionSvc.GetEngineOptionsByModelIDs() err=%w", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to get model-engine-options: %s", err.Error())})
		return
	}

	// get dbEngines
	engineIDs := make([]uint, 0, 100)
	for _, dbOpt := range dbOptions {
		engineIDs = append(engineIDs, dbOpt.EngineID)
	}
	dbEngines, err := aH.engineSvc.GetEnginesByIDs(engineIDs)
	if err != nil {
		log.Printf("Error getting engines %v from db", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("Error getting engines from db: %v", err),
				Data:    nil,
			})
		return
	}

	//
	dbCosFilePaths, err := aH.cosPathSvc.GetAllFilePaths(c.Request.Context())
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
	outputData := services.ModelsDbData2FrontData(
		categoryMapStrID2Cn, dbBoats, dbModels, dbCosFilePaths,
		dbOptions, dbEngines,
	)

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully got all models",
		Data:    outputData,
	})
}
