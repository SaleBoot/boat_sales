package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"context"
	"fmt"
	"log"
	"strings"

	"gorm.io/gorm"
)

type BoatModelService struct {
	boatModelDao *dao.SysBoatModelDao
	optionsDao   *dao.SysModelEngineOptionsDao
	engineDao    *dao.SysBoatEngineDao
}

func NewBoatModelService(
	aModelDao *dao.SysBoatModelDao,
	aModelEngineOptionsDao *dao.SysModelEngineOptionsDao,
	aEngineDao *dao.SysBoatEngineDao,
) (*BoatModelService, error) {
	if aModelDao == nil {
		return nil, fmt.Errorf("aModelDao is nil")
	}
	if aModelEngineOptionsDao == nil {
		return nil, fmt.Errorf("aModelEngineOptionsDao is nil")
	}
	if aEngineDao == nil {
		return nil, fmt.Errorf("aEngineDao is nil")
	}

	return &BoatModelService{boatModelDao: aModelDao,
		optionsDao: aModelEngineOptionsDao,
		engineDao:  aEngineDao,
	}, nil

}

// --------------------------------------
// 返回给 后台管理系统的前端页面的数据结构
type AdminBoatModel struct {
	ID uint `json:"ID"`
	// BoatEnName + ModelName 共同唯一确定一个具体的模型文件夹（即默认样式文件夹）
	// todo: BoatEnName 改成 BoatID,
	BoatEnName string `json:"boatEnName"`

	ModelName        string `json:"modelName"`
	ModelRuntimePath string `json:"modelRuntimePath"`
	// ==============================
	// 外观相关
	ExteriorName       string `json:"exteriorName"`
	ExteriorDescr      string `json:"exteriorDescr"`
	ExteriorAddedPrice int    `json:"exteriorAddedPrice"`
	// 内饰相关
	InteriorName       string `json:"interiorName"`
	InteriorDescr      string `json:"interiorDescr"`
	InteriorAddedPrice int    `json:"interiorAddedPrice"`
	// 甲板相关
	DeckName       string `json:"deckName"`
	DeckDescr      string `json:"deckDescr"`
	DeckAddedPrice int    `json:"deckAddedPrice"`

	// 关联 SysModelEngineOption， 用来限定「某个3D模型/样式，能选哪些动力」

	// ===== Panel 2：动力与性能（针对该3D模型的默认参数）=====
	DesignSpeed  float64 `json:"designSpeed"`
	CruiseSpeed  float64 `json:"cruiseSpeed"`
	CruiseRange  float64 `json:"cruiseRange"`
	CabinType    string  `json:"cabinType"`
	ControlMode  string  `json:"controlMode"`
	PassengerNum int     `json:"passengerNum"`

	// ===== Panel 3：智能系统（针对该3D模型的默认配置）=====
	SmartSystemName  string `json:"smartSystemName"`
	SmartSystemDescr string `json:"smartSystemDescr"`
	// ==============================
	BoundEngines []models.SysBoatEngine `json:"boundEngines"`
}

func (aF *AdminBoatModel) fromDb(aDbModel *models.SysBoatModel) {
	aF.ID = aDbModel.ID
	aF.BoatEnName = aDbModel.BoatEnName
	aF.ModelName = aDbModel.ModelName
	aF.ModelRuntimePath = aDbModel.ModelRuntimePath

	aF.ExteriorName = aDbModel.ExteriorName
	aF.ExteriorDescr = aDbModel.ExteriorDescr
	aF.ExteriorAddedPrice = aDbModel.ExteriorAddedPrice
	aF.InteriorName = aDbModel.InteriorName
	aF.InteriorDescr = aDbModel.InteriorDescr
	aF.InteriorAddedPrice = aDbModel.InteriorAddedPrice
	aF.DeckName = aDbModel.DeckName
	aF.DeckDescr = aDbModel.DeckDescr
	aF.DeckAddedPrice = aDbModel.DeckAddedPrice

	aF.DesignSpeed = aDbModel.DesignSpeed
	aF.CruiseSpeed = aDbModel.CruiseSpeed
	aF.CruiseRange = aDbModel.CruiseRange
	aF.CabinType = aDbModel.CabinType
	aF.ControlMode = aDbModel.ControlMode
	aF.PassengerNum = aDbModel.PassengerNum

	aF.SmartSystemName = aDbModel.SmartSystemName
	aF.SmartSystemDescr = aDbModel.SmartSystemDescr
	// aF.BoundEngines =?
}

