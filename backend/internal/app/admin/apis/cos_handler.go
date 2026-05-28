package apis

import (
	"boatsales-backend/internal/app/admin/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// HandleGetCosURL 处理生成腾讯云 COS 预签名 URL 的请求，前端可以
// 使用这个 URL 直接上传文件到 COS，而不需要经过后端服务器转发。
func HandleGetCosURL4SingleFile(c *gin.Context) {
	// 1. 前端只允许传纯粹的文件名或特定业务ID，不允许传带有复杂路径的斜杠
	modelName := c.Query("modelName") // 比如: "102"
	originName := c.Query("fileName") // 比如: "tbrender.png"

	modelName = strings.TrimSpace(modelName)
	originName = strings.TrimSpace(originName)
	// 后端进行严格的合法性检查
	if modelName == "" || originName == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "参数不完整",
			Data:    nil,
		})
		return
	}

	// 防御：提取纯文件名，防止前端利用 "../" 进行目录穿越攻击
	safeFileName, err := services.CheckApiParam_originFileName(originName)
	if err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: err.Error(),
			Data:    nil,
		})
		return
	}

	//  🌟 由后端牢牢掌控并拼接“相对路径”！
	// 这样就死死限制了前端只能把文件传到指定的船舶目录里
	objectKey := fmt.Sprintf("gltf01/%s/%s", modelName, safeFileName)
	presignedURL, accessUrl, err := services.GeneratePresignedURL(objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
			Data:    nil,
		})
		return
	}

	log.Printf("Generated presigned URL for accessUrl '%s': %s", presignedURL.String(), accessUrl)
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Presigned URL generated successfully",
		Data: gin.H{
			"uploadUrl": presignedURL.String(),
			"accessUrl": accessUrl,
			"finalKey":  objectKey, // 把后端决定的相对路径也给前端，方便前端记录
		},
	})
}

// 请求参数
type ListFilesRequest struct {
	Prefix string `form:"prefix" binding:"required"`
}

// 响应结构
type ListFilesResponse struct {
	Files []services.FileInfo `json:"files"`
	Total int                 `json:"total"`
}

func HandleListFiles(c *gin.Context) {
	var req ListFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusOK,
			Message: "HandleListFiles():no prefix parameter",
			Data:    nil,
		})
		return
	}

	req.Prefix = strings.TrimSpace(req.Prefix)
	if req.Prefix == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "HandleListFiles():prefix 参数不能为空",
			Data:    nil,
		})
		return
	}

	// 确保前缀以 / 结尾
	if !strings.HasSuffix(req.Prefix, "/") {
		req.Prefix += "/"
	}

	files, err := services.ListCosFiles(req.Prefix)
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: "HandleListFiles():获取 Cos files 列表失败",
				Data:    nil,
			})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "HandleListFiles(): get Cos files list successfully",
		Data: ListFilesResponse{
			Files: files,
			Total: len(files),
		},
	})
}

// 请求参数
type ListDirectoriesRequest struct {
	Prefix string `form:"prefix" binding:"required"`
}

// 响应结构
type ListDirectoriesResponse struct {
	Directories []string `json:"directories"`
	Total       int      `json:"total"`
}

// 获取模型路径列表
func HandleListAllModelPaths(c *gin.Context) {
	prefix := "gltf/" // 这里直接写死了模型的根目录，前端只能列这个目录下的内容，不能越界访问其他目录

	subDirs, err := services.ListCosSubDirectories(prefix)
	if err != nil {
		log.Printf("HandleListModelPaths():Error listing sub directories: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "获取模型路径失败",
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "get 模型路径 list successfully",
		Data: ListDirectoriesResponse{
			Directories: subDirs,
			Total:       len(subDirs),
		},
	})
}

// 获取目录树
func HandleListDirTree(c *gin.Context) {
	var req ListDirectoriesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		log.Printf("HandleListDirTree():Error binding query parameters: %v", err)
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "缺少 prefix 参数",
			Data:    nil,
		})
		return
	}

	req.Prefix = strings.TrimSpace(req.Prefix)
	if req.Prefix == "" {
		log.Printf("HandleListDirTree():prefix 参数不能为空")
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "HandleListDirTree():prefix 参数不能为空",
			Data:    nil,
		})
		return
	}

	// 确保前缀以 / 结尾
	if !strings.HasSuffix(req.Prefix, "/") {
		req.Prefix += "/"
	}

	tree, err := services.ListDirectoryTree(req.Prefix)
	if err != nil {
		log.Printf("HandleListDirTree():Error listing directory tree: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取目录树失败"})
		return
	}

	c.JSON(http.StatusOK, tree)
}
