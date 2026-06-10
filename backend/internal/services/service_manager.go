package services

import "boatsales-backend/internal/db/dao"

type ServiceManager struct {
	BoatCategorySvc *BoatCategoryService
	BoatSvc         *BoatService
	CosPathSvc      *CosPathService
	BoatModelSvc    *BoatModelService
	ModelVCamSvc    *ModelVCamService
	VideoSvc        *VideoService
}

func NewServiceManager(
	aBoatCategoryDao *dao.SysBoatCategoryDao,
	aBoatDao *dao.SysBoatDao,
	aCosPathDao *dao.SysCosPathDao,
	aBoatModelDao *dao.SysBoatModelDao,
	aModelVCamDao *dao.SysModelVCamDao,
	aVideoDao *dao.SysVideoDao,
) (*ServiceManager, error) {
	boatCategorySvc, err := NewBoatCategoryService(aBoatCategoryDao)
	if err != nil {
		return nil, err
	}
	boatSvc, err := NewBoatService(aBoatDao, aBoatModelDao)
	if err != nil {
		return nil, err
	}

	cosPathSvc, err := NewCosPathSyncerService(aCosPathDao)
	if err != nil {
		return nil, err
	}

	boatModelSvc, err := NewBoatModelService(aBoatModelDao)
	if err != nil {
		return nil, err
	}

	modelVCamSvc, err := NewModelVCamService(aModelVCamDao)
	if err != nil {
		return nil, err
	}

	videoSvc, err := NewVideoService(aVideoDao)
	if err != nil {
		return nil, err
	}

	// 这里可以添加一些初始化逻辑，比如确保默认用户存在等
	adminM := &ServiceManager{
		BoatCategorySvc: boatCategorySvc,
		BoatSvc:         boatSvc,
		CosPathSvc:      cosPathSvc,
		BoatModelSvc:    boatModelSvc,
		ModelVCamSvc:    modelVCamSvc,
		VideoSvc:        videoSvc,
	}

	return adminM, nil
}
