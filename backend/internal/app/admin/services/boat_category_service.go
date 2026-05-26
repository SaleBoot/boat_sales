package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"log"
)

// EnsureDefaultBoatCategoriesExist checks if default boat categories exist in the database,
// and if not, it seeds the database with a predefined list of categories.
func EnsureDefaultBoatCategoriesExist(d *dao.SysBoatCategoryDao) error {
	count, err := d.Count()
	if err != nil {
		return err
	}

	// If categories already exist, do nothing.
	if count > 0 {
		return nil
	}

	log.Println("No boat categories found, seeding database with default categories...")

	initialData := []models.SysBoatCategory{
		{EnglishName: "New Energy Ship", ChineseName: "新能源船"},
		{EnglishName: "Emergency Rescue Ship", ChineseName: "应急救援船"},
		{EnglishName: "Official Law Enforcement Boat", ChineseName: "公务执法艇"},
		{EnglishName: "Yacht", ChineseName: "游艇"},
	}

	for _, category := range initialData {
		if err := d.CreateBoatCategory(&category); err != nil {
			log.Printf("failed to create default boat category '%s': %v", category.EnglishName, err)
			// Decide if you want to stop on first error or continue
			return err
		}
	}

	log.Println("Successfully seeded default boat categories.")
	return nil
}
