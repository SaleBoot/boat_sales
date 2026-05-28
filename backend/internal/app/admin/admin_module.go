package admin

import (
	"boatsales-backend/internal/app/admin/apis"
	"boatsales-backend/internal/app/admin/services"
	"boatsales-backend/internal/db/dao"
	"fmt"

	"github.com/gin-gonic/gin"
)

type AdminModule struct {
	// 这里可以添加一些全局的依赖，比如数据库连接、配置等
	userH         *apis.UserHandler
	boatCategoryH *apis.BoatCategoryHandler
	boatH         *apis.BoatHandler
}

func NewAdminModule(aUserDao *dao.SysUserDao, // 依赖注入
	aBoatCategoryDao *dao.SysBoatCategoryDao, // 依赖注入
	aBoatDao *dao.SysBoatDao) (*AdminModule, error) { // aBoatDao是 依赖注入

	// 确保默认用户存在
	if err := services.EnsureDefaultUserExists(aUserDao); err != nil {
		return nil, fmt.Errorf("failed to initialize admin module: %w", err)
	}

	// 确保默认船只分类存在
	if err := services.EnsureDefaultBoatCategoriesExist(aBoatCategoryDao); err != nil {
		return nil, fmt.Errorf("failed to initialize admin module: %w", err)
	}

	// 这里可以添加一些初始化逻辑，比如确保默认用户存在等
	adminM := &AdminModule{
		userH:         apis.NewUserHandler(aUserDao),
		boatCategoryH: apis.NewBoatCategoryHandler(aBoatCategoryDao),
		boatH:         apis.NewBoatHandler(aBoatDao),
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

		aAdminRG.GET("/cos/presigned-url", apis.HandleGetCosURL4SingleFile) // 获取 COS 预签名 URL 的接口
		aAdminRG.GET("/cos/model-paths", apis.HandleListAllModelPaths)      // 列出模型路径的接口
		aAdminRG.GET("/cos/list-files", apis.HandleListFiles)               // 列出 COS 文件的接口
		aAdminRG.GET("/cos/tree", apis.HandleListDirTree)
	}

}

func (a *AdminModule) AdminAuthMiddleware() gin.HandlerFunc {
	return a.userH.AdminAuthMiddleware()
}
