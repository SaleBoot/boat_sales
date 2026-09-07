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

	defaultAdminUser := &models.SysUser{
		UserName:     "Display",
		Email:        defaultEmail,
		PasswordHash: passwordHash,
		Role:         1,
		// Avatar:       "default-avatar.jpg",
	}

	if err := aUserDao.CreateUser(defaultAdminUser); err != nil {
		return fmt.Errorf("failed to create default admin user: %w", err)
	}

	// 创建默认普通用户
	passwordHash, err = utils.HashAdminPassword("abc.123@")
	if err != nil {
		return fmt.Errorf("failed to hash default password: %w", err)
	}
	defaultRegularUser := &models.SysUser{
		UserName:     "Display",
		Email:        "abc@163.com",
		PasswordHash: passwordHash,
		Role:         0,
		// Avatar:       "default-avatar.jpg",
	}
	if err := aUserDao.CreateUser(defaultRegularUser); err != nil {
		return fmt.Errorf("failed to create default regular user: %w", err)
	}

	log.Printf("Default user '%s' created successfully.", defaultEmail)
	return nil
}
