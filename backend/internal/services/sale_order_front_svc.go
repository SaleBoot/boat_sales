package services

import (
	"boatsales-backend/internal/db/models"
	"context"
)

func (aS *SalesOrderService) AddSaleOrder(
	aCtx context.Context,
	aOrder *models.SalesOrder,
) error {
	if err := aS.saleOrderDao.AddSaleOrder(aOrder); err != nil {
		return err
	}
	return nil
}
