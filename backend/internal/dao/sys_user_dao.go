package dao

import (
	"boatsales-backend/internal/models"

	"gorm.io/gorm"
)

type SysUserDao struct {
	DB *gorm.DB
}

func NewSysUserDao(db *gorm.DB) *SysUserDao {
	return &SysUserDao{DB: db}
}

// GetAllSysUsers retrieves all users from the sys_user table.
func (d *SysUserDao) GetAllSysUsers() ([]models.SysUser, error) {
	var users []models.SysUser

	result := d.DB.Find(&users)
	if result.Error != nil {
		return nil, result.Error
	}
	return users, nil
}

// CreateUser creates a new user in the sys_user table.
func (d *SysUserDao) CreateUser(user *models.SysUser) error {
	result := d.DB.Create(user)
	return result.Error
}

// GetUserByEmail retrieves a user by their email.
func (d *SysUserDao) GetUserByEmail(email string) (*models.SysUser, error) {
	var user models.SysUser
	result := d.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (d *SysUserDao) UpdateUserPassword(email, newPasswordHash string) error {
	result := d.DB.Model(&models.SysUser{}).Where("email = ?", email).Update("password", newPasswordHash)
	return result.Error
}

// DeleteUsersByID deletes users by their IDs.
func (d *SysUserDao) DeleteUsersByID(userIDs []uint) error {
	result := d.DB.Where("id IN ?", userIDs).Delete(&models.SysUser{})
	return result.Error
}

// UpdateUser updates a user's profile.
func (d *SysUserDao) UpdateUser(user *models.SysUser) error {
	// We only want to update the username, not other fields like password.
	result := d.DB.Model(user).Updates(models.SysUser{Username: user.Username})
	return result.Error
}
