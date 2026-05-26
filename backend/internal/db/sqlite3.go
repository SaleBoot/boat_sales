package db

import (
	"boatsales-backend/internal/db/models"
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var _db *gorm.DB

// InitDB initializes the database connection.
func InitSqlite3DB() (*gorm.DB, error) {
	if _db != nil {
		return _db, nil
	}

	// Connect to the SQLite database (will create the file if it doesn't exist)
	db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
		return nil, err
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&models.SysUser{},
		&models.SysBoatCategory{},
		&models.SysBoat{},
	)
	if err != nil {
		log.Fatalf("failed to auto migrate database: %v", err)
		return nil, err
	}

	fmt.Println("Database connection successful!")
	_db = db
	return _db, nil
}

// GetDB returns the singleton database instance.
func GetSqlite3DB() *gorm.DB {
	if _db == nil {
		log.Fatal("database is not initialized")
	}
	return _db
}
