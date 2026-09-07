package models

import "gorm.io/gorm"

type SysUser struct {
	gorm.Model          // 自动注入 ID, CreatedAt, UpdatedAt, DeletedAt (软删除)
	UserName     string `json:"userName" gorm:"type:varchar(64);comment:用户名"`
	Email        string `json:"email" gorm:"type:varchar(128);uniqueIndex;comment:邮箱"`
	PasswordHash string `json:"-" gorm:"type:varchar(128);comment:密码Hash"`
	Role         int    `json:"role" gorm:"type:bigint;comment:角色ID"` // 0 = regularUser, 1 = admin
	// Avatar       string `json:"avatar" gorm:"type:varchar(255);comment:头像"`
}

func (*SysUser) TableName() string {
	return "sys_user"
}

// Encrypt 加密
// func (e *SysUser) Encrypt() (err error) {
// 	if e.Password == "" {
// 		return
// 	}

// 	var hash []byte
// 	if hash, err = bcrypt.GenerateFromPassword([]byte(e.Password), bcrypt.DefaultCost); err != nil {
// 		return
// 	} else {
// 		e.Password = string(hash)
// 		return
// 	}
// }

// func (e *SysUser) BeforeCreate(_ *gorm.DB) error {
// 	return e.Encrypt()
// }
