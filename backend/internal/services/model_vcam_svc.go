package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"context"
	"fmt"
)

type ModelVCamService struct {
	modelVCamDao *dao.SysModelVCamDao
}

func NewModelVCamService(
	aDao *dao.SysModelVCamDao,
) (*ModelVCamService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("SysModelVCamDao is nil")
	}

	svc := &ModelVCamService{modelVCamDao: aDao}

	// err := svc.TmpInitModelVCamTable()
	// if err != nil {
	// 	log.Fatalln("TmpInitModelVCamTable failed:", err)
	// 	return nil, err
	// }

	return svc, nil // 依赖注入
}

func (aS *ModelVCamService) AddModelVCams(
	aCtx context.Context,
	aModelVCam []*models.SysModelVCam,
) error {
	if err := aS.modelVCamDao.AddModelVCams(aCtx, aModelVCam); err != nil {
		return err
	}
	return nil
}
