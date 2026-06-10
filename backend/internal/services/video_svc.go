package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"fmt"
	"log"
)

// --- Video Handlers ---
type VideoService struct {
	videoDao *dao.SysVideoDao
}

func NewVideoService(aDao *dao.SysVideoDao,
) (*VideoService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("NewVideoService: aDao cannot be nil")
	}

	return &VideoService{videoDao: aDao}, nil
}

// EnsureDefaultBoatCategoriesExist checks if default boat categories exist in the database,
// and if not, it seeds the database with a predefined list of categories.
func (aS *VideoService) EnsureDefaultVideosExist() error {
	count, err := aS.videoDao.Count()
	if err != nil {
		return err
	}

	// If videos already exist, do nothing.
	if count > 0 {
		return nil
	}

	log.Println("No videos found, seeding database with default videos...")

	initialData := []models.SysVideo{
		{
			Title:        "智能消防艇全景演示",
			Url:          "https://www.bilibili.com/video/BV1jV4y1L7Uq/",
			Introduction: "展示了最新款智能消防艇的360度操作演示和水炮测试。",
		},
		{
			Title:        "Bilibili-船舶制造全过程",
			Url:          "https://www.bilibili.com/video/BV1cu411G7cs",
			Introduction: "从第一块钢板到下水仪式的完整记录。",
		},
	}

	// it is not necessary to use transaction because initial stage
	for _, video := range initialData {
		if err := aS.videoDao.AddVideo(&video); err != nil {
			log.Printf("failed to create default video '%s': %v", video.Title, err)
			// Decide if you want to stop on first error or continue
			return err
		}
	}

	log.Println("Successfully seeded default boat categories.")
	return nil
}

func (aS *VideoService) GetVideos() ([]models.SysVideo, error) {

	videos, err := aS.videoDao.GetAllVideos()
	if err != nil {
		log.Printf("failed to get videos: %v", err)
		return nil, err
	}

	return videos, nil
}

func (aS *VideoService) AddVideo(
	aTitle string,
	aUrl string,
	aIntroduction string,
) error {
	log.Println("AddVideo,start")
	defer log.Println("AddVideo,end")

	video := models.SysVideo{
		Title:        aTitle,
		Url:          aUrl,
		Introduction: aIntroduction,
	}

	if err := aS.videoDao.AddVideo(&video); err != nil {
		log.Printf("failed to create video: %v", err)
		return fmt.Errorf("failed to create video: %w", err)
	}

	return nil
}

func (aH *VideoService) UpdateVideo(
	aVideoIntId int,
	aTitle string,
	aUrl string,
	aIntroduction string,
) error {
	log.Printf("UpdateVideo: Attempting to update video with ID: %d, new Title: %s, Url: %s, Introduction: %s",
		aVideoIntId, aTitle, aUrl, aIntroduction)

	video := models.SysVideo{
		Title:        aTitle,
		Url:          aUrl,
		Introduction: aIntroduction,
	}
	video.ID = uint(aVideoIntId)

	if err := aH.videoDao.UpdateVideo(video.ID, &video); err != nil {
		log.Printf("UpdateVideo: failed to update video (ID: %d): %v", video.ID, err)
		return fmt.Errorf("failed to update video: %w", err)
	}

	log.Printf("UpdateVideo: Successfully updated video with ID: %d", video.ID)
	return nil
}

func (aH *VideoService) DeleteVideos(aIDs []uint) error {
	if len(aIDs) == 0 {
		return fmt.Errorf("video IDs are required")
	}
	if err := aH.videoDao.DeleteVideos(aIDs); err != nil {
		log.Printf("failed to delete videos: %v", err)
		return fmt.Errorf("failed to delete videos: %w", err)
	}

	return nil
}
