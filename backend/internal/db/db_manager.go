package db

import (
	"boatsales-backend/internal/db/dao"
	"log"
)

type DbManager struct {
	UserDao               *dao.SysUserDao
	BoatCategoryDao       *dao.SysBoatCategoryDao
	BoatDao               *dao.SysBoatDao
	CosPathDao            *dao.SysCosPathDao
	BoatModelDao          *dao.SysBoatModelDao
	ModelVCamDao          *dao.SysModelVCamDao
	VideoDao              *dao.SysVideoDao
	BoatEngineDao         *dao.SysBoatEngineDao
	ModelEngineOptionsDao *dao.SysModelEngineOptionsDao
}

func NewDbManager() (*DbManager, error) {
	// Initialize the database connection.
	database, err := InitSqlite3DB()
	if err != nil {
		log.Fatalf("Failed to initialize sqlite3 database: %v", err)
	}

	// 这里可以添加一些初始化逻辑，比如确保默认用户存在等
	adminM := &DbManager{
		UserDao:               dao.NewSysUserDao(database),
		BoatCategoryDao:       dao.NewSysBoatCategoryDao(database),
		BoatDao:               dao.NewSysBoatDao(database),
		CosPathDao:            dao.NewSysCosPathDao(database),
		BoatModelDao:          dao.NewSysBoatModelDao(database),
		ModelVCamDao:          dao.NewSysModelVCamDao(database),
		VideoDao:              dao.NewSysVideoDao(database),
		BoatEngineDao:         dao.NewSysBoatEngineDao(database),
		ModelEngineOptionsDao: dao.NewSysModelEngineOptionsDao(database),
	}

	return adminM, nil
}
