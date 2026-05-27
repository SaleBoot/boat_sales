package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/pkg/utils"
	"errors"
	"fmt"
	"log"

	"gorm.io/gorm"
)

func EnsureDefaultUserExists(aUserDao *dao.SysUserDao) error {
	defaultEmail := "display@preview.com"
	defaultPassword := "cqjscb2026"

	_, err := aUserDao.GetUserByEmail(defaultEmail)
	if err == nil {
		// User already exists, nothing to do.
		return nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// An unexpected database error occurred.
		return fmt.Errorf("failed to check for default user: %w", err)
	}

	// User does not exist, so create them.
	passwordHash, err := utils.HashAdminPassword(defaultPassword)
	if err != nil {
		return fmt.Errorf("failed to hash default password: %w", err)
	}

	defaultUser := &models.SysUser{
		UserName:     "Display",
		Email:        defaultEmail,
		PasswordHash: passwordHash,
	}

	if err := aUserDao.CreateUser(defaultUser); err != nil {
		return fmt.Errorf("failed to create default user: %w", err)
	}

	log.Printf("Default user '%s' created successfully.", defaultEmail)
	return nil
}