func (aF *AdminBoatModel) toDb() *models.SysBoatModel {
	dbModel := &models.SysBoatModel{
		Model: gorm.Model{
			ID: aF.ID, // ID 写在内嵌 gorm.Model 里
		},
		BoatEnName:         aF.BoatEnName,
		ModelName:          aF.ModelName,
		ModelRuntimePath:   aF.ModelRuntimePath,
		ExteriorName:       aF.ExteriorName,
		ExteriorDescr:      aF.ExteriorDescr,
		ExteriorAddedPrice: aF.ExteriorAddedPrice,
		InteriorName:       aF.InteriorName,
		InteriorDescr:      aF.InteriorDescr,
		InteriorAddedPrice: aF.InteriorAddedPrice,
		DeckName:           aF.DeckName,
		DeckDescr:          aF.DeckDescr,
		DeckAddedPrice:     aF.DeckAddedPrice,

		DesignSpeed:  aF.DesignSpeed,
		CruiseSpeed:  aF.CruiseSpeed,
		CruiseRange:  aF.CruiseRange,
		CabinType:    aF.CabinType,
		ControlMode:  aF.ControlMode,
		PassengerNum: aF.PassengerNum,

		SmartSystemName:  aF.SmartSystemName,
		SmartSystemDescr: aF.SmartSystemDescr,
	}

	return dbModel
}

func buildFrontModels(
	aDbModels []models.SysBoatModel,
	aDbOptions []models.SysModelEngineOption,
	aDbEngines []models.SysBoatEngine,
) []AdminBoatModel {
	// build mapModelID2EngineIDss
	mapModelID2EngineIDs := make(map[uint][]uint)
	for _, option := range aDbOptions {
		mapModelID2EngineIDs[option.ModelID] = append(
			mapModelID2EngineIDs[option.ModelID], option.EngineID)
	}

	// build mapEngineID2Engine
	mapEngineID2Engine := make(map[uint]models.SysBoatEngine)
	for _, engine := range aDbEngines {
		mapEngineID2Engine[engine.ID] = engine
	}

	//
	frontModels := make([]AdminBoatModel, 0, len(aDbModels))

	for _, model := range aDbModels {
		frontModel := AdminBoatModel{}
		frontModel.fromDb(&model)

		frontModel.BoundEngines = make([]models.SysBoatEngine, 0, 10)
		engineIDs, ok := mapModelID2EngineIDs[model.ID]
		if ok {
			for _, engineID := range engineIDs {
				frontModel.BoundEngines = append(
					frontModel.BoundEngines, mapEngineID2Engine[engineID])
			}
		}

		//
		frontModels = append(frontModels, frontModel)
	}

	log.Printf("ReplaceModelsByBoatEnName %+v", frontModels)
	return frontModels
}

