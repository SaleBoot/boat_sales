package utils

import (
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
)

func IsDirectory(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	return info.IsDir()
}
func WriteAPIError(c *gin.Context, status int, err error) {
	c.JSON(status, map[string]string{
		"error": err.Error(),
	})
}

// GetPage extracts the 'page' query parameter from gin.Context, with a default of 1.
func GetPage(c *gin.Context) int {
	pageStr := c.DefaultQuery("page", "1")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		return 1
	}
	return page
}

// GetPageSize extracts the 'pageSize' query parameter from gin.Context, with a default of 10.
func GetPageSize(c *gin.Context) int {
	pageSizeStr := c.DefaultQuery("pageSize", "10")
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 {
		return 10
	}
	return pageSize
}
