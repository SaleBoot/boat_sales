package apis

import (
	"boatsales-backend/internal/types"
	"boatsales-backend/pkg/utils"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	adminSessionCookieName   = "salesboat_admin_session"
	adminSessionTTL          = 12 * time.Hour
	defaultAdminEmail        = "smartpastaguy@hotmail.com"
	defaultAdminPasswordHash = "pbkdf2_sha256$210000$pSgHvgXd5DpvzfkKgoKrYg==$LwO2yeJLIZnBeWibzIiYCDG9ZONkArnfruvApJXDqCM="
)

type adminSession struct {
	Token     string
	Email     string
	ExpiresAt time.Time
}

type adminAuthStatusResponse struct {
	Authenticated bool                  `json:"authenticated"`
	User          *adminAuthUserSummary `json:"user,omitempty"`
}

type adminAuthUserSummary struct {
	Email string `json:"email"`
}

type adminAuthActionResponse struct {
	Message string                `json:"message"`
	User    *adminAuthUserSummary `json:"user,omitempty"`
}

type adminLoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type adminChangePasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type adminSessionContextKey struct{}

func (a *UserHandler) HandleAdminAuthStatus(c *gin.Context) {
	session, err := a.getAdminSessionFromRequest(c.Request)
	if err != nil {
		a.clearAdminSessionCookie(c.Writer, c.Request)
		c.JSON(http.StatusOK, adminAuthStatusResponse{
			Authenticated: false,
		})
		return
	}

	c.JSON(http.StatusOK, adminAuthStatusResponse{
		Authenticated: true,
		User: &adminAuthUserSummary{
			Email: session.Email,
		},
	})
}

// 处理登录的函数：将用户提交的明文凭证与服务器存储的加密哈希进行对比，并在成功后建立会话。
func (a *UserHandler) HandleAdminLogin(c *gin.Context) {
	// 1. 输入解析与严格校验 (Input Sanitization)
	var input adminLoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: fmt.Sprintf("decode login request: %s", err.Error()),
		})
		return
	}
	log.Printf("login input: %v", input)

	email := utils.NormalizeAdminEmail(input.Email)
	if email == "" || strings.TrimSpace(input.Password) == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{Code: http.StatusBadRequest,
			Message: "email and password are required"})
		log.Printf("handleAdminLogin 1")
		return
	}

	// 2. 从数据库获取用户
	matchedUser, err := a.userDao.GetUserByEmail(email)
	if err != nil {
		log.Printf("handleAdminLogin 2")
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 为了安全，即使用户不存在，也返回模糊的“无效”错误
			c.JSON(http.StatusUnauthorized, types.ApiResponse{Code: http.StatusUnauthorized,
				Message: "invalid email or password"})
		} else {
			// 其他数据库错误，记录日志并返回服务器错误
			log.Printf("database error during login: %v", err)
			c.JSON(http.StatusInternalServerError, types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "A server error occurred."})
		}
		return
	}

	// 4. 核心安全核验 (Security Verification)
	if !utils.VerifyAdminPassword(matchedUser.PasswordHash, input.Password) {
		log.Printf("handleAdminLogin 3")
		c.JSON(http.StatusUnauthorized, types.ApiResponse{Code: http.StatusUnauthorized, Message: "invalid email or password"})
		return
	}

	// 5. 创建会话与持久化 (Session Creation & Persistence)
	session, err := a.createAdminSession(matchedUser.Email)
	if err != nil {
		log.Printf("create admin session error: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{Code: http.StatusInternalServerError, Message: "Failed to create session."})
		return
	}

	// setAdminSessionCookie ：将生成的 Token 通过 HTTP Header 写入浏览器的 Cookie。
	a.setAdminSessionCookie(c.Writer, c.Request, session)
	// 返回成功：向前端发送成功的 JSON 响应，包含用户简要信息。
	c.JSON(http.StatusOK, adminAuthActionResponse{
		Message: "Logged in successfully",
		User: &adminAuthUserSummary{
			Email: matchedUser.Email,
		},
	})
}

// 处理管理员的注销（Logout） 逻辑：销毁服务器和浏览器两端的会话凭证。
// ----------
// 双重销毁：
//
// 服务器端：通过 adminSessionFromContext 获取当前会话。如果存在，调用 a.deleteAdminSession 从内存
// Map 中删除该 Token。这样即使黑客拿到了旧 Token，服务器也不再识别。
//
// 浏览器端：调用 a.clearAdminSessionCookie，通知浏览器将 Cookie 的有效期设置为过期，从而物理删除 Cookie。
// ----------
// 用户体验：无论服务器删除是否成功，都会执行清除 Cookie 并返回成功 JSON，确保用户在界面上能正常退出。
func (a *UserHandler) HandleAdminLogout(c *gin.Context) {
	// 获取当前会话。如果存在，调用 a.deleteAdminSession 从内存
	// Map 中删除该 Token。这样即使黑客拿到了旧 Token，服务器也不再识别。
	session, ok := getAdminSessionFromContext(c)
	if ok {
		a.deleteAdminSession(session.Token)
	}

	// 通知浏览器将 Cookie 的有效期设置为过期，从而物理删除 Cookie。
	a.clearAdminSessionCookie(c.Writer, c.Request)
	c.JSON(http.StatusOK, adminAuthActionResponse{
		Message: "Logged out successfully",
	})
}

