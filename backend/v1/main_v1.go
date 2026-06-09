package v1

import (
	"boatsales-backend/internal/types"
	"context"
	"mime"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

func init() {
	// 放在这里，确保在 Gin 启动前完成注册
	mime.AddExtensionType(".fbx", "application/octet-stream")
	mime.AddExtensionType(".glb", "model/gltf-binary")
}

func Main_v1() {
	// 1. 🌟 关键：加载项目根目录下的 .env 文件
	// 它会自动把文件里的键值对注入到系统的环境变量中
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
		// 这里不直接返回错误，因为在生产环境中我们可能已经通过其他方式设置了环境变量
	}
	// 核心应用对象创建
	app, wsM, err := NewApp()
	if err != nil {
		log.Fatal(err)
	}

	// run ws hub
	wsM.RunWsHub()

	// create gin router
	r := gin.Default()

	// 1. cors基础配置：允许所有来源（等同于 Allow-Origin: *）但不允许携带 Credentials (Cookie)。
	// 如果你需要 Cookie，就必须使用 cors.New 并明确列出 AllowOrigins。
	// r.Use(cors.Default())

	// // 2. cors进阶配置：自定义规则（生产环境推荐）
	r.Use(cors.New(cors.Config{
		// 1. 实现“动态设置允许的来源”逻辑
		// 对应原代码中的：if origin := r.Header.Get("Origin"); origin != ""
		// 官方插件会自动处理 Vary: Origin 响应头
		AllowOriginFunc: func(origin string) bool {
			return origin != "" // 只要 Origin 不为空就允许，等同于你的动态设置
		},

		// 2. 设置允许的 HTTP 方法
		// 对应原代码中的：Access-Control-Allow-Methods
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},

		// 3. 设置允许的请求头
		// 对应原代码中的：Access-Control-Allow-Headers
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},

		// 4. 允许携带凭证
		// 对应原代码中的：Access-Control-Allow-Credentials
		AllowCredentials: true,

		// 注意：官方插件会自动处理第 3 步（OPTIONS 请求拦截并返回 204）
	}))
	app.RegisterRoutes(r)

	// 生产环境下关闭调试日志，能显著提升性能。
	// gin.SetMode(gin.ReleaseMode)

	// 步骤四：配置精细化的 HTTP 服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	server := &http.Server{
		Addr: ":" + port,
		// 这意味着所有请求进来，先过跨域检查，再分发到具体路由。
		Handler: r,
		// 读取超时时间，防止客户端请求过慢导致服务器资源浪费。
		// 防止黑客恶意建立连接却不发数据（慢速连接攻击/Slowloris）。
		ReadTimeout: 5 * time.Second,
		// 写入超时时间，防止服务器处理过慢导致客户端超时。
		// 由于该项目可能涉及大文件、复杂场景数据或者导出订单，所以给出了较宽裕的 2 分钟。
		WriteTimeout: 120 * time.Second,
		// 空闲超时时间，防止客户端保持连接过久导致服务器资源浪费。
		// 开启 HTTP Keep-Alive 时，连接在没有新请求下的最大存活时间，用完自动断开以释放服务器内存。
		IdleTimeout: 30 * time.Second,
	}

	// ======================================================================
	// ✅【标准写法】启动 HTTP 服务 —— 放在协程里
	// ======================================================================
	go func() {
		log.Println("🚀 Go server is running at http://localhost:" + port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// ======================================================================
	// ✅【标准写法】信号监听 —— 放在主线程
	// ======================================================================
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch
	log.Println("🛑 正在关闭服务...")

	// 关闭 WebSocket
	wsM.Stop()

	// 关闭 HTTP 服务
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown Error:", err)
	}

	log.Println("✅ 服务已安全关闭")
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

func timeHandler(c *gin.Context) {
	now := time.Now()
	c.JSON(http.StatusOK, gin.H{
		"unix": now.Unix(),
		"iso":  now.Format(time.RFC3339),
	})
}

func basicSceneHandler(c *gin.Context) {
	payload := types.ScenePayload{
		Name:   "basic-scene",
		Camera: types.Vec3{X: 0, Y: 2, Z: 6},
		Objects: []types.SceneObject{
			{
				ID:       "cube-1",
				Kind:     "box",
				Position: types.Vec3{X: 0, Y: 0, Z: 0},
				Rotation: types.Vec3{X: 0, Y: 0.4, Z: 0},
				Scale:    types.Vec3{X: 1, Y: 1, Z: 1},
				Material: types.Material{Type: "standard", Color: types.Color{Hex: "#44aa88"}},
			},
			{
				ID:       "sphere-1",
				Kind:     "sphere",
				Position: types.Vec3{X: 2, Y: 0.5, Z: -1},
				Rotation: types.Vec3{X: 0, Y: 0, Z: 0},
				Scale:    types.Vec3{X: 1, Y: 1, Z: 1},
				Material: types.Material{Type: "standard", Color: types.Color{Hex: "#3f7ad6"}},
			},
		},
	}

	c.JSON(http.StatusOK, payload)
}

func randomSceneHandler(c *gin.Context) {
	count := 10
	if raw := c.Query("count"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 50 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "count must be an integer between 1 and 50",
			})
			return
		}
		count = parsed
	}

	objects := make([]types.SceneObject, 0, count)
	colors := []string{"#e74c3c", "#2ecc71", "#3498db", "#f1c40f", "#9b59b6"}

	for i := 0; i < count; i++ {
		objects = append(objects, types.SceneObject{
			ID:   "obj-" + strconv.Itoa(i+1),
			Kind: []string{"box", "sphere", "cone"}[rand.Intn(3)],
			Position: types.Vec3{
				X: rand.Float64()*10 - 5,
				Y: rand.Float64()*2 + 0.2,
				Z: rand.Float64()*10 - 5,
			},
			Rotation: types.Vec3{
				X: rand.Float64(),
				Y: rand.Float64(),
				Z: rand.Float64(),
			},
			Scale: types.Vec3{
				X: rand.Float64()*1.5 + 0.5,
				Y: rand.Float64()*1.5 + 0.5,
				Z: rand.Float64()*1.5 + 0.5,
			},
			Material: types.Material{
				Type:  "standard",
				Color: types.Color{Hex: colors[rand.Intn(len(colors))]},
			},
		})
	}

	payload := types.ScenePayload{
		Name:    "random-scene",
		Camera:  types.Vec3{X: 0, Y: 5, Z: 10},
		Objects: objects,
	}

	c.JSON(http.StatusOK, payload)
}

