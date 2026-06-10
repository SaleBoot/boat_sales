package front

import (
	"boatsales-backend/internal/app/front/apis"
	"boatsales-backend/internal/services"
	"fmt"

	"github.com/gin-gonic/gin"
)

type FrontModule struct {
	// boatCategoryH *apis.FrontBoatCategoryHandler
	// boatH         *apis.FrontBoatHandler
	boatModelFH *apis.BoatModelFrontHandler
	vcamFH      *apis.ModelVCamFrontHandler
	videoFH     *apis.VideoFrontHandler
}

func NewFrontModule(
	aBoatCategorySvc *services.BoatCategoryService, // 依赖注入
	aBoatSvc *services.BoatService, // 依赖注入
	aCosPathSvc *services.CosPathService, // 依赖注入
	aBoatModelSvc *services.BoatModelService, // 依赖注入
	aModelVCamSvc *services.ModelVCamService, // 依赖注入
	aVideoSvc *services.VideoService, // 依赖注入
) (*FrontModule, error) {

	// bcH, err := apis.NewBoatCategoryHandler(aBoatCategorySvc)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to NewBoatCategoryHandler: %w", err)
	// }

	// cosHTmp, err := apis.NewCosHandler(aCosPathSyncSvc)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to NewCosHandler: %w", err)
	// }

	// bH, err := apis.NewBoatHandler(aBoatSvc)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to NewBoatHandler: %w", err)
	// }

	bmFH, err := apis.NewBoatModelFrontHandler(aBoatCategorySvc,
		aCosPathSvc, aBoatSvc, aBoatModelSvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewBoatModelFrontHandler: %w", err)
	}

	vcamFH, err := apis.NewModelVCamFrontHandler(aCosPathSvc, aModelVCamSvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewModelVCamFrontHandler: %w", err)
	}

	videoFH, err := apis.NewVideoFrontHandler(aVideoSvc)
	if err != nil {
		return nil, fmt.Errorf("failed to NewVideoFrontHandler: %w", err)
	}

	// 这里可以添加一些初始化逻辑，比如确保默认用户存在等
	frontM := &FrontModule{
		boatModelFH: bmFH,    // 依赖注入
		vcamFH:      vcamFH,  // 依赖注入
		videoFH:     videoFH, // 依赖注入
	}

	return frontM, nil
}

func (a *FrontModule) RegisterRoutes(aApiRG *gin.RouterGroup) {

	fontRG := aApiRG.Group("/front")
	{
		// fontRG.GET("/boat-categories", a.boatModelFH.HandleGetBoatCategories)
		// fontRG.GET("/boats", a.boatModelFH.HandleGetBoats)

		// cosRG := fontRG.Group("/cos")
		// {
		// 	cosRG.GET("/presigned-url", a.cosH.HandleGetCosURL4SingleFile)     // 获取 COS 预签名 URL 的接口
		// 	cosRG.GET("/model-paths", a.cosH.HandleGetAllModelPaths)           // 列出模型路径的接口
		// 	cosRG.GET("/subfiles", a.cosH.HandleGetSubFiles)                   // 列出 COS 文件的接口
		// 	cosRG.GET("/descendant-files", a.cosH.HandleGetAllDescendantFiles) // 递归列出所有后代文件的接口
		// 	cosRG.GET("/tree", a.cosH.HandleListDirTree)
		// }
		// 全路径 /api/front/boat-models
		fontRG.GET("/boat-models", a.boatModelFH.HandleGetModels)
		// 全路径 /api/front/vcams/*modelPath
		fontRG.GET("/vcams/*modelPath", a.vcamFH.HandleGetVCamsByModelPath)
		// 全路径 /api/front/videos
		fontRG.GET("/videos", a.videoFH.HandleGetVideos)
	}

}
