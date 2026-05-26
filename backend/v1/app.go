package v1

import (
	"boatsales-backend/internal/app/admin/apis"
	"boatsales-backend/internal/db"
	"boatsales-backend/pkg/utils"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
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
	userH         *apis.UserHandler
	boatCategoryH *apis.BoatCategoryHandler
	boatH         *apis.BoatHandler
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

type adminActionResponse struct {
	Message string         `json:"message"`
	State   adminDashboard `json:"state"`
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

	// Ensure the default user exists for preview purposes.
	if err := application.userH.EnsureDefaultUserExists(); err != nil {
		log.Fatalf("Failed to ensure default user exists: %v", err)
	}

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
	a.userH = apis.NewUserHandler(database)
	a.boatCategoryH = apis.NewBoatCategoryHandler(database)
	a.boatH = apis.NewBoatHandler(database)
	// TODO:  handler 可能用 几个dao，所以下一步app 只保存 dao实例，type DaoList struct { userDao *SysUserDao;... }
	// AdminMgr 保存 handler 实例，type AdminMgr struct { userH *UserHandler;... }
	// AdminMgr 中的dao 由 app 依赖注入

	return nil
}
