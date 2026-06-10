package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	log "log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// --- Video Handlers ---
type VideoFrontHandler struct {
	videoSvc *services.VideoService
}

func NewVideoFrontHandler(
	aSvc *services.VideoService,
) (*VideoFrontHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewVideoFrontHandler: aSvc cannot be nil")
	}

	return &VideoFrontHandler{videoSvc: aSvc}, nil
}

func (aH *VideoFrontHandler) HandleGetVideos(c *gin.Context) {
	videos, err := aH.videoSvc.GetVideos()
	if err != nil {
		log.Printf("failed to get videos: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to retrieve videos",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully retrieved videos",
		Data:    videos,
	})
}
