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
type BoatCategoryService struct {
	boatCategoryDao *dao.SysBoatCategoryDao

	// boatcategoryCache   map[string]string //  English name to Chinese name mapping
	// boatcategoryCacheMu sync.RWMutex
}

func NewBoatCategoryService(aDao *dao.SysBoatCategoryDao,
) (*BoatCategoryService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("NewBoatCategoryService: aDao cannot be nil")
	}

	return &BoatCategoryService{boatCategoryDao: aDao}, nil
}

// EnsureDefaultBoatCategoriesExist checks if default boat categories exist in the database,
// and if not, it seeds the database with a predefined list of categories.
func (aS *BoatCategoryService) EnsureDefaultBoatCategoriesExist() error {
	count, err := aS.boatCategoryDao.Count()
	if err != nil {
		return err
	}

	// If categories already exist, do nothing.
	if count > 0 {
		return nil
	}

	log.Println("No boat categories found, seeding database with default categories...")

	initialData := []models.SysBoatCategory{
		{CategoryStrID: "NewEnergy", EnName: "New Energy", CnName: "新能源船"},
		{CategoryStrID: "EmergencyRescue", EnName: "Emergency Rescue", CnName: "应急救援船"},
		{CategoryStrID: "OfficialEnforcement", EnName: "Official Law Enforcement", CnName: "公务执法艇"},
		{CategoryStrID: "Yacht", EnName: "Yacht", CnName: "游艇"},
	}

	// it is not necessary to use transaction because initial stage
	for _, category := range initialData {
		if err := aS.boatCategoryDao.CreateBoatCategory(&category); err != nil {
			log.Printf("failed to create default boat category '%s': %v", category.CategoryStrID, err)
			// Decide if you want to stop on first error or continue
			return err
		}
	}

	log.Println("Successfully seeded default boat categories.")
	return nil
}

func (aS *BoatCategoryService) GetBoatCategories() ([]models.SysBoatCategory, error) {

	categories, err := aS.boatCategoryDao.GetAllBoatCategories()
	if err != nil {
		log.Printf("failed to get boat categories: %v", err)
		return nil, err
	}

	return categories, nil
}

func (aS *BoatCategoryService) AddBoatCategory(
	aCategoryStrID string,
	aEnName string,
	aCnName string,
) error {
	log.Println("AddBoatCategory,start")
	defer log.Println("AddBoatCategory,end")

	category := models.SysBoatCategory{
		CategoryStrID: aCategoryStrID,
		EnName:        aEnName,
		CnName:        aCnName,
	}

	if err := aS.boatCategoryDao.CreateBoatCategory(&category); err != nil {
		log.Printf("failed to create boat category: %v", err)
		return fmt.Errorf("failed to create boat category: %w", err)
	}

	return nil
}

func (aH *BoatCategoryService) UpdateBoatCategory(
	aCategoryIntId int,
	aCategoryStrID string,
	aEnName string,
	aCnName string,
) error {
	log.Printf("UpdateBoatCategory: Attempting to update category with ID: %d, new CategoryStrID: %s, EnName: %s, CnName: %s",
		aCategoryIntId, aCategoryStrID, aEnName, aCnName)

	category, err := aH.boatCategoryDao.GetBoatCategoryByID(uint(aCategoryIntId))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("UpdateBoatCategory: Category with ID %d not found.", aCategoryIntId)
			return fmt.Errorf("category not found")
		}

		log.Printf("UpdateBoatCategory: failed to find boat category for update (ID: %d): %v", aCategoryIntId, err)
		return fmt.Errorf("failed to find category")
	}

	log.Printf("UpdateBoatCategory: Found category (ID: %d, current CategoryStrID: %s, EnName: %s, CnName: %s). Updating fields...",
		category.ID, category.CategoryStrID, category.EnName, category.CnName)

	category.CategoryStrID = aCategoryStrID
	category.EnName = aEnName
	category.CnName = aCnName

	if err := aH.boatCategoryDao.UpdateBoatCategory(category); err != nil {
		log.Printf("UpdateBoatCategory: failed to update boat category (ID: %d): %v", category.ID, err)
		return fmt.Errorf("failed to update category: %w", err)
	}

	log.Printf("UpdateBoatCategory: Successfully updated category with ID: %d", category.ID)
	return nil
}

func (aH *BoatCategoryService) DeleteBoatCategories(aIDs []uint) error {
	if len(aIDs) == 0 {
		return fmt.Errorf("category IDs are required")
	}
	if err := aH.boatCategoryDao.DeleteBoatCategories(aIDs); err != nil {
		log.Printf("failed to delete boat categories: %v", err)
		return fmt.Errorf("failed to delete boat categories: %w", err)
	}

	return nil
}
