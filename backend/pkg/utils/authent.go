package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
)

const (
	defaultPBKDF2Iterations      = 210000
	defaultPBKDF2DerivedKeyBytes = 32
)

// 把email 转成小写字符串
func NormalizeAdminEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

// 检查password的长度是否符合要求
func ValidateAdminPassword(value string) error {
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
func HashAdminPassword(password string) (string, error) {
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
	hash := derivePBKDF2SHA256([]byte(password), salt,
		defaultPBKDF2Iterations,
		defaultPBKDF2DerivedKeyBytes)
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

// PBKDF2 (Password-Based Key Derivation Function 2) 算法的一个纯 Go 底层实现，配合 SHA-256 哈希算法使用。
// 它的本质是一个“计算拉伸器”：通过成千上万次的循环哈希运算，把一个简单的明文密码转化成一个极难破解的、指定长度的二进制密钥。
func derivePBKDF2SHA256(password []byte,
	salt []byte,
	iterations int,
	keyLength int) []byte {
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

// 解析与比对密码 ：负责把之前存好的那一长串字符串拆解开，并重新计算一遍。
func VerifyAdminPassword(encodedHash string, password string) bool {
	log.Printf("VerifyAdminPassword 0")
	// 解析结构：它首先用 $ 分隔字符串。期望的格式是：算法$迭代次数$盐$哈希值。
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		log.Printf("VerifyAdminPassword 1")
		return false
	}

	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations <= 0 {
		log.Printf("VerifyAdminPassword 2")
		return false
	}

	salt, err := base64.StdEncoding.DecodeString(parts[2]) // 用base64解码将文本还原回二进制
	if err != nil || len(salt) == 0 {
		log.Printf("VerifyAdminPassword 3")
		return false
	}

	expectedHash, err := base64.StdEncoding.DecodeString(parts[3]) // 用base64解码将文本还原回二进制
	if err != nil || len(expectedHash) == 0 {
		log.Printf("VerifyAdminPassword 4")
		return false
	}
	log.Printf("VerifyAdminPassword 5")
	// 用用户刚刚输入的明文密码加上提取出来的盐和次数重新算一遍。
	derivedHash := derivePBKDF2SHA256([]byte(password), salt,
		iterations,
		len(expectedHash))
	// 安全比对（重点）：  这里没有使用简单的 if a == b。
	// 为什么？ 为了防止计时攻击（Timing Attack）。普通的字符串比较在发现第一个不匹配的字符时就会立即返回，
	// 黑客可以通过测量服务器响应时间的微小差异（纳秒级）来逐位推测出正确的哈希值。ConstantTimeCompare
	// 确保无论密码对错，比较耗费的时间永远相同。
	return subtle.ConstantTimeCompare(derivedHash, expectedHash) == 1
}
