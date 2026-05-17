package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	adminSessionCookieName       = "salesboat_admin_session"
	adminSessionTTL              = 12 * time.Hour
	defaultAdminEmail            = "smartpastaguy@hotmail.com"
	defaultAdminPasswordHash     = "pbkdf2_sha256$210000$pSgHvgXd5DpvzfkKgoKrYg==$LwO2yeJLIZnBeWibzIiYCDG9ZONkArnfruvApJXDqCM="
	defaultPBKDF2Iterations      = 210000
	defaultPBKDF2DerivedKeyBytes = 32
)

type adminAuthConfig struct {
	UpdatedAt string          `json:"updatedAt"`
	Users     []adminAuthUser `json:"users"`
}

type adminAuthUser struct {
	Email        string `json:"email"`
	PasswordHash string `json:"passwordHash"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

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

func (a *app) ensureAdminAuthFile() error {
	if _, err := os.Stat(a.authPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read admin auth config: %w", err)
	}

	config := defaultAdminAuthConfig()
	if err := a.writeAdminAuthConfig(config); err != nil {
		return err
	}

	log.Printf("initialized admin auth config at %s for %s", a.authPath, defaultAdminEmail)
	return nil
}

func defaultAdminAuthConfig() adminAuthConfig {
	now := time.Now().UTC().Format(time.RFC3339)
	return adminAuthConfig{
		UpdatedAt: now,
		Users: []adminAuthUser{
			{
				Email:        defaultAdminEmail,
				PasswordHash: defaultAdminPasswordHash,
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
	}
}

// 读取鉴权配置
func (a *app) readAdminAuthConfig() (adminAuthConfig, error) {
	data, err := os.ReadFile(a.authPath)
	if err != nil {
		if os.IsNotExist(err) {
			config := defaultAdminAuthConfig()
			if err := a.writeAdminAuthConfig(config); err != nil {
				return adminAuthConfig{}, err
			}
			return config, nil
		}

		return adminAuthConfig{}, fmt.Errorf("read admin auth config: %w", err)
	}

	var config adminAuthConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return adminAuthConfig{}, fmt.Errorf("parse admin auth config: %w", err)
	}

	if len(config.Users) == 0 {
		config = defaultAdminAuthConfig()
		if err := a.writeAdminAuthConfig(config); err != nil {
			return adminAuthConfig{}, err
		}
	}

	return config, nil
}

// 把鉴权配置信息转成json写入文件
func (a *app) writeAdminAuthConfig(config adminAuthConfig) error {
	if len(config.Users) == 0 {
		return errors.New("admin auth config must contain at least one user")
	}

	config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := os.MkdirAll(filepath.Dir(a.authPath), 0o755); err != nil {
		return fmt.Errorf("create admin auth directory: %w", err)
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal admin auth config: %w", err)
	}

	if err := os.WriteFile(a.authPath, append(data, '\n'), 0o600); err != nil {
		return fmt.Errorf("write admin auth config: %w", err)
	}

	return nil
}

// 把email 转成小写字符串
func normalizeAdminEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

// 检查password的长度是否符合要求
func validateAdminPassword(value string) error {
	password := strings.TrimSpace(value)
	if len(password) < 12 {
		return errors.New("new password must be at least 12 characters long")
	}

	if len(password) > 128 {
		return errors.New("new password must be 128 characters or fewer")
	}

	return nil
}

// 管理员密码的加盐哈希（Salted Password Hashing）。它的核心目的是将密码转化为一个不可逆的
// 特征字符串。即使数据库泄露，黑客也无法通过该字符串反推出原始密码。
func hashAdminPassword(password string) (string, error) {
	// 1. 生成随机盐（Salt）
	// 为什么要加盐？ 如果不加盐，相同的密码（如 123456）产生的哈希值永远一样。黑客可以使用“彩虹表”（提前计算好的密码与哈希对照表）瞬间破解。
	// 作用：加入随机盐后，即使两个用户用同样的密码，最终存入数据库的哈希字符串也会完全不同。这强迫黑客必须对每个用户单独进行暴力破解。
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}

	// 2. 派生密钥（Key Derivation）
	// 这里调用了 PBKDF2 (Password-Based Key Derivation Function 2) 算法。它的原理是：将“密码 + 盐”混合后，
	// 进行成千上万次（defaultPBKDF2Iterations）的 SHA256 循环运算。
	// 拉伸（Stretching）：通过循环（比如 100,000 次），人为地增加单次验证密码的计算时间（例如 0.1 秒）。
	// 防爆破：这对正常登录的用户没有影响，但对于每秒尝试数亿次密码的黑客来说，巨大的计算成本会让他们彻底绝望。
	hash := derivePBKDF2SHA256([]byte(password), salt, defaultPBKDF2Iterations, defaultPBKDF2DerivedKeyBytes)
	// 3. 构造存储格式（Formatting）
	// 最终返回的字符串采用了类似 Django 框架的标准存储格式：
	//     算法名称 $ 迭代次数 $ 盐的Base64 $ 哈希值的Base64
	return fmt.Sprintf(
		"pbkdf2_sha256$%d$%s$%s",
		defaultPBKDF2Iterations,
		base64.StdEncoding.EncodeToString(salt),
		base64.StdEncoding.EncodeToString(hash),
	), nil
}

// 解析与比对密码 ：负责把之前存好的那一长串字符串拆解开，并重新计算一遍。
func verifyAdminPassword(encodedHash string, password string) bool {
	// 解析结构：它首先用 $ 分隔字符串。期望的格式是：算法$迭代次数$盐$哈希值。
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		return false
	}

	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations <= 0 {
		return false
	}

	salt, err := base64.StdEncoding.DecodeString(parts[2]) // 用base64解码将文本还原回二进制
	if err != nil || len(salt) == 0 {
		return false
	}

	expectedHash, err := base64.StdEncoding.DecodeString(parts[3]) // 用base64解码将文本还原回二进制
	if err != nil || len(expectedHash) == 0 {
		return false
	}

	// 用用户刚刚输入的明文密码加上提取出来的盐和次数重新算一遍。
	derivedHash := derivePBKDF2SHA256([]byte(password), salt, iterations, len(expectedHash))
	// 安全比对（重点）：  这里没有使用简单的 if a == b。
	// 为什么？ 为了防止计时攻击（Timing Attack）。普通的字符串比较在发现第一个不匹配的字符时就会立即返回，
	// 黑客可以通过测量服务器响应时间的微小差异（纳秒级）来逐位推测出正确的哈希值。ConstantTimeCompare
	// 确保无论密码对错，比较耗费的时间永远相同。
	return subtle.ConstantTimeCompare(derivedHash, expectedHash) == 1
}

// PBKDF2 (Password-Based Key Derivation Function 2) 算法的一个纯 Go 底层实现，配合 SHA-256 哈希算法使用。
// 它的本质是一个“计算拉伸器”：通过成千上万次的循环哈希运算，把一个简单的明文密码转化成一个极难破解的、指定长度的二进制密钥。
func derivePBKDF2SHA256(password []byte, salt []byte, iterations int, keyLength int) []byte {
	// 1. 计算分块（Blocks）
	// PBKDF2 是按“块”生成的。由于 SHA-256 每次只能吐出 32 字节，如果你要求的 keyLength
	// 是 64 字节，算法就会运行两次主循环（生成两个块）。
	const hashLength = 32 // SHA-256 输出是 32 字节

	blockCount := (keyLength + hashLength - 1) / hashLength
	derivedKey := make([]byte, 0, blockCount*hashLength)

	// 2. 外层循环：生成每一个数据块
	for blockIndex := 1; blockIndex <= blockCount; blockIndex++ {
		// 对于每一个块，算法会初始化一个 HMAC 对象：
		// HMAC-SHA256: 使用密码作为密钥，对“盐 + 块索引”进行第一次哈希。
		// binary.BigEndian.PutUint32: 将当前块的序号（1, 2, 3...）转为大端字节序。这是为了保证每一块生成的序列都不一样。
		mac := hmac.New(sha256.New, password)
		mac.Write(salt)

		// 大端字节序 (BigEndian)：严格遵循 RFC 2898 标准，确保在不同架构（如 Intel 或 ARM）的 CPU 上跑出来的结果完全一致。
		var blockCounter [4]byte
		binary.BigEndian.PutUint32(blockCounter[:], uint32(blockIndex))
		mac.Write(blockCounter[:])

		u := mac.Sum(nil)
		t := append([]byte(nil), u...)

		// 3. 内层循环：核心的“迭代拉伸”（The Stretching）
		// 这是整段代码最消耗 CPU 的地方，也是安全性的核心：
		for iteration := 1; iteration < iterations; iteration++ {
			mac = hmac.New(sha256.New, password)
			// 链式反应：它不是简单地对同一个东西哈希一万次，而是把上一次哈希的结果作为下一次哈希的输入。
			mac.Write(u)     // 把上一次的结果 u 作为输入
			u = mac.Sum(nil) // 计算出新的 u

			// 异或运算 (XOR):每一轮产生的 u 都会通过异或运算累加到 t 中。
			// 这种设计是为了增加输出的随机性，并确保每一轮迭代都对最终结果有贡献。
			for index := range t {
				t[index] ^= u[index]
			}
		}

		// 把所有生成的块拼在一起。
		derivedKey = append(derivedKey, t...)
	}
	// 4. 结果截取
	// 如果总长度超过了你要求的 keyLength，就截取前一部分返回。
	return derivedKey[:keyLength]
}

func (a *app) handleAdminAuthStatus(w http.ResponseWriter, r *http.Request) {
	session, err := a.getAdminSessionFromRequest(r)
	if err != nil {
		a.clearAdminSessionCookie(w, r)
		writeJSON(w, http.StatusOK, adminAuthStatusResponse{
			Authenticated: false,
		})
		return
	}

	writeJSON(w, http.StatusOK, adminAuthStatusResponse{
		Authenticated: true,
		User: &adminAuthUserSummary{
			Email: session.Email,
		},
	})
}

// 处理登录的函数：将用户提交的明文凭证与服务器存储的加密哈希进行对比，并在成功后建立会话。
func (a *app) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	// 1. 输入解析与严格校验 (Input Sanitization)
	var input adminLoginInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields() //如果前端传了多余的字段（可能是攻击者在探测参数），后端会直接报错拒绝。
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(w, http.StatusBadRequest, fmt.Errorf("decode login request: %w", err))
		return
	}

	email := normalizeAdminEmail(input.Email)
	if email == "" || strings.TrimSpace(input.Password) == "" {
		writeAPIError(w, http.StatusBadRequest, errors.New("email and password are required"))
		return
	}

	// 2. 读取配置与锁定 (Configuration Access)
	//
	// 并发安全：由于管理员账户信息可能存储在一个 JSON 配置文件中，代码使用互斥锁 (mu)
	// 确保在读取文件时，没有其他线程正在修改它，避免读取到损坏的数据。
	a.mu.Lock()
	config, err := a.readAdminAuthConfig()
	a.mu.Unlock()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	// 3. 匹配用户 (User Lookup)
	var matchedUser *adminAuthUser
	for index := range config.Users {
		if normalizeAdminEmail(config.Users[index].Email) == email {
			matchedUser = &config.Users[index]
			break
		}
	}

	// 4. 核心安全核验 (Security Verification)
	if matchedUser == nil || !verifyAdminPassword(matchedUser.PasswordHash, input.Password) {
		writeAPIError(w, http.StatusUnauthorized, errors.New("invalid email or password"))
		return
	}
	// 5. 创建会话与持久化 (Session Creation & Persistence)
	// createAdminSession：在服务器内存（Map）里生成一个新的 Token，并记录当前管理员的信息及过期时间。
	session, err := a.createAdminSession(matchedUser.Email)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	// setAdminSessionCookie ：将生成的 Token 通过 HTTP Header 写入浏览器的 Cookie。
	a.setAdminSessionCookie(w, r, session)
	// 返回成功：向前端发送成功的 JSON 响应，包含用户简要信息。
	writeJSON(w, http.StatusOK, adminAuthActionResponse{
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
func (a *app) handleAdminLogout(w http.ResponseWriter, r *http.Request) {
	// 获取当前会话。如果存在，调用 a.deleteAdminSession 从内存
	// Map 中删除该 Token。这样即使黑客拿到了旧 Token，服务器也不再识别。
	session, ok := adminSessionFromContext(r)
	if ok {
		a.deleteAdminSession(session.Token)
	}

	// 通知浏览器将 Cookie 的有效期设置为过期，从而物理删除 Cookie。
	a.clearAdminSessionCookie(w, r)
	writeJSON(w, http.StatusOK, adminAuthActionResponse{
		Message: "Logged out successfully",
	})
}

// 处理管理员的修改密码（Change Password） 逻辑
func (a *app) handleAdminChangePassword(w http.ResponseWriter, r *http.Request) {
	// 1.身份核验：通过 adminSessionFromContext 确保当前操作者必须是已登录的管理员。
	session, ok := adminSessionFromContext(r)
	if !ok {
		writeAPIError(w, http.StatusUnauthorized, errors.New("please log in again"))
		return
	}

	// 2.输入解析与校验：
	// 使用 decoder.DisallowUnknownFields() 禁止传入多余字段（防止参数污染攻击）。
	var input adminChangePasswordInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(w, http.StatusBadRequest, fmt.Errorf("decode password request: %w", err))
		return
	}

	if strings.TrimSpace(input.CurrentPassword) == "" {
		writeAPIError(w, http.StatusBadRequest, errors.New("current password is required"))
		return
	}

	// 校验新密码是否符合复杂度要求（validateAdminPassword）。
	if err := validateAdminPassword(input.NewPassword); err != nil {
		writeAPIError(w, http.StatusBadRequest, err)
		return
	}

	// 3.加锁保护：a.mu.Lock() 确保在读取和修改配置文件（如 admin.json）时，不会发生并发冲突。
	a.mu.Lock()
	defer a.mu.Unlock()

	// 4.查找用户：在配置文件中根据 Session 里的 Email 找到对应的用户记录。
	config, err := a.readAdminAuthConfig()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	userIndex := -1
	for index := range config.Users {
		if normalizeAdminEmail(config.Users[index].Email) == normalizeAdminEmail(session.Email) {
			userIndex = index
			break
		}
	}

	if userIndex == -1 {
		writeAPIError(w, http.StatusUnauthorized, errors.New("admin account no longer exists"))
		return
	}

	// 5.旧密码二次验证：这是最关键的安全步骤。即使已经登录，修改密码也必须输入旧密码。
	// 程序通过 verifyAdminPassword（通常是 bcrypt 校验）对比数据库/文件中的哈希值。
	if !verifyAdminPassword(config.Users[userIndex].PasswordHash, input.CurrentPassword) {
		writeAPIError(w, http.StatusUnauthorized, errors.New("current password is incorrect"))
		return
	}

	// 6.持久化更新：
	// 生成新密码的哈希值（ hashAdminPassword ），绝不存储明文。
	// 更新 UpdatedAt 时间，并将整个配置写回文件（ writeAdminAuthConfig ）。
	passwordHash, err := hashAdminPassword(input.NewPassword)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	config.Users[userIndex].PasswordHash = passwordHash
	config.Users[userIndex].UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := a.writeAdminAuthConfig(config); err != nil {
		writeAPIError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, adminAuthActionResponse{
		Message: "Password updated successfully",
		User: &adminAuthUserSummary{
			Email: config.Users[userIndex].Email,
		},
	})
}

// 这个函数 requireAdminSession 在原生 Go 开发中被用作 路由中间件。
// 它的核心作用是：在请求进入真正的业务逻辑（next）之前，强制检查用户是否拥有合法的管理员身份。
func (a *app) requireAdminSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 第一步：身份检查 (The Check)
		// getAdminSessionFromRequest 会去读取 Cookie、查内存 Map、看是否过期。
		//   如果其中任何一个环出错（比如 Token 伪造或已过期），err 就不为空。
		session, err := a.getAdminSessionFromRequest(r)
		// 第二步：拦截与清理 (The Rejection)
		if err != nil {
			a.clearAdminSessionCookie(w, r) // 顺手清理掉浏览器里残留的无效 Cookie
			writeAPIError(w, http.StatusUnauthorized, errors.New("please log in to access the admin console"))
			return // 【关键】直接返回，不再执行后续的 next(w, r)
		}

		// 第三步：注入上下文 (The Injection)
		// 如果检查通过，它会将查到的 session 对象塞进请求的“口袋”（Context）里。
		contextWithSession := context.WithValue(r.Context(), adminSessionContextKey{}, session)

		// 第四步：放行 (The Pass)
		// 它调用 next 函数（即真正的业务逻辑），并将带有 Session 的新 Context 传下去。
		// 这样，后续的业务函数（比如修改密码、上传文件）就能直接从 Context 里拿到当前是谁在操作。
		next(w, r.WithContext(contextWithSession))
	}
}

// 上下文数据提取：这是一个辅助函数，用于从 Go 的 r.Context() 中提取 Session 信息
// 原理：在之前的中间件（Middleware）阶段，程序已经校验了 Cookie 并将解析出的 adminSession 结构体存入了请求的上下文中（Context）。
// 好处：业务逻辑函数（Handler）不需要再关心 Cookie 怎么解析、Token 怎么验证，直接从上下文取“现成”的已通过验证的用户信息即可。
func adminSessionFromContext(r *http.Request) (adminSession, bool) {
	session, ok := r.Context().Value(adminSessionContextKey{}).(adminSession)
	return session, ok
}

// 管理员 Session（会话）校验函数：   从传入的 HTTP 请求中读取 Cookie，提取 Token（令牌），
// 然后在服务器内存中验证该管理员会话是否有效、是否过期，并具备并发安全保护和自动清理过期会话的功能。
func (a *app) getAdminSessionFromRequest(r *http.Request) (adminSession, error) {
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
func (a *app) createAdminSession(email string) (adminSession, error) {
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
func (a *app) deleteAdminSession(token string) {
	if strings.TrimSpace(token) == "" {
		return
	}

	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	delete(a.sessions, token)
}

// 清理过期会话
func (a *app) pruneExpiredAdminSessionsLocked() {
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
func (a *app) setAdminSessionCookie(w http.ResponseWriter, r *http.Request, session adminSession) {
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
func (a *app) clearAdminSessionCookie(w http.ResponseWriter, r *http.Request) {
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
