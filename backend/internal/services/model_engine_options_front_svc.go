package services

import (
	"boatsales-backend/internal/db/models"
	"fmt"
)

func (aH *ModelEngineOptionsService) GetAllOptions() ([]*models.SysModelEngineOption, error) {

	options, err := aH.optionsDao.GetAllOptions()
	if err != nil {
		return nil, fmt.Errorf("failed to get options: %w", err)
	}

	return options, nil
}

func (aH *ModelEngineOptionsService) GetEngineOptionsByModelIDs(
	modelIDs []uint,
) ([]models.SysModelEngineOption, error) {

	options, err := aH.optionsDao.GetEngineOptionsByModelIDs(modelIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get options: %w", err)
	}

	return options, nil
}
