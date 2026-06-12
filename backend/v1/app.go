package v1

import (
	"boatsales-backend/internal/app/admin"
	"boatsales-backend/internal/app/front"
	"boatsales-backend/internal/app/ws"
	"boatsales-backend/internal/db"
	"boatsales-backend/internal/services"
	"boatsales-backend/pkg/utils"
	"database/sql"
	"errors"
	"fmt"
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
	// DbManager
	dbm *db.DbManager
	// app modules
	serviceM *services.ServiceManager
	adminM   *admin.AdminModule
	frontM   *front.FrontModule
	wsM      *ws.WsModule
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

func NewApp() (*app, *ws.WsModule, error) {
	paths, err := discoverProjectPaths()
	if err != nil {
		return nil, nil, err
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

	// ----
	dbm, err := db.NewDbManager()
	if err != nil {
		return nil, nil, fmt.Errorf("initialize database: %w", err)
	}
	application.dbm = dbm

	// ----
	svcMtmp, err := services.NewServiceManager(
		application.dbm.BoatCategoryDao, // 依赖注入
		application.dbm.BoatDao,         // 依赖注入
		application.dbm.CosPathDao,      // 依赖注入
		application.dbm.BoatModelDao,    // 依赖注入
		application.dbm.ModelVCamDao,    // 依赖注入
		application.dbm.VideoDao,        // 依赖注入
		application.dbm.BoatEngineDao,   // 依赖注入
	)
	if err != nil {
		return nil, nil, fmt.Errorf("initialize service manager: %w", err)
	}
	application.serviceM = svcMtmp

	// ----
	adminMTmp, err := admin.NewAdminModule(application.dbm.UserDao,
		svcMtmp.BoatCategorySvc,
		svcMtmp.BoatSvc,
		svcMtmp.CosPathSvc,
		svcMtmp.BoatModelSvc,
		svcMtmp.ModelVCamSvc,
		svcMtmp.VideoSvc,
		svcMtmp.BoatEngineSvc,
	) // 依赖注入
	if err != nil {
		return nil, nil, fmt.Errorf("initialize admin module: %w", err)
	}
	application.adminM = adminMTmp

	// ----
	frontMTmp, err := front.NewFrontModule(
		svcMtmp.BoatCategorySvc, // 依赖注入
		svcMtmp.BoatSvc,         // 依赖注入
		svcMtmp.CosPathSvc,      // 依赖注入
		svcMtmp.BoatModelSvc,    // 依赖注入
		svcMtmp.ModelVCamSvc,
		svcMtmp.VideoSvc,
	) // 依赖注入
	if err != nil {
		return nil, nil, fmt.Errorf("initialize front module: %w", err)
	}
	application.frontM = frontMTmp

	//---------
	// ----
	wsM, err := ws.NewWsModule()
	if err != nil {
		return nil, nil, fmt.Errorf("initialize ws module: %w", err)
	}
	application.wsM = wsM

	// 初始化订单数据库
	if err := application.initializeSalesOrderDatabase(); err != nil {
		return nil, nil, err
	}

	return application, wsM, nil
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

	a.frontM.RegisterRoutes(api)
	a.wsM.RegisterRoutes(api)

	a.RegisterContentRoutes(api)
	a.RegisterOrderRoutes(api)
	a.RegisterStaticRscRoutes(r)

	return nil
}
