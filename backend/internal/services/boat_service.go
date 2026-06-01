package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"fmt"
	"log"
	"strings"
)

type BoatService struct {
	boatDao *dao.SysBoatDao
}

func NewBoatService(aBoatDao *dao.SysBoatDao) (*BoatService, error) {
	if aBoatDao == nil {
		return nil, fmt.Errorf("NewBoatService: aBoatDao is required")
	}

	return &BoatService{boatDao: aBoatDao}, nil // 依赖注入
}

func (aS *BoatService) GetBoatsByCategory(
	aCategory string,
) ([]models.SysBoat, error) {
	category := strings.TrimSpace(aCategory)

	var boats []models.SysBoat
	var err error
	if category != "" {
		boats, err = aS.boatDao.GetBoatsByCategory(category)
	} else {
		boats, err = aS.boatDao.GetAllBoats()
	}

	if err != nil {
		log.Printf("failed to get boats: %v", err)
		return nil, err
	}

	log.Printf("GetBoatsByCategory():Successfully retrieved %d boats by category %s", len(boats), category)
	return boats, nil
}

func (aS *BoatService) AddBoat(aBoat *models.SysBoat) error {

	// ----todo:should use transaction to ensure data consistency
	// Check for uniqueness of BoatName
	existingBoat, err := aS.boatDao.FindByName(aBoat.BoatName)
	if err != nil {
		log.Printf("failed to check for existing boat by name: %v", err)
		return fmt.Errorf("failed to check for existing boat: %w", err)
	}
	if existingBoat != nil {
		log.Printf("a boat with this BoatName already exists")
		return fmt.Errorf("a boat with this BoatName already exists")
	}

	// Check for uniqueness of BoatEnName
	existingBoat, err = aS.boatDao.FindByBoatEnName(aBoat.BoatEnName)
	if err != nil {
		log.Printf("failed to check for existing boat by boatEnName: %v", err)
		return fmt.Errorf("failed to check for existing boat: %w", err)
	}
	if existingBoat != nil {
		return fmt.Errorf("a boat with this BoatEnName already exists")
	}

	if err := aS.boatDao.CreateBoat(aBoat); err != nil {
		log.Printf("failed to create boat: %v", err)
		return fmt.Errorf("failed to create boat: %w", err)
	}

	return nil
}

func (aS *BoatService) DeleteBoats(aBoatIDs []uint) error {
	if len(aBoatIDs) == 0 {
		return fmt.Errorf("boatIds are required")
	}

	if err := aS.boatDao.DeleteBoats(aBoatIDs); err != nil {
		log.Printf("failed to delete boats: %v", err)
		return fmt.Errorf("failed to delete boats: %w", err)
	}
	log.Printf("Successfully deleted %d boats", len(aBoatIDs))
	return nil
}

func (aS *BoatService) UpdateBoat(aBoat *models.SysBoat) error {

	if err := aS.boatDao.UpdateBoat(aBoat); err != nil {
		log.Printf("failed to update boat: %v", err)
		return fmt.Errorf("failed to update boat: %w", err)
	}

	log.Printf("Successfully updated boat %d", aBoat.ID)
	return nil
}
