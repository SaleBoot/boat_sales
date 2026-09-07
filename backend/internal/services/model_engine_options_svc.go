package services

import (
	"boatsales-backend/internal/db/dao"
	"fmt"
)

type ModelEngineOptionsService struct {
	optionsDao *dao.SysModelEngineOptionsDao
}

func NewModelEngineOptionsService(
	aOptionsDao *dao.SysModelEngineOptionsDao,
) (*ModelEngineOptionsService, error) {

	if aOptionsDao == nil {
		return nil, fmt.Errorf("aOptionsDao is nil")
	}

	return &ModelEngineOptionsService{
		optionsDao: aOptionsDao,
	}, nil

}