func (aH *BoatModelService) GetModelsByBoatEnName(aBoatEnName string,
) ([]AdminBoatModel, error) {

	boatEnName := strings.TrimSpace(aBoatEnName)
	if boatEnName == "" {
		return nil, fmt.Errorf("boatEnName is empty")
	}

	dbModels, err := aH.boatModelDao.GetModelsByBoatEnName(boatEnName)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	modelIds := make([]uint, 0, 10)
	for _, model := range dbModels {
		modelIds = append(modelIds, model.ID)
	}

	dbOptions, err := aH.optionsDao.GetEngineOptionsByModelIDs(modelIds)
	if err != nil {
		return nil, fmt.Errorf("failed to get model-engine options: %w", err)
	}
	log.Printf("optionsDao.GetEngineOptionsByModelIDs modelIds=%+v ;;; dbOptions=%+v", modelIds, dbOptions)

	engineIDs := make([]uint, 0, 10)
	for _, engineOption := range dbOptions {
		engineIDs = append(engineIDs, engineOption.EngineID)
	}
	dbEngines, err := aH.engineDao.GetEnginesByIDs(engineIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get boat engines: %w", err)
	}
	log.Printf("engineDao.GetEnginesByIDs dbEngines=%+v", dbEngines)

	//
	frontModels := buildFrontModels(dbModels, dbOptions, dbEngines)

	return frontModels, nil
}

func (aH *BoatModelService) ReplaceModelsByBoatEnName(
	aCtx context.Context,
	aBoatEnName string,
	aModelsToUpdate []*AdminBoatModel,
) error {
	log.Println("api/admin/boat-model/:boatEnName  ReplaceModelsByBoatEnName(),start")
	defer log.Println("api/admin/boat-model/:boatEnName  ReplaceModelsByBoatEnName(),end")

	boatEnName := strings.TrimSpace(aBoatEnName)
	if boatEnName == "" {
		return fmt.Errorf("boatEnName is empty")
	}

	// 1. 校验每条数据 boatEnName 一致性
	for _, model := range aModelsToUpdate {
		if model.BoatEnName != boatEnName {
			return fmt.Errorf("boatEnName(%s) not match payload boatEnName(%s)",
				boatEnName, model.BoatEnName)
		}
	}

	// 2. DTO 转数据库模型
	dbModels := make([]*models.SysBoatModel, 0, len(aModelsToUpdate))
	for _, m := range aModelsToUpdate {
		dbModels = append(dbModels, m.toDb())
	}

	// 3. 统一事务：主表 + 关联表 原子操作
	return aH.boatModelDao.ExecInTransaction(aCtx, func(tx *gorm.DB) error {
		// -------- 步骤1：删除该船 旧主表数据 --------
		if err := tx.
			Where("boat_en_name = ?", boatEnName).
			Delete(&models.SysBoatModel{}).Error; err != nil {
			return fmt.Errorf("delete old boat model failed: %w", err)
		}

		// -------- 步骤2：删除该船 旧动力关联数据 --------
		if err := aH.optionsDao.DeleteByBoatEnName(tx, boatEnName); err != nil {
			return fmt.Errorf("delete old engine option failed: %w", err)
		}

		// -------- 步骤3：插入新主表数据（强制清空ID，走自增） --------
		if len(dbModels) > 0 {
			for _, item := range dbModels {
				item.ID = 0 // 置零，防止旧ID冲突
			}
			if err := tx.Create(&dbModels).Error; err != nil {
				return fmt.Errorf("create new boat model failed: %w", err)
			}
		}

		// -------- 步骤4：用【新生成的Model.ID】组装动力关联数据 --------
		var dbOptions []models.SysModelEngineOption
		for idx, frontModel := range aModelsToUpdate {
			// dbModels 是刚插入的新数据，ID 已被 GORM 回填为自增ID
			newModelID := dbModels[idx].ID

			// 遍历当前样式绑定的动力
			for _, engine := range frontModel.BoundEngines {
				dbOptions = append(dbOptions, models.SysModelEngineOption{
					ModelID:  newModelID, // ✅ 使用新自增ID
					EngineID: engine.ID,
				})
			}
		}

		// -------- 步骤5：插入新动力关联数据（清空ID） --------
		if len(dbOptions) > 0 {
			for _, opt := range dbOptions {
				opt.ID = 0
			}
			if err := tx.Create(&dbOptions).Error; err != nil {
				return fmt.Errorf("create new engine option failed: %w", err)
			}
		}

		// 全部成功，事务提交
		return nil
	})
}
