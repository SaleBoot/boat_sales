package models

type SysUser struct {
	// UserId   int    `gorm:"primaryKey;autoIncrement;comment:编码"  json:"userId"`
	Username     string `json:"username" gorm:"type:varchar(64);comment:用户名"`
	Email        string `json:"email" gorm:"type:varchar(128);comment:邮箱"`
	PasswordHash string `json:"-" gorm:"type:varchar(128);comment:密码Hash"`
	Role         int    `json:"roleId" gorm:"type:bigint;comment:角色ID"` // 0 = regular user, 1 = admin
	// Avatar       stri
	// ng `json:"avatar" gorm:"type:varchar(255);comment:头像"`
	ControlBy
	ModelTime
}

// type SysUser1 struct {
// 	NickName string `json:"nickName" gorm:"type:varchar(128);comment:昵称"`
// 	Phone    string `json:"phone" gorm:"type:varchar(11);comment:手机号"`
// 	RoleId   int    `json:"roleId" gorm:"type:bigint;comment:角色ID"`
// 	Salt     string `json:"-" gorm:"type:varchar(255);comment:加盐"`
// 	Avatar   string `json:"avatar" gorm:"type:varchar(255);comment:头像"`
// 	Sex      string `json:"sex" gorm:"type:varchar(255);comment:性别"`
// 	Email    string `json:"email" gorm:"type:varchar(128);comment:邮箱"`
// 	DeptId   int    `json:"deptId" gorm:"type:bigint;comment:部门"`
// 	PostId   int    `json:"postId" gorm:"type:bigint;comment:岗位"`
// 	Remark   string `json:"remark" gorm:"type:varchar(255);comment:备注"`
// 	Status   string `json:"status" gorm:"type:varchar(4);comment:状态"`
// 	ControlBy
// 	ModelTime
// }

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
