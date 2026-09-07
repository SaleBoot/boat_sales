package migrate

// todo: 引入 golang-migrate/migrate 库。
import (
	"boatsales-backend/internal/db"
	"fmt"
	"log"

	// 引入纯 Go 的 SQLite 驱动

	"gorm.io/gorm"
)

type Product struct {
	gorm.Model
	Code  string `gorm:"unique;not null"`
	Price uint
}

func Main_migrate() {
	// 2. 连接 SQLite 数据库（如果文件不存在，会自动创建 test.db）
	_, err := db.InitSqlite3DB()
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	fmt.Println("数据库迁移成功，表已创建/更新！")
}
