package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"fmt"
	"strings"
)

type BoatModelService struct {
	BoatModelDao          *dao.SysBoatModelDao
	ModelEngineOptionsDao *dao.SysModelEngineOptionsDao
	EngineDao             *dao.SysBoatEngineDao
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

	return &BoatModelService{BoatModelDao: aModelDao,
		ModelEngineOptionsDao: aModelEngineOptionsDao,
		EngineDao:             aEngineDao,
	}, nil

}

func (aH *BoatModelService) GetModelsByBoatEnName(aBoatEnName string,
) ([]*models.SysBoatModel, error) {

	boatEnName := strings.TrimSpace(aBoatEnName)
	if boatEnName == "" {
		return nil, fmt.Errorf("boatEnName is empty")
	}

	models, err := aH.BoatModelDao.GetModelsByBoatEnName(boatEnName)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	return models, nil
}

func (aH *BoatModelService) ReplaceModelsByBoatEnName(aBoatEnName string,
	aModelsToUpdate []*models.SysBoatModel,
) error {
	boatEnName := strings.TrimSpace(aBoatEnName)
	if boatEnName == "" {
		return fmt.Errorf("boatEnName is empty")
	}

	// Validate that the boatEnName in the path matches the one in the payload
	for _, model := range aModelsToUpdate {
		if model.BoatEnName != boatEnName {
			return fmt.Errorf("boatEnName in path (%s) does not match boatEnName in payload (%s)", boatEnName, model.BoatEnName)
		}
	}

	if err := aH.BoatModelDao.ReplaceModelsByBoatEnName(boatEnName, aModelsToUpdate); err != nil {
		return fmt.Errorf("Failed to update boat (%s) models: %s ", boatEnName, err.Error())
	}

	return nil
}
