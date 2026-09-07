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

type BoatService struct {
	boatDao      *dao.SysBoatDao
	boatModelDao *dao.SysBoatModelDao
	optionDao    *dao.SysModelEngineOptionsDao
}

func NewBoatService(
	aBoatDao *dao.SysBoatDao,
	aBoatModelDao *dao.SysBoatModelDao,
	aOptionDao *dao.SysModelEngineOptionsDao,
) (*BoatService, error) {
	if aBoatDao == nil || aBoatModelDao == nil || aOptionDao == nil {
		return nil, fmt.Errorf("NewBoatService: aBoatDao or aBoatModelDao or aOptionDao is required")
	}

	return &BoatService{
		boatDao:      aBoatDao,
		boatModelDao: aBoatModelDao,
		optionDao:    aOptionDao,
	}, nil // 依赖注入
}

func (aS *BoatService) GetBoatsByCategoryStrID(
	aCategoryStrID string,
) ([]models.SysBoat, error) {
	category := strings.TrimSpace(aCategoryStrID)

	var boats []models.SysBoat
	var err error
	if category != "" {
		boats, err = aS.boatDao.GetBoatsByCategoryStrID(category)
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

// boat -> boatModel -> option -> engine
func (aS *BoatService) DeleteBoats(
	aCtx context.Context,
	aBoatIDs []uint,
) error {
	if len(aBoatIDs) == 0 {
		return fmt.Errorf("boatIds are required")
	}

	err := aS.boatDao.ExecInTransaction(aCtx, func(tx *gorm.DB) error {
		//
		boatEnNames, err := aS.boatDao.GetBoatEnNamesWithTx(tx, aBoatIDs)
		if err != nil {
			return fmt.Errorf("failed to get boatEnNames: %w", err)
		}

		if err := aS.boatDao.DeleteBoatsWithTx(tx, aBoatIDs); err != nil {
			return fmt.Errorf("failed to delete boats: %w", err)
		}

		//
		modelIDs, err := aS.boatModelDao.GetModelIDsByBoatEnNameWithTx(tx, boatEnNames)
		if err != nil {
			return fmt.Errorf("failed to get modelIDs by boatEnName: %w", err)
		}

		if err := aS.boatModelDao.DeleteByBoatEnNamesWithTx(tx, boatEnNames); err != nil {
			return fmt.Errorf("failed to delete boat models: %w", err)
		}

		//
		if err := aS.optionDao.DeleteByBoatModelIDs(tx, modelIDs); err != nil {
			return fmt.Errorf("failed to delete options: %w", err)
		}

		return nil
	})

	if err != nil {
		log.Printf("failed to delete boats: %v", err)
		return fmt.Errorf("failed to delete boats: %w", err)
	}
	log.Printf("Successfully deleted %d boats", len(aBoatIDs))
	return nil
}

func (aS *BoatService) UpdateBoat(
	aCtx context.Context,
	aNewBoat *models.SysBoat,
) error {

	err := aS.boatDao.ExecInTransaction(aCtx, func(tx *gorm.DB) error {
		ids := []uint{aNewBoat.ID}
		boatEnNames, err := aS.boatDao.GetBoatEnNamesWithTx(tx, ids)
		if err != nil || len(boatEnNames) == 0 {
			return fmt.Errorf("failed to get boatEnNames: %w", err)
		}

		// 1. 更新 boat 表
		if err := aS.boatDao.UpdateBoatWithTx(tx, aNewBoat); err != nil {
			return fmt.Errorf("failed to update boat: %w", err)
		}

		if boatEnNames[0] == aNewBoat.BoatEnName {
			log.Println("boat table do not change boatEnName,so not update boat models")
			return nil
		}

		// 2. 根据 boatEnName 更新 boatModel 表
		if err := aS.boatModelDao.UpdateBoatEnNameWithTx(
			tx, boatEnNames[0], aNewBoat.BoatEnName,
		); err != nil {
			return fmt.Errorf("failed to update boat models: %w", err)
		}

		return nil
	})

	if err != nil {
		log.Printf("failed to update boat transaction: %v", err)
		return fmt.Errorf("failed to update boat: %w", err)
	}

	log.Printf("Successfully updated boat %d and related models", aNewBoat.ID)
	return nil
}
