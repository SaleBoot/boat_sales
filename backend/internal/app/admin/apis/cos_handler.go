package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type CosHandler struct {
	cosPathSyncSvc *services.CosPathService
}

func NewCosHandler(aCosPathSyncSvc *services.CosPathService,
	aMustSyncCosDirTree bool,
) (*CosHandler, error) {
	if aCosPathSyncSvc == nil {
		return nil, fmt.Errorf("NewCosHandler: aCosPathSyncSvc cannot be nil")
	}

	if aMustSyncCosDirTree {
		_, err := aCosPathSyncSvc.SyncCosDirTree(context.Background())
		if err != nil {
			log.Printf("NewCosHandler():Error syncing cos dir tree: %v", err)
		}
	}

	return &CosHandler{cosPathSyncSvc: aCosPathSyncSvc}, nil
}

type BoatModelsOverview struct {
	ModelCount    int     `json:"modelCount"`
	FileCount     int     `json:"fileCount"`
	TotalSizeInMB float64 `json:"totalSizeInMB"`
}

func (aH *CosHandler) HandleGetModelsOverview(c *gin.Context) {
	modelFolders, err := aH.cosPathSyncSvc.GetAllModelFoldersWithFiles(c.Request.Context())
	if err != nil {
		log.Printf("HandleGetModelsOverview():Error getting all model folders with files: %+v",
			err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("获取所有模型文件夹失败: %+v", err),
		})
		return
	}

	fileCount := 0
	for _, files := range modelFolders {
		fileCount += len(files)
	}

	totalSize := aH.cosPathSyncSvc.GetFilesTotalSize(c.Request.Context())

	overview := BoatModelsOverview{
		ModelCount:    len(modelFolders),
		FileCount:     fileCount,
		TotalSizeInMB: float64(totalSize) / 1024 / 1024,
	}
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "获取COS模型概览成功",
		Data:    overview,
	})
}

func (h *CosHandler) HandleSyncCosDirTree(c *gin.Context) {
	syncCount, err := h.cosPathSyncSvc.SyncCosDirTree(c.Request.Context())
	if err != nil {
		log.Printf("HandleSyncCosDirTree():Error syncing cos dir tree: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("同步COS目录树失败: %v", err),
		})
		return
	}

	log.Printf("HandleSyncCosDirTree():COS目录树同步完成，共处理%d个节点", syncCount)

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "COS目录树同步完成",
		Data: gin.H{
			"totalNodes": syncCount,
		},
	})
}

// HandleGetCosURL 处理生成腾讯云 COS 预签名 URL 的请求，前端可以
// 使用这个 URL 直接上传文件到 COS，而不需要经过后端服务器转发。
func (h *CosHandler) HandleGetCosURL4SingleFile(c *gin.Context) {
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
	objectKey := fmt.Sprintf("%s%s/%s", services.GetModelsCosRootPrefix(), modelName, safeFileName)
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

// HandleGetSubFiles 根据前端提供的路径，获取其下一层的所有子节点（文件和目录）
func (h *CosHandler) HandleGetSubFiles(c *gin.Context) {
	var req ListFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "缺少必填的prefix参数",
			Data:    nil,
		})
		return
	}

	req.Prefix = strings.TrimSpace(req.Prefix)
	if req.Prefix == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "prefix参数不能为空",
			Data:    nil,
		})
		return
	}

	// 安全检查：防止目录穿越攻击
	if strings.Contains(req.Prefix, "..") {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "非法的路径参数",
			Data:    nil,
		})
		return
	}

	// 安全检查：确保只能访问允许的根目录
	// 通过 strings.TrimPrefix 临时移除路径开头的'/'，使其能正确匹配不带'/'的根路径常量
	if !strings.HasPrefix(strings.TrimPrefix(req.Prefix, "/"), services.GetModelsCosRootPrefix()) &&
		req.Prefix != "/" && req.Prefix != "" {
		c.JSON(http.StatusForbidden, types.ApiResponse{
			Code:    http.StatusForbidden,
			Message: "无权访问该路径",
			Data:    nil,
		})
		return
	}

	// 确保前缀以 / 结尾
	if !strings.HasSuffix(req.Prefix, "/") {
		req.Prefix += "/"
	}

	dbNodes, err := h.cosPathSyncSvc.GetSubFiles(c.Request.Context(), req.Prefix)
	if err != nil {
		log.Printf("HandleGetSubFiles():Error getting sub files for prefix '%s': %+v",
			req.Prefix, err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("获取文件列表失败: %v", err),
				Data:    nil,
			})
		return
	}

	// 将models.CosPathMeta转换为services.FileInfo，保持响应格式不变
	var fileInfos []services.FileInfo
	for _, node := range dbNodes {
		fileInfo := services.FileInfo{
			Key:  node.Path,
			Size: node.Size,
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	log.Printf("HandleGetSubFiles():Successfully listed %d files for prefix '%s'",
		len(fileInfos), req.Prefix)
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "获取文件列表成功",
		Data: ListFilesResponse{
			Files: fileInfos,
			Total: len(fileInfos),
		},
	})
}

