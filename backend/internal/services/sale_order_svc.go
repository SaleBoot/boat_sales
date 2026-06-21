package services

import (
	"boatsales-backend/internal/db/dao"
	"boatsales-backend/internal/db/models"
	"boatsales-backend/internal/types"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type SalesOrderService struct {
	saleOrderDao *dao.SalesOrderDao
}

func NewSalesOrderService(
	aDao *dao.SalesOrderDao,
) (*SalesOrderService, error) {
	if aDao == nil {
		return nil, fmt.Errorf("SaleOrderDao is nil")
	}

	return &SalesOrderService{saleOrderDao: aDao}, nil // 依赖注入
}

// ----------------------------------------------------
type FrontSalesOrder struct {
	ID        uint      `json:"ID"`
	CreateAt  time.Time `json:"createAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Status    string    `json:"status"` //types.SalesOrderStatus

	ModelID     string `json:"modelID"`
	ModelLabel  string `json:"modelLabel"`
	Model3DPath string `json:"model3DPath"` // fbx /glb path
	Category    string `json:"category"`    // models.SysBoatCategory

	CustomerName    string `json:"customerName"`
	CustomerContact string `json:"customerContact"`
	Source          string `json:"source"`

	//
	// ExteriorLabel      string `json:"exteriorLabel"`
	// ExteriorColorLabel string `json:"exteriorColorLabel"`
	ExteriorColor string `json:"exteriorColor"`
	//
	// InteriorLabel      string `json:"interiorLabel"`
	// InteriorColorLabel string `json:"interiorColorLabel"`
	InteriorColor string `json:"interiorColor"`
	//
	// DeckLabel      string `json:"deckLabel"`
	// DeckColorLabel string `json:"deckColorLabel"`
	DeckColor string `json:"deckColor"`
	//
	EngineCategoryID string `json:"engineCategoryID"`
	EngineName       string `json:"engineName"`
	//
	//
	TotalPrice int `json:"totalPrice"`
	//
	AdImgs []string `json:"adImgs"`
}

func (input *FrontSalesOrder) ToDb() *models.SalesOrder {
	return &models.SalesOrder{
		Model: gorm.Model{
			ID:        input.ID,
			CreatedAt: input.CreateAt,
			UpdatedAt: input.UpdatedAt,
		},
		Status:      input.Status,
		ModelID:     input.ModelID,
		ModelLabel:  input.ModelLabel,
		Model3DPath: input.Model3DPath,
		Category:    input.Category,

		CustomerName:    input.CustomerName,
		CustomerContact: input.CustomerContact,
		Source:          "线上官网",
		//
		ExteriorLabel: "Exterior",
		ExteriorColor: input.ExteriorColor,
		InteriorLabel: "Interior",
		InteriorColor: input.InteriorColor,
		DeckLabel:     "Deck",
		DeckColor:     input.DeckColor,

		EngineCategoryID: input.EngineCategoryID,
		EngineName:       input.EngineName,
		TotalPrice:       input.TotalPrice,
	}
}

func (input *FrontSalesOrder) FromDb(db *models.SalesOrder) {
	*input = FrontSalesOrder{
		ID:        db.ID,
		CreateAt:  db.CreatedAt,
		UpdatedAt: db.UpdatedAt,
		Status:    db.Status,

		ModelID:     db.ModelID,
		ModelLabel:  db.ModelLabel,
		Model3DPath: db.Model3DPath,
		Category:    db.Category,

		CustomerName:    db.CustomerName,
		CustomerContact: db.CustomerContact,
		Source:          db.Source,

		ExteriorColor: db.ExteriorColor,
		InteriorColor: db.InteriorColor,
		DeckColor:     db.DeckColor,

		EngineCategoryID: db.EngineCategoryID,
		EngineName:       db.EngineName,
		TotalPrice:       db.TotalPrice,
	}
}

// GetAllSaleOrders retrieves all sale orders with pagination.
func (s *SalesOrderService) GetAllSaleOrders(
	page,
	pageSize int,
) ([]models.SalesOrder, int64, error) {
	return s.saleOrderDao.GetAllSaleOrders(page, pageSize)
}

func (d *SalesOrderService) GetSaleOrdersByByCustomerName(
	aCustomerName string,
) ([]models.SalesOrder, error) {

	return d.saleOrderDao.GetSaleOrdersByCustomerName(aCustomerName)
}

func (s *SalesOrderService) GetSaleOrdersByCustomerContact(
	contact string,
) ([]models.SalesOrder, error) {
	return s.saleOrderDao.GetSaleOrdersByCustomerContact(contact)
}

func (s *SalesOrderService) DeleteSaleOrders(ids []uint) error {
	return s.saleOrderDao.DeleteSaleOrders(ids)
}

func (s *SalesOrderService) UpdateSaleOrderByID(
	id uint,
	updateData *models.SalesOrder,
) error {
	return s.saleOrderDao.UpdateSaleOrderByID(id, updateData)
}

func (s *SalesOrderService) GetSalesOrdersOverview() types.SalesOrdersOverview {
	return s.saleOrderDao.GetSalesOrdersOverview()
}