// 处理管理员的修改密码（Change Password） 逻辑
func (a *UserHandler) HandleAdminChangePassword(c *gin.Context) {
	// 1.身份核验：通过 adminSessionFromContext 确保当前操作者必须是已登录的管理员。
	session, ok := getAdminSessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized,
			types.ApiResponse{Code: http.StatusUnauthorized,
				Message: "please log in again"})
		return
	}

	// 2.输入解析与校验：
	var input adminChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest,
			types.ApiResponse{Code: http.StatusBadRequest,
				Message: fmt.Sprintf("decode password request: %s", err.Error())})
		return
	}

	if strings.TrimSpace(input.CurrentPassword) == "" {
		c.JSON(http.StatusBadRequest,
			types.ApiResponse{Code: http.StatusBadRequest,
				Message: "current password is required"})
		return
	}

	// 校验新密码是否符合复杂度要求（validateAdminPassword）。
	if err := utils.ValidateAdminPassword(input.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest,
			types.ApiResponse{Code: http.StatusBadRequest,
				Message: err.Error()})
		return
	}

	// 3. 获取当前用户并验证旧密码
	user, err := a.userDao.GetUserByEmail(session.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized,
				types.ApiResponse{Code: http.StatusUnauthorized,
					Message: "admin account no longer exists"})
		} else {
			log.Printf("database error on password change: %v", err)
			c.JSON(http.StatusInternalServerError, types.ApiResponse{Code: http.StatusInternalServerError, Message: "A server error occurred."})
		}
		return
	}

	if !utils.VerifyAdminPassword(user.PasswordHash, input.CurrentPassword) {
		c.JSON(http.StatusUnauthorized,
			types.ApiResponse{Code: http.StatusUnauthorized,
				Message: "current password is incorrect"})
		return
	}

	// 4. 哈希新密码并更新数据库
	newPasswordHash, err := utils.HashAdminPassword(input.NewPassword)
	if err != nil {
		log.Printf("hash new password error: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "Failed to process new password."})
		return
	}

	if err := a.userDao.UpdateUserPassword(user.Email, newPasswordHash); err != nil {
		log.Printf("update password in database error: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "Failed to update password."})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Password updated successfully",
		Data: &adminAuthUserSummary{
			Email: user.Email,
		},
	})
}

// 这个函数 requireAdminSession 在原生 Go 开发中被用作 路由中间件。
// 它的核心作用是：在请求进入真正的业务逻辑（next）之前，强制检查用户是否拥有合法的管理员身份。
// AdminAuthMiddleware 创建一个 Gin 中间件，用于验证管理员会话。
func (a *UserHandler) AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 第一步：身份检查
		// 注意：这里需要将原有的 r *http.Request 替换为 c.Request
		session, err := a.getAdminSessionFromRequest(c.Request)
		// 第二步：拦截与清理
		if err != nil {
			// 如果会话无效或过期，清理 cookie 并中断请求
			a.clearAdminSessionCookie(c.Writer, c.Request)

			// 使用 Gin 的方式返回错误并拦截
			// AbortWithStatusJSON 会直接设置状态码、返回 JSON 并确保后续的业务 Handler 不被执行
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "please log in to access the admin console",
			})

			return
		}
		// 第三步：注入上下文 (The Injection)
		// // 将会话信息注入到请求的上下文中，供后续处理程序使用
		// ctx := context.WithValue(c.Request.Context(), adminSessionContextKey{}, session)
		// c.Request = c.Request.WithContext(ctx)
		//
		// 在 Gin 中，不需要像原生那样通过 r.WithContext 产生新的请求对象。
		// 直接使用 c.Set() 将数据存入 Gin 的上下文中，这是最推荐的做法。
		c.Set("adminSession", session)

		// 第四步：放行 (The Pass)
		// 调用 Next() 执行后续的中间件或业务逻辑 Handler
		c.Next()
	}
}

