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

// modelsCosRootPrefix 定义了在COS中存放模型文件的根路径。
// 这是一个包内私有变量，外部请通过 GetModelsCosRootPrefix() 函数获取。
var modelsCosRootPrefix = "gltf01/"

// GetModelsCosRootPrefix 返回在COS中存放模型文件的根路径。
// 使用函数而不是直接暴露变量，可以更好地封装内部实现，方便未来扩展。
func GetModelsCosRootPrefix() string {
	return modelsCosRootPrefix
}

// Config 结构体，用来统一存放你的全局配置
type CosConfig struct {
	SecretID  string
	SecretKey string
	Region    string
	Bucket    string
}

func getCosConfig() (*CosConfig, error) {
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

func getCosClient(config *CosConfig) (*cos.Client, string, error) {
	if config == nil {
		return nil, "", fmt.Errorf("getCosClient() config is nil")
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
	config, err := getCosConfig()
	if err != nil {
		return nil, "", fmt.Errorf("Failed to load COS configuration: %w", err)
	}

	// 2. 获取 COS 客户端实例
	client, cosBaseUrlStr, err := getCosClient(config)
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
	aOriginFileName = strings.TrimSpace(aOriginFileName)
	if aOriginFileName == "" {
		return "", fmt.Errorf("参数不完整")
	}

	// 防御：提取纯文件名，防止前端利用 "../" 进行目录穿越攻击
	safeFileName := filepath.Base(aOriginFileName)

	// 检查文件类型
	ext := strings.ToLower(filepath.Ext(safeFileName))
	allowedExts := map[string]bool{
		".fbx":  true,
		".glb":  true,
		".jpg":  true,
		".png":  true,
		".jpeg": true,
		".zip":  true,
	}

	if !allowedExts[ext] {
		return "", fmt.Errorf("file format not supported: %s", ext)
	}

	return safeFileName, nil
}

// ----------------------------------------

type FileInfo struct {
	Key  string `json:"key"`
	Size int64  `json:"size"`
	// ETag string `json:"etag"`
}

func ListCosFiles(prefix string) ([]FileInfo, error) {

	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return nil, fmt.Errorf("参数 is empty")
	}

	// 1. 初始化 COS 客户端 (填入你的 SecretId 和 SecretKey，这些安全留在后端)
	config, err := getCosConfig()
	if err != nil {
		return nil, fmt.Errorf("Failed to load COS configuration: %w", err)
	}

	// 2. 获取 COS 客户端实例
	client, _, err := getCosClient(config)
	if err != nil {
		return nil, fmt.Errorf("Failed to get COS client: %w", err)
	}

	// 列出目录下所有文件（递归）
	var files []FileInfo
	ctx := context.Background()
	opt := &cos.BucketGetOptions{
		Prefix:  prefix,
		MaxKeys: 1000,
	}

	for {
		result, _, err := client.Bucket.Get(ctx, opt)
		if err != nil {
			return nil, err
		}

		for _, obj := range result.Contents {
			files = append(files, FileInfo{
				Key:  obj.Key,
				Size: obj.Size,
				// ETag: strings.Trim(obj.ETag, "\""),
			})
		}

		if !result.IsTruncated {
			break
		}

		opt.Marker = result.NextMarker
	}

	return files, nil
}

// 获取子目录列表
func ListCosSubDirectories(aPrefix string) ([]string, error) {
	aPrefix = strings.TrimSpace(aPrefix)
	if aPrefix == "" {
		return nil, fmt.Errorf("参数 is empty")
	}

	// 1. 初始化 COS 客户端 (填入你的 SecretId 和 SecretKey，这些安全留在后端)
	config, err := getCosConfig()
	if err != nil {
		return nil, fmt.Errorf("Failed to load COS configuration: %w", err)
	}

	// 2. 获取 COS 客户端实例
	client, _, err := getCosClient(config)
	if err != nil {
		return nil, fmt.Errorf("Failed to get COS client: %w", err)
	}

	var subDirs []string
	ctx := context.Background()

	// 确保前缀以 / 结尾
	if !strings.HasSuffix(aPrefix, "/") {
		aPrefix += "/"
	}

	opt := &cos.BucketGetOptions{
		Prefix:    aPrefix,
		Delimiter: "/", // 关键：设置分隔符
		MaxKeys:   1000,
	}

	for {
		result, _, err := client.Bucket.Get(ctx, opt)
		if err != nil {
			return nil, err
		}

		// CommonPrefixes 就是子目录
		for _, cp := range result.CommonPrefixes {
			// 去掉前缀，只返回目录名
			dirName := strings.TrimPrefix(cp, aPrefix)
			// 去掉末尾的 /
			dirName = strings.TrimSuffix(dirName, "/")
			if dirName != "" {
				subDirs = append(subDirs, dirName)
			}
		}

		if !result.IsTruncated {
			break
		}

		opt.Marker = result.NextMarker
	}

	return subDirs, nil
}

// 目录节点结构
type DirectoryNode struct {
	Name     string           `json:"name"`
	Path     string           `json:"path"`
	Children []*DirectoryNode `json:"children,omitempty"`
}

// 获取目录树（递归）
func ListDirectoryTree(prefix string) (*DirectoryNode, error) {
	node := &DirectoryNode{
		Name:     getDirName(prefix),
		Path:     prefix,
		Children: []*DirectoryNode{},
	}

	// 获取当前目录下的子目录
	subDirs, err := ListCosSubDirectories(prefix)
	if err != nil {
		return nil, err
	}

	// 递归获取每个子目录
	for _, subDir := range subDirs {
		subPrefix := prefix + subDir + "/"
		childNode, err := ListDirectoryTree(subPrefix)
		if err != nil {
			return nil, err
		}
		node.Children = append(node.Children, childNode)
	}

	return node, nil
}

// 获取目录名
func getDirName(path string) string {
	// 去掉末尾的 /
	path = strings.TrimSuffix(path, "/")
	// 获取最后一段
	parts := strings.Split(path, "/")
	return parts[len(parts)-1]
}
