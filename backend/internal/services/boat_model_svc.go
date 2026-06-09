package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"fmt"
	"strings"
)

type BoatModelService struct {
	BoatModelDao *dao.SysBoatModelDao
}

func NewBoatModelService(aDao *dao.SysBoatModelDao) (*BoatModelService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("aDao is nil")
	}

	return &BoatModelService{BoatModelDao: aDao}, nil // 依赖注入
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