// 上下文数据提取：这是一个辅助函数，用于从 Go 的 r.Context() 中提取 Session 信息
// 原理：在之前的中间件（Middleware）阶段，程序已经校验了 Cookie 并将解析出的 adminSession 结构体存入了请求的上下文中（Context）。
// 好处：业务逻辑函数（Handler）不需要再关心 Cookie 怎么解析、Token 怎么验证，直接从上下文取“现成”的已通过验证的用户信息即可。
// 从 Gin 的上下文中安全地提取管理员会话
func getAdminSessionFromContext(c *gin.Context) (adminSession, bool) {
	// c.Get() 返回的是 interface{}，需要类型断言
	sessionVal, exists := c.Get("adminSession")
	if !exists {
		return adminSession{}, false
	}

	session, ok := sessionVal.(adminSession)
	return session, ok
}

// 管理员 Session（会话）校验函数：   从传入的 HTTP 请求中读取 Cookie，提取 Token（令牌），
// 然后在服务器内存中验证该管理员会话是否有效、是否过期，并具备并发安全保护和自动清理过期会话的功能。
func (a *UserHandler) getAdminSessionFromRequest(r *http.Request) (adminSession, error) {
	// ### 第一关：提取 Cookie
	// 尝试从 HTTP 请求头（`r *http.Request`）中读取名为 `adminSessionCookieName` 的 Cookie。
	cookie, err := r.Cookie(adminSessionCookieName)
	if err != nil {
		return adminSession{}, errors.New("admin session not found")
	}

	// ### 第二关：合法性微调与非空校验
	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return adminSession{}, errors.New("admin session is empty")
	}

	// ### 第三关：并发锁保护（多线程安全）
	// * **逻辑**：由于 Go 的 Web 服务器是天然高并发的（每个请求在一个独立的 Goroutine 中运行），
	//       多个管理员可能同时发起请求。如果大家都去读写服务器内存里的 `a.sessions`（一个 Map 结构），
	//       会导致 Go 运行时发生严重的 **并发读写崩溃（Fatal error: concurrent map read and map write）**。
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()

	// ### 第四关：清理过期会话（带锁操作）
	a.pruneExpiredAdminSessionsLocked()

	// ### 第五关：内存查找与过期判定
	// * **查找会话**：去服务器的 `a.sessions` 映射表（Map）里查找这个 Token。如果找不到（`!ok`），
	//      说明该 Token 是伪造的或者是已经被服务器单方面销毁了，返回 `invalid`（无效）错误。

	session, ok := a.sessions[token]
	if !ok {
		return adminSession{}, errors.New("admin session is invalid")
	}
	// * **判定过期**：如果找到了，就用当前时间 `time.Now()` 和会话结构体里的过期时间 `session.ExpiresAt` 做对比。
	//           如果当前时间已经过了过期时间，则代表会话已过期。服务器会无情地执行 `delete` 将其从内存中抹去，
	//           并返回 `expired`（过期）错误。
	if time.Now().After(session.ExpiresAt) {
		delete(a.sessions, token)
		return adminSession{}, errors.New("admin session expired")
	}
	// * **放行通过**：如果以上所有关卡全部通过，说明这是一名合法的、处于登录状态的管理员，
	//         最后将 `session` 对象和 `nil`（无错误）返回给调用者，允许其执行后续的管理员特权操作。
	return session, nil
}

// 生成AdminSession
func (a *UserHandler) createAdminSession(email string) (adminSession, error) {
	token, err := generateAdminSessionToken()
	if err != nil {
		return adminSession{}, fmt.Errorf("generate admin session token: %w", err)
	}

	session := adminSession{
		Token:     token,
		Email:     email,
		ExpiresAt: time.Now().Add(adminSessionTTL),
	}

	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()

	a.pruneExpiredAdminSessionsLocked()
	a.sessions[token] = session
	return session, nil
}

// 从 a.sessions 中删除以 token为key的session
func (a *UserHandler) deleteAdminSession(token string) {
	if strings.TrimSpace(token) == "" {
		return
	}

	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	delete(a.sessions, token)
}

// 清理过期会话
func (a *UserHandler) pruneExpiredAdminSessionsLocked() {
	now := time.Now()
	for token, session := range a.sessions {
		if now.After(session.ExpiresAt) {
			delete(a.sessions, token)
		}
	}
}

