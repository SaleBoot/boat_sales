package utils

import (
	"os"

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
