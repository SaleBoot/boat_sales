package apis

import (
	"boatsales-backend/internal/services"
	"boatsales-backend/internal/types"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// --- Video Handlers ---
type VideoHandler struct {
	videoSvc *services.VideoService
}

func NewVideoHandler(
	aSvc *services.VideoService,
) (*VideoHandler, error) {
	if aSvc == nil {
		return nil, fmt.Errorf("NewVideoHandler: aSvc cannot be nil")
	}

	err := aSvc.EnsureDefaultVideosExist()
	if err != nil {
		return nil, fmt.Errorf("NewVideoHandler:failed to ensure default boat categories exist: %w", err)
	}

	return &VideoHandler{videoSvc: aSvc}, nil
}

func (aH *VideoHandler) HandleGetVideos(c *gin.Context) {
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

type VideoInput struct {
	Title        string `json:"title"`
	Url          string `json:"url"`
	Introduction string `json:"introduction"`
}

func (aH *VideoHandler) HandleAddVideo(c *gin.Context) {
	log.Println("HandleAddVideo,start")
	defer log.Println("HandleAddVideo,end")

	var input VideoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	err := aH.videoSvc.AddVideo(input.Title, input.Url, input.Introduction)
	if err != nil {
		log.Printf("failed to create video: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to create boat category",
		})
		return
	}

	c.JSON(http.StatusCreated, types.ApiResponse{
		Code:    http.StatusCreated,
		Message: "Successfully created boat category",
		Data:    nil,
	})
}

func (aH *VideoHandler) HandleUpdateVideo(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "invalid video ID",
		})
		return
	}

	var input VideoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	err = aH.videoSvc.UpdateVideo(int(id),
		input.Title, input.Url, input.Introduction)
	if err != nil {
		log.Printf("failed to update video: %v", err)
		c.JSON(http.StatusInternalServerError,
			types.ApiResponse{Code: http.StatusInternalServerError,
				Message: "failed to update video"})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully updated video",
		Data:    nil,
	})
}

type DeleteVideosInput struct {
	IDs []uint `json:"ids"`
}

func (aH *VideoHandler) HandleDeleteVideos(c *gin.Context) {
	var input DeleteVideosInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: fmt.Sprintf("invalid request body: %s", err.Error()),
		})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, types.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: "category IDs are required",
		})
		return
	}

	if err := aH.videoSvc.DeleteVideos(input.IDs); err != nil {
		log.Printf("failed to delete videos: %v", err)
		c.JSON(http.StatusInternalServerError, types.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: "failed to delete videos",
		})
		return
	}

	c.JSON(http.StatusOK, types.ApiResponse{
		Code:    http.StatusOK,
		Message: "Successfully deleted videos",
	})
}
