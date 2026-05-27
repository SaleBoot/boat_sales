package services

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/tencentyun/cos-go-sdk-v5"
)

// Config 结构体，用来统一存放你的全局配置
type CosConfig struct {
	SecretID  string
	SecretKey string
	Region    string
	Bucket    string
}

func GetCosConfig() (*CosConfig, error) {
	// 1. 🌟 关键：加载项目根目录下的 .env 文件
	// 它会自动把文件里的键值对注入到系统的环境变量中
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
		// 这里不直接返回错误，因为在生产环境中我们可能已经通过其他方式设置了环境变量
		// export SALESBOAT_COS_SECRET_ID=your_secret_id
		// export SALESBOAT_COS_SECRET_KEY=your_secret_key
		// export SALESBOAT_COS_REGION=ap-chengdu
		// export SALESBOAT_COS_BUCKET=your_bucket
	}

	// 2. 使用官方 os 库读取已经注入的环境变量
	secretID := os.Getenv("SALESBOAT_COS_SECRET_ID")
	secretKey := os.Getenv("SALESBOAT_COS_SECRET_KEY")
	region := os.Getenv("SALESBOAT_COS_REGION")
	bucket := os.Getenv("SALESBOAT_COS_BUCKET")

	// Clean up potential extra characters from .env file
	bucket = strings.Trim(strings.TrimSpace(bucket), "`")
	region = strings.Trim(strings.TrimSpace(region), "`")
	secretID = strings.Trim(strings.TrimSpace(secretID), "`")
	secretKey = strings.Trim(strings.TrimSpace(secretKey), "`")

	if secretID == "" || secretKey == "" || region == "" || bucket == "" {
		return nil, fmt.Errorf("COS 配置不完整")
	}

	// 3. 使用官方 os 库读取已经注入的环境变量
	config := &CosConfig{
		SecretID:  secretID,
		SecretKey: secretKey,
		Region:    region,
		Bucket:    bucket,
	}

	// 4. 验证是否成功读取（生产环境记得删掉打印，保护密钥安全！）
	fmt.Println("--- 成功读取腾讯云 COS 配置 ---")
	fmt.Printf("Bucket: %s\n", config.Bucket)
	fmt.Printf("Region: %s\n", config.Region)
	fmt.Printf("SecretID: %s\n", config.SecretID)
	// 此时你可以用 config 去初始化你的腾讯云 COS 客户端了...
	return config, nil
}

func GetCosClient(config *CosConfig) (*cos.Client, string, error) {
	if config == nil {
		return nil, "", fmt.Errorf("GetCosClient() config is nil")
	}

	// 拼接 COS 域名
	cosBaseUrlStr := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", config.Bucket, config.Region)
	cosBaseUrl, err := url.Parse(cosBaseUrlStr)
	if err != nil {
		return nil, "", fmt.Errorf("Failed to parse COS base URL: %w", err)
	}

	bucketUrl := &cos.BaseURL{BucketURL: cosBaseUrl}
	client := cos.NewClient(bucketUrl, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  config.SecretID,
			SecretKey: config.SecretKey,
		},
	})

	return client, cosBaseUrlStr, nil
}

func GeneratePresignedURL(objectKey string) (*url.URL, string, error) {

	// 1. 初始化 COS 客户端 (填入你的 SecretId 和 SecretKey，这些安全留在后端)
	config, err := GetCosConfig()
	if err != nil {
		return nil, "", fmt.Errorf("Failed to load COS configuration: %w", err)
	}

	// 2. 获取 COS 客户端实例
	client, cosBaseUrlStr, err := GetCosClient(config)
	if err != nil {
		return nil, "", fmt.Errorf("Failed to get COS client: %w", err)
	}

	// 3. 设置签名限制，🌟 调用关键方法生成对特定文件锁死的临时 URL
	ctx := context.Background()
	method := http.MethodPut   // 前端使用 PUT 方式直传
	expired := 5 * time.Minute // 5分钟有效

	// opt := &cos.ObjectPutOptions{
	// 	ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
	// 		ContentType: "image/jpeg",
	// 	},
	// }

	// ---
	accessUrl := fmt.Sprintf("%s/%s", cosBaseUrlStr, objectKey)

	presignedURL, err := client.Object.GetPresignedURL(ctx, method, objectKey,
		config.SecretID, config.SecretKey, expired, nil)
	if err != nil {
		return nil, "", fmt.Errorf("Failed to generate presigned URL: %w", err)
	}

	return presignedURL, accessUrl, nil
}

func CheckApiParam_originFileName(aOriginFileName string) (string, error) {
	if aOriginFileName == "" {
		return "", fmt.Errorf("参数不完整")
	}

	// 防御：提取纯文件名，防止前端利用 "../" 进行目录穿越攻击
	safeFileName := filepath.Base(aOriginFileName)

	// 提取后缀并限制格式
	ext := strings.ToLower(filepath.Ext(safeFileName))
	if ext != ".fbx" && ext != ".glb" && ext != ".jpeg" && ext != ".jpg" && ext != ".png" {
		return "", fmt.Errorf("file format not supported: %s", ext)
	}
	return safeFileName, nil
}
