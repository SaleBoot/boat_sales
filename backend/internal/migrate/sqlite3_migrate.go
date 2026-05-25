package migrate

import (
	"boatsales-backend/internal/models"
	"fmt"
	"log"

	// 引入纯 Go 的 SQLite 驱动
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type Product struct {
	gorm.Model
	Code  string `gorm:"unique;not null"`
	Price uint
}

func Main_migrate() {
	// 2. 连接 SQLite 数据库（如果文件不存在，会自动创建 test.db）
	db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("无法连接数据库: %v", err)
	}
	fmt.Println("数据库连接成功！")

	// 3. 执行自动迁移 (AutoMigrate)
	// 你可以把所有需要创建表的结构体实例按顺序传进去
	err = db.AutoMigrate(&models.SysUser{}, &Product{})
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	fmt.Println("数据库迁移成功，表已创建/更新！")
}