// 生成一个既高强度安全又适合在 URL 或 Cookie 中传输的随机令牌（Token）。
func generateAdminSessionToken() (string, error) {
	// make([]byte, 32): 预分配一个长度为 32 字节（256 位）的切片。
	// 256 位的熵在目前和可预见的未来，被认为是抗暴力破解的顶级安全强度（等同于 AES-256 的密钥强度）。
	tokenBytes := make([]byte, 32)
	// rand.Read: 注意，这里导入的必须是 crypto/rand 而不是 math/rand。
	// math/rand 是伪随机数，序列可预测，绝对不能用于安全令牌。
	// crypto/rand 调用的是操作系统底层的安全随机数生成器（如 Linux 的 /dev/urandom），具有真正的随机性，黑客无法预测下一个生成的 Token。
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	// 生成的 32 字节原始数据是二进制的（不可读且包含特殊字符），直接放入 Cookie 可能会导致解析错误。因此需要将其转换为文本格式。
	//
	// 这里选择了 RawURLEncoding，它有三个关键特性：
	// URL 安全：标准的 Base64 包含 + 和 /，在 URL 中有特殊含义。URLEncoding 会把它们替换为 - 和 _。
	// Raw（无填充）：标准 Base64 结尾可能会有 = 填充符。Raw 会去掉这些 =, 让 Token 看起来更简洁，
	//       也避免了某些 Web 服务器对 = 产生的转义问题。
	// 效率高：32 字节的数据经过 Base64 编码后，会变成约 43 个字符的字符串。
	return base64.RawURLEncoding.EncodeToString(tokenBytes), nil
}

// (登录/保持登录)
// 这个函数的作用是：在管理员登录成功后，将后端生成的加密令牌写入浏览器的 Cookie。
func (a *UserHandler) setAdminSessionCookie(w http.ResponseWriter,
	r *http.Request, session adminSession) {

	http.SetCookie(w, &http.Cookie{
		// Name: Cookie 的名字（比如叫 admin_session）。
		Name: adminSessionCookieName,
		// Value: 存储的值，这里是 session.Token。这是服务器校验身份的唯一凭证。
		Value: session.Token,
		// Path: "/": 表示该 Cookie 在网站的所有路径下都有效。
		Path: "/",
		//
		Expires: session.ExpiresAt,
		// MaxAge: 设置 Cookie 的有效期（秒）。例如 2 小时。到期后浏览器会自动删除它。
		MaxAge: int(adminSessionTTL.Seconds()),
		// HttpOnly: true: 【非常重要】 禁止浏览器端的 JavaScript 访问该 Cookie。这能极大程度上防止 XSS 攻击（黑客无法通过脚本窃取你的登录 Token）。
		HttpOnly: true,
		// SameSite: http.SameSiteStrictMode: 严格限制第三方网站携带该 Cookie。这能有效防止 CSRF（跨站请求伪造）攻击。
		SameSite: http.SameSiteStrictMode,
		// Secure: 通过 isSecureAdminRequest(r) 动态判断。如果请求是 HTTPS 的，则该值为 true。
		// 开启后，Cookie 只会在加密连接中传输，防止在不安全的网络（如公共 Wi-Fi）中被监听截获。
		Secure: isSecureAdminRequest(r),
	})
}

// 当管理员点击“登出”时，后端需要通知浏览器销毁这个凭证。在 HTTP 协议中，服务器无法主动删除客户端的 Cookie，只能通过“覆盖”的方式来实现。
//
// 它是如何实现“删除”的？
// Value: "": 将值清空，让原本的 Token 失效。
// MaxAge: -1: 这是一个技巧。设置 MaxAge 为负数，告诉浏览器：“这个 Cookie 已经过时了，请立刻把它丢掉”。
// Expires: time.Unix(0, 0): 将过期时间设置为 1970 年 1 月 1 日。由于这个时间远早于当前时间，浏览器会判定该 Cookie 已失效并将其物理删除。
func (a *UserHandler) clearAdminSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminSessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   isSecureAdminRequest(r),
	})
}

// 判断当前请求是否是通过加密的 HTTPS 协议发送的。
func isSecureAdminRequest(r *http.Request) bool {
	// 1. 第一层检查：直接 TLS 连接
	// 场景：如果你的 Go 程序直接接收 HTTPS 流量（即你在代码里用了 ListenAndServeTLS，
	//      并配置了 SSL 证书），那么当一个加密请求进来时，Go 会填充这个 TLS 结构体。
	if r.TLS != nil {
		return true
	}
	//2. 第二层检查：代理协议头（X-Forwarded-Proto）
	// 这是该函数的精华所在。在现代生产环境中，后端程序通常运行在 Nginx、负载均衡器（LB） 或 CDN 后面。
	// 痛点：通常由 Nginx 处理 HTTPS 证书加密，然后通过普通的 HTTP 协议把请求转给后端的 Go 程序。此时，
	//      Go 收到的直接请求是 HTTP，r.TLS 会是 nil。
	// 解决方案：Nginx 在转发请求时，通常会加上一个特殊的 HTTP Header：X-Forwarded-Proto: https，
	//      告诉后端：“虽然我现在是用 HTTP 传给你的，但客户端其实是用 HTTPS 访问我的”。
	// 代码解析：
	// 		r.Header.Get("X-Forwarded-Proto")：获取这个 Header。
	// 		strings.TrimSpace(...)：去掉可能的空格。
	// 		strings.EqualFold(..., "https")：不区分大小写地比较。即使 Header 是 HTTPS 或 https，都能正确匹配。
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}
