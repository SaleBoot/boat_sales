package admin

import (
	"boatsales-backend/internal/app/admin/apis"
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/services"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type AdminModule struct {
	// 这里可以添加一些全局的依赖，比如数据库连接、配置等
	userH         *apis.UserHandler
	boatCategoryH *apis.BoatCategoryHandler
	boatH         *apis.BoatHandler
	cosH          *apis.CosHandler
	boatModelH    *apis.BoatModelHandler
}

func NewAdminModule(aUserDao *dao.SysUserDao, // 依赖注入
	aBoatCategorySvc *services.BoatCategoryService, // 依赖注入
	aBoatSvc *services.BoatService, // 依赖注入
	aCosPathSyncSvc *services.CosPathService, // 依赖注入
	aBoatModelSvc *services.BoatModelService, // 依赖注入
) (*AdminModule, error) {

	uH, err := apis.NewUserHandler(aUserDao)
	if err != nil {
		return nil, fmt.Errorf("failed to NewUserHandler: %w", err)
	}

	bcH, err := apis.NewBoatCategoryHandler(aBoatCategorySvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewBoatCategoryHandler: %w", err)
	}

	//
	shouldSyncCosDirTree := os.Getenv("SyncCosDirTree") // 读环境变量
	shouldSyncCosDirTree = strings.ToLower(strings.TrimSpace(shouldSyncCosDirTree))
	isSyncCosDirTree := (shouldSyncCosDirTree != "false")
	if isSyncCosDirTree {
		log.Println("To sync CosDirTree to db!")
	} else {
		log.Println("Not to sync CosDirTree to db!")
	}

	cosHTmp, err := apis.NewCosHandler(aCosPathSyncSvc, isSyncCosDirTree)
	if err != nil {
		return nil, fmt.Errorf("failed to NewCosHandler: %w", err)
	}

	//
	bH, err := apis.NewBoatHandler(aBoatSvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewBoatHandler: %w", err)
	}

	bmH, err := apis.NewBoatModelHandler(aBoatModelSvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewBoatModelHandler: %w", err)
	}

	// 这里可以添加一些初始化逻辑，比如确保默认用户存在等
	adminM := &AdminModule{
		userH:         uH,
		boatCategoryH: bcH,
		boatH:         bH,
		cosH:          cosHTmp, // 依赖注入
		boatModelH:    bmH,     // 依赖注入
	}

	return adminM, nil
}

/*
	func (a *AdminModule) RegisterRoutes(r *gin.RouterGroup) {
		// 创建管理后台路由组
		admin := r.Group("/admin")

		// 登录和状态检查不需要 Session 中间件
		admin.GET("/auth/status", a.userH.HandleAdminAuthStatus)
		admin.POST("/auth/login", a.userH.HandleAdminLogin)

		//-----------------------------
		//  用于提醒别写错路由参数的注释：
		//  原生路由通常用花括号：/assets/{modelID}，Gin 使用冒号：/assets/:modelID；
		//  如果在 Gin 里还写 {modelID}，c.Param 是拿不到值的。
		//  c.Param: 针对 /user/:id 路径里的变量。URL链接类似于 http://localhost:8080/user/1024
		//  c.Query: 针对 /user?id=123 问号后面的变量。URL链接类似于 http://localhost:8080/user?id=1024
		// // mux.HandleFunc("PUT /api/admin/videos/{videoID}", a.handleAdminUpdateVideo)
		// // videos.PUT("/:videoID", a.handleAdminUpdateVideo)
		//-----------------------------

		// 接下来的路由全部需要管理员权限
		// 自动应用中间件，不再需要手动包裹每个 handler
		admin.Use(a.AdminAuthMiddleware())
		{
			admin.POST("/auth/logout", a.userH.HandleAdminLogout)
			admin.POST("/auth/change-password", a.userH.HandleAdminChangePassword)

			// 用户管理 (路径自动拼接为 /api/admin/users)
			usersGroup := admin.Group("/users")
			{
				usersGroup.GET("", a.userH.HandleGetAllUsers)
				usersGroup.POST("", a.userH.HandleCreateUser)
				usersGroup.POST("/delete", a.userH.HandleDeleteUsers)
				usersGroup.GET("/:email", a.userH.HandleGetUserByEmail)
				usersGroup.POST("/:email", a.userH.HandleUpdateUserByEmail)
			}

			// Boat Category routes
			boatCategories := admin.Group("/boat-categories")
			{
				boatCategories.GET("", a.boatCategoryH.HandleGetBoatCategories)
				boatCategories.POST("", a.boatCategoryH.HandleAddBoatCategory)
				boatCategories.PUT("/:id", a.boatCategoryH.HandleUpdateBoatCategory)
				boatCategories.POST("/delete", a.boatCategoryH.HandleDeleteBoatCategories)
			}

			// Boat routes
			boats := admin.Group("/boats")
			{
				boats.GET("", a.boatH.HandleGetBoats)
				boats.POST("", a.boatH.HandleAddBoat)
				boats.POST("/delete", a.boatH.HandleDeleteBoats)
			}
		}

}
*/

