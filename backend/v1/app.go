package v1

import (
	"boatsales-backend/internal/app/admin"
	"boatsales-backend/internal/db"
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/pkg/utils"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/gin-gonic/gin"
)

type app struct {
	repoRoot               string
	sourceDir              string
	frontendDir            string
	publicDir              string
	manifestPath           string
	textureAssignmentsPath string
	ordersPath             string
	distDir                string
	contentPath            string
	focusTargetsDir        string
	orderDB                *sql.DB
	mu                     sync.Mutex
	// handlers
	userDao         *dao.SysUserDao
	boatCategoryDao *dao.SysBoatCategoryDao
	boatDao         *dao.SysBoatDao
	cosPathDao      *dao.SysCosPathDao
	// modules
	adminM *admin.AdminModule
}

type projectPaths struct {
	repoRoot               string
	sourceDir              string
	frontendDir            string
	publicDir              string
	manifestPath           string
	textureAssignmentsPath string
	ordersPath             string
	distDir                string
	contentPath            string
	focusTargetsDir        string
}

func NewApp() (*app, error) {
	paths, err := discoverProjectPaths()
	if err != nil {
		return nil, err
	}

	application := &app{
		repoRoot:               paths.repoRoot,
		sourceDir:              paths.sourceDir,
		frontendDir:            paths.frontendDir,
		publicDir:              paths.publicDir,
		manifestPath:           paths.manifestPath,
		textureAssignmentsPath: paths.textureAssignmentsPath,
		ordersPath:             paths.ordersPath,
		distDir:                paths.distDir,
		contentPath:            paths.contentPath,
		focusTargetsDir:        paths.focusTargetsDir,
	}

	err = application.initDb()
	if err != nil {
		return nil, fmt.Errorf("initialize database: %w", err)
	}

	adminModule, err := admin.NewAdminModule(application.userDao, // 依赖注入
		application.boatCategoryDao, // 依赖注入
		application.boatDao,         // 依赖注入
		application.cosPathDao)      // 依赖注入
	if err != nil {
		return nil, fmt.Errorf("initialize admin module: %w", err)
	}
	application.adminM = adminModule

	// 初始化订单数据库
	if err := application.initializeSalesOrderDatabase(); err != nil {
		return nil, err
	}

	return application, nil
}

func discoverProjectPaths() (projectPaths, error) {
	currentDir, err := os.Getwd()
	if err != nil {
		return projectPaths{}, fmt.Errorf("resolve current directory: %w", err)
	}

	searchDir := currentDir
	for {
		repoRoot := searchDir
		if filepath.Base(searchDir) == "backend" { // "gltf"目录实际是go backend 代码目录
			repoRoot = filepath.Dir(searchDir)
		}

		sourceDir := filepath.Join(repoRoot, "backend")    //golang backend 代码目录
		frontendDir := filepath.Join(repoRoot, "frontend") // 前端代码目录
		if utils.IsDirectory(sourceDir) && utils.IsDirectory(frontendDir) {
			publicDir := filepath.Join(frontendDir, "public", "gltf")
			manifestPath := filepath.Join(publicDir, "asset-manifest.json")
			return projectPaths{
				repoRoot:               repoRoot,
				sourceDir:              sourceDir,    //golang backend 代码目录
				frontendDir:            frontendDir,  // 前端代码目录
				publicDir:              publicDir,    // glb文件夹目录
				manifestPath:           manifestPath, // asset-manifest.json路径
				textureAssignmentsPath: filepath.Join(repoRoot, "data", "texture-assignments.json"),
				// authPath:               filepath.Join(repoRoot, "data", "admin-auth.json"),
				ordersPath:      filepath.Join(repoRoot, "data", "orders.json"),
				distDir:         filepath.Join(frontendDir, "dist"), //// 前端编译结果目录
				contentPath:     filepath.Join(repoRoot, "data", "site-content.json"),
				focusTargetsDir: filepath.Join(repoRoot, "data", "focus-targets"),
			}, nil
		}

		parentDir := filepath.Dir(searchDir)
		if parentDir == searchDir {
			break
		}

		searchDir = parentDir
	}

	return projectPaths{}, errors.New("could not locate repository root containing gltf and frontend directories")
}

func (a *app) initDb() error {
	// Initialize the database connection.
	database, err := db.InitSqlite3DB()
	if err != nil {
		log.Fatalf("Failed to initialize sqlite3 database: %v", err)
	}

	// Initialize DAO instances.
	a.userDao = dao.NewSysUserDao(database)
	a.boatCategoryDao = dao.NewSysBoatCategoryDao(database)
	a.boatDao = dao.NewSysBoatDao(database)
	a.cosPathDao = dao.NewSysCosPathDao(database)
	// TODO:  handler 可能用 几个dao，所以下一步app 只保存 dao实例，type DaoList struct { userDao *SysUserDao;... }
	// AdminMgr 保存 handler 实例，type AdminMgr struct { userH *UserHandler;... }
	// AdminMgr 中的dao 由 app 依赖注入

	return nil
}

func (a *app) RegisterRoutes(r *gin.Engine) error {
	// 1. 基础/公共路由
	r.GET("/health", healthHandler)
	api := r.Group("/api")
	{
		api.GET("/time", timeHandler)
		api.GET("/scene/basic", basicSceneHandler)
		api.GET("/scene/random", randomSceneHandler)
	}
	// 2. 业务模块路由（解耦设计）
	a.RegisterAdminRoutes(api)
	a.RegisterContentRoutes(api)
	a.RegisterOrderRoutes(api)
	a.RegisterStaticRscRoutes(r)

	return nil
}