// 中间件（Middleware） 模式，专门用于处理 CORS（跨源资源共享） 问题，
// 告诉浏览器，允许来自不同域名的前端请求访问这个后端接口。
//
// 输入：next http.Handler（原本要处理请求的下一个函数）。
// 输出：包装后的新 Handler。
// 这就像一个“安检口”，所有请求在到达真正的业务逻辑（next）之前，必须先经过这个函数的预处理。
//
// -----代码运行流程图 -----
// 浏览器：我想给服务器发个 POST。
// 浏览器：它是跨域的，我得先发个 OPTIONS 问问。
// 中间件：收到 OPTIONS，挂上 Access-Control-Allow-Origin 等牌子，告诉浏览器“可以发”，然后直接返回（return）。
// 浏览器：收到许可，正式发送 POST。
// 中间件：收到 POST，再次挂上跨域牌子，然后通过 next.ServeHTTP 交给后面的业务函数处理。
// func CORSMiddleware() gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		// 第1步：动态设置允许的来源 (Origin)
// 		origin := strings.TrimSpace(c.Request.Header.Get("Origin"))
// 		if origin != "" {
// 			// 动态 Origin：它没有死板地写成 *，而是读取请求头里的 Origin（比如 http://localhost:3000）
// 			// 并原样返回。这比 * 更灵活，且支持带 Cookie 的请求。
// 			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
// 			// Allow-Credentials：设置为 true，允许浏览器在跨域请求中发送 Cookie 或 认证信息。
// 			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
// 			// Vary: Origin：告诉缓存服务器（如 Nginx 或 CDN），响应内容会根据不同的 Origin 而变化，防止缓存冲突。
// 			c.Writer.Header().Add("Vary", "Origin")
// 		}

// 		// 第2步，设置常规跨域权限：允许所有 HTTP 方法和请求头。
// 		// 这是确保前端能够正常发送请求的关键。
// 		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
// 		// Content-Type：指定请求体的 MIME 类型，这里允许 JSON 格式。
// 		// 这是确保前端能够正常发送 JSON 数据的关键。
// 		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
// 		// c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")

// 		// 第3步，处理预检请求 (Preflight)
// 		// 重点：当浏览器发送“复杂请求”（比如带 JSON 的 POST 请求）时，会先发一个 OPTIONS 请求来探测服务器是否允许跨域。
// 		// 这段代码拦截了 OPTIONS 请求，直接返回 204 No Content（成功但无内容），不再向下执行业务逻辑。这能显著减轻服务器压力。
// 		if c.Request.Method == http.MethodOptions {
// 			// 直接截断请求，返回 204
// 			c.AbortWithStatus(http.StatusNoContent)
// 			return
// 		}

// 		// 第4步：移交控制权给下一个中间件或处理函数。
// 		// 如果不是 OPTIONS 请求，或者跨域头已经挂载完毕，就调用 next.ServeHTTP，
// 		// 让请求继续走下去，去执行真正的业务逻辑（比如查数据库、登录等）。
// 		c.Next()
// 	}
// }