func (a *AdminModule) RegisterRoutes_noAuth(aAdminRG *gin.RouterGroup) {
	// 创建管理后台路由组
	// admin := r.Group("/admin")

	// 登录和状态检查不需要 Session 中间件
	aAdminRG.GET("/auth/status", a.userH.HandleAdminAuthStatus)
	aAdminRG.POST("/auth/login", a.userH.HandleAdminLogin)

	/*  用于提醒别写错路由参数的注释：
	原生路由通常用花括号：/assets/{modelID}，Gin 使用冒号：/assets/:modelID；
	如果在 Gin 里还写 {modelID}，c.Param 是拿不到值的。
	c.Param: 针对 /user/:id 路径里的变量。URL链接类似于 http://localhost:8080/user/1024
	c.Query: 针对 /user?id=123 问号后面的变量。URL链接类似于 http://localhost:8080/user?id=1024
	*/
	// // mux.HandleFunc("PUT /api/admin/videos/{videoID}", a.handleAdminUpdateVideo)
	// videos.PUT("/:videoID", a.handleAdminUpdateVideo)
	//
}

func (a *AdminModule) RegisterRoutes_underAuth(aAdminRG *gin.RouterGroup) {

	// 接下来的路由全部需要管理员权限
	// 自动应用中间件，不再需要手动包裹每个 handler
	// aAdminRG.Use(a.AdminAuthMiddleware())
	{
		aAdminRG.POST("/auth/logout", a.userH.HandleAdminLogout)
		aAdminRG.POST("/auth/change-password", a.userH.HandleAdminChangePassword)

		// 用户管理 (路径自动拼接为 /api/admin/users)
		usersRG := aAdminRG.Group("/users")
		{
			usersRG.GET("", a.userH.HandleGetAllUsers)
			usersRG.POST("", a.userH.HandleCreateUser)
			usersRG.POST("/delete", a.userH.HandleDeleteUsers)
			usersRG.GET("/:email", a.userH.HandleGetUserByEmail)
			usersRG.POST("/:email", a.userH.HandleUpdateUserByEmail)
		}

		// Boat Category routes
		boatCategories := aAdminRG.Group("/boat-categories")
		{
			boatCategories.GET("", a.boatCategoryH.HandleGetBoatCategories)
			boatCategories.POST("", a.boatCategoryH.HandleAddBoatCategory)
			boatCategories.POST("/:id", a.boatCategoryH.HandleUpdateBoatCategory)
			boatCategories.POST("/delete", a.boatCategoryH.HandleDeleteBoatCategories)
		}

		// Boat routes
		boats := aAdminRG.Group("/boats")
		{
			boats.GET("", a.boatH.HandleGetBoats)
			boats.POST("", a.boatH.HandleAddBoat)
			boats.POST("/:id", a.boatH.HandleUpdateBoat)
			boats.POST("/delete", a.boatH.HandleDeleteBoats)
		}

		cosRG := aAdminRG.Group("/cos")
		{
			cosRG.GET("/sync-cos-dir-tree", a.cosH.HandleSyncCosDirTree)       // 同步 COS 目录树的接口
			cosRG.GET("/presigned-url", a.cosH.HandleGetCosURL4SingleFile)     // 获取 COS 预签名 URL 的接口
			cosRG.GET("/model-paths", a.cosH.HandleGetAllModelPaths)           // 列出模型路径的接口
			cosRG.GET("/subfiles", a.cosH.HandleGetSubFiles)                   // 列出 COS 文件的接口
			cosRG.GET("/descendant-files", a.cosH.HandleGetAllDescendantFiles) // 递归列出所有后代文件的接口
			cosRG.GET("/tree", a.cosH.HandleListDirTree)
		}

		boatModelRG := aAdminRG.Group("/boat-model")
		{
			// api/admin/boat-model/:boatEnName
			boatModelRG.GET("/:boatEnName", a.boatModelH.HandleGetModelsByBoatEnName)
			//  api/admin/boat-model/:boatEnName
			//
			// **客户端需要：
			//     向 POST /api/admin/models/{目标船型英文名}  发送请求。
			//     设置  Content-Type: application/json  请求头。
			//     在请求体中提供一个 JSON 数组，其中包含该船型所有新的模型定义。
			//     数组中每个对象的boatEnName 必须与 URL 中的船型英文名匹配。
			boatModelRG.POST("/:boatEnName", a.boatModelH.HandleUpdateModelWithBoatEnName)
		}
	}

}

func (a *AdminModule) AdminAuthMiddleware() gin.HandlerFunc {
	return a.userH.AdminAuthMiddleware()
}
