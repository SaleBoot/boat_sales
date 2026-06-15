package dao

import (
	"boatsales-backend/internal/db/models"
	"errors"
	"strings"

	"gorm.io/gorm"
)

type SalesOrderDao struct {
	DB *gorm.DB
}

func NewSalesOrderDao(db *gorm.DB) *SalesOrderDao {
	return &SalesOrderDao{DB: db}
}

// GetAllSaleOrders retrieves all sale orders with pagination.
func (d *SalesOrderDao) GetAllSaleOrders(page,
	pageSize int,
) ([]models.SalesOrder, int64, error) {
	var orders []models.SalesOrder
	var total int64

	// Count total records
	if err := d.DB.Model(&models.SalesOrder{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	offset := (page - 1) * pageSize
	result := d.DB.Offset(offset).Limit(pageSize).Find(&orders)

	return orders, total, result.Error
}

func (d *SalesOrderDao) GetSaleOrdersByCustomerContact(
	aCustomerContact string,
) ([]models.SalesOrder, error) {
	customerContact := strings.TrimSpace(aCustomerContact)
	if customerContact == "" {
		return []models.SalesOrder{}, errors.New("customer contact is empty")
	}

	var orders []models.SalesOrder
	result := d.DB.
		Where("customer_contact LIKE ?", customerContact+"%").
		Find(&orders)
	return orders, result.Error
}

func (d *SalesOrderDao) GetSaleOrdersByCustomerName(
	aCustomerName string,
) ([]models.SalesOrder, error) {
	customerName := strings.TrimSpace(aCustomerName)
	if customerName == "" {
		return []models.SalesOrder{}, errors.New("customer name is empty")
	}

	var orders []models.SalesOrder
	result := d.DB.
		Where("customer_contact = ?", customerName).
		Find(&orders)
	return orders, result.Error
}

func (d *SalesOrderDao) AddSaleOrder(aOrder *models.SalesOrder) error {
	aOrder.ID = 0

	return d.DB.
		Model(&models.SalesOrder{}).
		Create(aOrder).Error
}

func (d *SalesOrderDao) DeleteSaleOrders(aIDs []uint) error {
	if len(aIDs) == 0 {
		return nil
	}
	// 删除销售订单，规范写法
	result := d.DB.
		Where("id IN ?", aIDs).
		Delete(&models.SalesOrder{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("no sale order deleted")
	}

	return nil
}

func (d *SalesOrderDao) UpdateSaleOrderByID(
	id uint,
	updateData *models.SalesOrder,
) error {
	//   1：前置强校验，主键为 0 直接拦截，不进行任何数据库 I/O
	if id == 0 {
		return errors.New("更新失败：无效的订单 ID")
		// 商业项目中通常返回一个自定义的业务错误码，如 errno.ParamError
	}

	//  2：显式指定更新条件，且使用 Select("*") 确保零值能正常更新
	updateData.ID = id
	result := d.DB.Model(&models.SalesOrder{}).
		Where("id = ?", id).
		Select("*").
		Updates(updateData)

	if result.Error != nil {
		return result.Error
	}

	//   3：校验实际受影响的行数
	// 如果 id = 999999 在数据库不存在，result.Error 是不报错的（因为 SQL 执行成功了，只是没对齐数据）
	// 必须判断 RowsAffected 是否为 0，来确认识别到的数据是否真正存在
	if result.RowsAffected == 0 {
		return errors.New("更新失败：未找到对应的订单数据")
	}

	return nil
}
