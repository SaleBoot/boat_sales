package v1

import (
	"github.com/gin-gonic/gin"
)

func writeAPIError(c *gin.Context, status int, err error) {
	c.JSON(status, map[string]string{
		"error": err.Error(),
	})
}