// HandleGetAllDescendantFiles 根据前端提供的路径，递归获取其所有后代文件节点
func (h *CosHandler) HandleGetAllDescendantFiles(c *gin.Context) {
	var req ListFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "缺少必填的prefix参数",
			Data:    nil,
		})
		return
	}

	req.Prefix = strings.TrimSpace(req.Prefix)
	if req.Prefix == "" {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "prefix参数不能为空",
			Data:    nil,
		})
		return
	}

	// 安全检查：防止目录穿越攻击
	if strings.Contains(req.Prefix, "..") {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "非法的路径参数",
			Data:    nil,
		})
		return
	}

	// 安全检查：确保只能访问允许的根目录
	// 通过 strings.TrimPrefix 临时移除路径开头的'/'，使其能正确匹配不带'/'的根路径常量
	if !strings.HasPrefix(strings.TrimPrefix(req.Prefix, "/"), services.GetModelsCosRootPrefix()) &&
		req.Prefix != "/" && req.Prefix != "" {
		c.JSON(http.StatusForbidden, types.ApiResponse{
			Code:    http.StatusForbidden,
			Message: "无权访问该路径",
			Data:    nil,
		})
		return
	}

	// 确保前缀以 / 结尾
	if !strings.HasSuffix(req.Prefix, "/") {
		req.Prefix += "/"
	}

	dbNodes, err := h.cosPathSyncSvc.GetAllDescendantFiles(c.Request.Context(), req.Prefix)
	if err != nil {
		log.Printf("HandleGetAllDescendantFiles(): Error getting descendant files for prefix '%s': %v", req.Prefix, err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("获取文件列表失败: %v", err),
				Data:    nil,
			})
		return
	}

	// 将models.CosPathMeta转换为services.FileInfo，保持响应格式不变
	var fileInfos []services.FileInfo
	for _, node := range dbNodes {
		fileInfo := services.FileInfo{
			Key:  node.Path,
			Size: node.Size,
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	log.Printf("HandleGetAllDescendantFiles(): Successfully listed %d descendant files for prefix '%s'",
		len(fileInfos), req.Prefix)
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "获取文件列表成功",
		Data: ListFilesResponse{
			Files: fileInfos,
			Total: len(fileInfos),
		},
	})
}

// 请求参数
type ListDirectoriesRequest struct {
	Prefix string `form:"prefix" binding:"required"`
}

// 响应结构
type ListModelFoldersResponse struct {
	ModelFolders []ModelFolder `json:"modelFolders"`
	Total        int           `json:"total"`
}

type ModelFolder struct {
	ModelFolderName string   `json:"modelFolderName"` // 模型文件夹，内含多个样式模型文件夹
	DescendantFiles []string `json:"descendantFiles"`
}

func (h *CosHandler) HandleGetAllModelPaths(c *gin.Context) {
	modelFolders, err := h.cosPathSyncSvc.GetAllModelFoldersWithFiles(c.Request.Context())
	if err != nil {
		log.Printf("HandleGetAllModelPaths(): Error getting all model folders with files: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("获取模型列表失败: %v", err),
				Data:    nil,
			})
		return
	}

	response := ListModelFoldersResponse{
		ModelFolders: make([]ModelFolder, 0, len(modelFolders)),
		Total:        len(modelFolders),
	}

	for folderName, files := range modelFolders {
		response.ModelFolders = append(response.ModelFolders, ModelFolder{
			ModelFolderName: folderName,
			DescendantFiles: files,
		})
	}

	log.Printf("HandleGetAllModelPaths(): Successfully listed %d model folders", len(modelFolders))
	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "获取模型列表成功",
		Data:    response,
	})
}

// 获取目录树-note: 这个接口目前没有被前端调用，先保留在这里备用
func (h *CosHandler) HandleListDirTree(c *gin.Context) {
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
