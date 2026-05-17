package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Color struct {
	Hex string `json:"hex"`
}

type Material struct {
	Type  string `json:"type"`
	Color Color  `json:"color"`
}

type SceneObject struct {
	ID       string   `json:"id"`
	Kind     string   `json:"kind"`
	Position Vec3     `json:"position"`
	Rotation Vec3     `json:"rotation"`
	Scale    Vec3     `json:"scale"`
	Material Material `json:"material"`
}

type ScenePayload struct {
	Name    string        `json:"name"`
	Camera  Vec3          `json:"camera"`
	Objects []SceneObject `json:"objects"`
}

func main() {
	// 以当前时间的纳秒数（time.Now().UnixNano()）作为种子，初始化全局伪随机数生成器。
	// 为什么要写：后续代码中出现了 /api/scene/random（随机场景），这个初始化确保了程序每次启动时，
	// 产生的随机数序列都是不同的，避免每次重启后抽到相同的“随机”结果。
	// (注：在较新的 Go 版本中这行可以省略，但在旧版本或为了兼容性，这行很常见)。
	rand.Seed(time.Now().UnixNano())

	//步骤二：核心应用对象创建
	app, err := newApp()
	if err != nil {
		log.Fatal(err)
	}

	// 步骤三：模块化路由注册
	mux := http.NewServeMux()
	// 1. 基础/公共路由
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/time", timeHandler)
	mux.HandleFunc("/api/scene/basic", basicSceneHandler)
	mux.HandleFunc("/api/scene/random", randomSceneHandler)
	// 2. 业务模块路由（解耦设计）
	app.registerAdminRoutes(mux)
	app.registerContentRoutes(mux)
	app.registerOrderRoutes(mux)
	app.registerFrontendRoutes(mux)

	// 步骤四：配置精细化的 HTTP 服务器
	server := &http.Server{
		Addr: ":8080",
		// 这意味着所有请求进来，先过跨域检查，再分发到具体路由。
		Handler: withCORS(mux), // 注入跨域中间件
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

	log.Println("Go server is running at http://localhost:8080")
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func timeHandler(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	writeJSON(w, http.StatusOK, map[string]any{
		"unix": now.Unix(),
		"iso":  now.Format(time.RFC3339),
	})
}

func basicSceneHandler(w http.ResponseWriter, r *http.Request) {
	payload := ScenePayload{
		Name:   "basic-scene",
		Camera: Vec3{X: 0, Y: 2, Z: 6},
		Objects: []SceneObject{
			{
				ID:       "cube-1",
				Kind:     "box",
				Position: Vec3{X: 0, Y: 0, Z: 0},
				Rotation: Vec3{X: 0, Y: 0.4, Z: 0},
				Scale:    Vec3{X: 1, Y: 1, Z: 1},
				Material: Material{Type: "standard", Color: Color{Hex: "#44aa88"}},
			},
			{
				ID:       "sphere-1",
				Kind:     "sphere",
				Position: Vec3{X: 2, Y: 0.5, Z: -1},
				Rotation: Vec3{X: 0, Y: 0, Z: 0},
				Scale:    Vec3{X: 1, Y: 1, Z: 1},
				Material: Material{Type: "standard", Color: Color{Hex: "#3f7ad6"}},
			},
		},
	}

	writeJSON(w, http.StatusOK, payload)
}

func randomSceneHandler(w http.ResponseWriter, r *http.Request) {
	count := 10
	if raw := r.URL.Query().Get("count"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 50 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "count must be an integer between 1 and 50",
			})
			return
		}
		count = parsed
	}

	objects := make([]SceneObject, 0, count)
	colors := []string{"#e74c3c", "#2ecc71", "#3498db", "#f1c40f", "#9b59b6"}

	for i := 0; i < count; i++ {
		objects = append(objects, SceneObject{
			ID:   "obj-" + strconv.Itoa(i+1),
			Kind: []string{"box", "sphere", "cone"}[rand.Intn(3)],
			Position: Vec3{
				X: rand.Float64()*10 - 5,
				Y: rand.Float64()*2 + 0.2,
				Z: rand.Float64()*10 - 5,
			},
			Rotation: Vec3{
				X: rand.Float64(),
				Y: rand.Float64(),
				Z: rand.Float64(),
			},
			Scale: Vec3{
				X: rand.Float64()*1.5 + 0.5,
				Y: rand.Float64()*1.5 + 0.5,
				Z: rand.Float64()*1.5 + 0.5,
			},
			Material: Material{
				Type:  "standard",
				Color: Color{Hex: colors[rand.Intn(len(colors))]},
			},
		})
	}

	payload := ScenePayload{
		Name:    "random-scene",
		Camera:  Vec3{X: 0, Y: 5, Z: 10},
		Objects: objects,
	}

	writeJSON(w, http.StatusOK, payload)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	// 直接把 Go 的 map 序列化为 JSON 字符串，顺着 w 管道实时喷射给浏览器。
	// json.NewEncoder(w) 并没有在内存中把 JSON 字符串全部生成好再发送，而是
	// 采用“流式传输（Streaming）”，一边将 Map 转换为 JSON，一边就直接写入到
	// 网络连接 w 中了。这在高并发、大数据量时非常节省内存。
	_ = json.NewEncoder(w).Encode(data)
}

// 实现了一个经典的 中间件（Middleware） 模式，专门用于处理 CORS（跨源资源共享） 问题，
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
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 第1步：动态设置允许的来源 (Origin)
		if origin := strings.TrimSpace(r.Header.Get("Origin")); origin != "" {
			// 动态 Origin：它没有死板地写成 *，而是读取请求头里的 Origin（比如 http://localhost:3000）
			// 并原样返回。这比 * 更灵活，且支持带 Cookie 的请求。
			w.Header().Set("Access-Control-Allow-Origin", origin)
			// Allow-Credentials：设置为 true，允许浏览器在跨域请求中发送 Cookie 或 认证信息。
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			// Vary: Origin：告诉缓存服务器（如 Nginx 或 CDN），响应内容会根据不同的 Origin 而变化，防止缓存冲突。
			w.Header().Add("Vary", "Origin")
		}

		// 第2步，设置常规跨域权限：允许所有 HTTP 方法和请求头。
		// 这是确保前端能够正常发送请求的关键。
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		// Content-Type：指定请求体的 MIME 类型，这里允许 JSON 格式。
		// 这是确保前端能够正常发送 JSON 数据的关键。
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// 第3步，处理预检请求 (Preflight)
		// 重点：当浏览器发送“复杂请求”（比如带 JSON 的 POST 请求）时，会先发一个 OPTIONS 请求来探测服务器是否允许跨域。
		// 这段代码拦截了 OPTIONS 请求，直接返回 204 No Content（成功但无内容），不再向下执行业务逻辑。这能显著减轻服务器压力。
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// 第4步：移交控制权给下一个中间件或处理函数。
		// 如果不是 OPTIONS 请求，或者跨域头已经挂载完毕，就调用 next.ServeHTTP，
		// 让请求继续走下去，去执行真正的业务逻辑（比如查数据库、登录等）。
		next.ServeHTTP(w, r)
	})
}
