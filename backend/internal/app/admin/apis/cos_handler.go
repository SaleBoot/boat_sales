package apis

import (
	"boatsales-backend/internal/app/admin/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// HandleGetCosURL 处理生成腾讯云 COS 预签名 URL 的请求，前端可以
// 使用这个 URL 直接上传文件到 COS，而不需要经过后端服务器转发。
func HandleGetCosURL4SingleFile(c *gin.Context) {
	// 1. 前端只允许传纯粹的文件名或特定业务ID，不允许传带有复杂路径的斜杠
	modelName := c.Query("modelName") // 比如: "102"
	originName := c.Query("fileName") // 比如: "tbrender.png"

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
