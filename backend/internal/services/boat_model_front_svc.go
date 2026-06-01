package services

import (
	"boatsales-backend/internal/db/models"
	"fmt"
)

func (aH *BoatModelService) GetAllModels() ([]*models.SysBoatModel, error) {

	models, err := aH.BoatModelDao.GetAllModels()
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	return models, nil
}
