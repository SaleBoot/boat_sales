package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"errors"
	"fmt"
	"log"

	"gorm.io/gorm"
)

// --- Boat Category Handlers ---
type BoatEngineService struct {
	boatEngineDao *dao.SysBoatEngineDao
}

func NewBoatEngineService(aDao *dao.SysBoatEngineDao,
) (*BoatEngineService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("NewBoatEngineService: aDao cannot be nil")
	}

	return &BoatEngineService{boatEngineDao: aDao}, nil
}

func (aS *BoatEngineService) GetBoatEngines() ([]models.SysBoatEngine, error) {

	engines, err := aS.boatEngineDao.GetAllBoatEngines()
	if err != nil {
		log.Printf("failed to get boat engines: %v", err)
		return nil, err
	}

	return engines, nil
}

func (aS *BoatEngineService) AddBoatEngine(
	aEngine *models.SysBoatEngine,
) error {
	log.Println("AddBoatEngine,start")
	defer log.Println("AddBoatEngine,end")

	if err := aS.boatEngineDao.AddBoatEngine(aEngine); err != nil {
		log.Printf("failed to create boat engine: %v", err)
		return fmt.Errorf("failed to create boat engine: %w", err)
	}

	return nil
}

func (aH *BoatEngineService) UpdateBoatEngine(
	aEngineIntId int,
	aUpdateData *models.SysBoatEngine,
) error {
	log.Printf("UpdateBoatEngine: try to update boat engine with ID: %d, EngineName: %s",
		aEngineIntId, aUpdateData.EngineName)

	// 执行更新
	err := aH.boatEngineDao.UpdateBoatEngineByID(
		uint(aEngineIntId),
		aUpdateData,
	)

	if err != nil {
		// GORM 会自动返回 ErrRecordNotFound，你可以直接判断
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("UpdateBoatEngine: BoatEngine with ID %d not found.", aEngineIntId)
			return fmt.Errorf("engine not found")
		}

		log.Printf("UpdateBoatEngine: failed to update boat engine (ID: %d): %v", aEngineIntId, err)
		return fmt.Errorf("failed to update engine: %w", err)
	}

	log.Printf("UpdateBoatEngine: Successfully updated engine with ID: %d", aEngineIntId)
	return nil
}

func (aH *BoatEngineService) DeleteBoatEngines(aIDs []uint) error {
	if len(aIDs) == 0 {
		return fmt.Errorf("boat engine IDs are required")
	}
	if err := aH.boatEngineDao.DeleteBoatEngines(aIDs); err != nil {
		log.Printf("BoatEngineService::failed to delete boat engines: %v", err)
		return fmt.Errorf("failed to delete boat engines: %w", err)
	}

	return nil
}
