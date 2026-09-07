package v1

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"database/sql/driver"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

const (
	salesOrderStatusNew       = "new"
	salesOrderStatusFollowing = "following"
	salesOrderStatusCompleted = "completed"
)

var salesOrderStatuses = []string{
	salesOrderStatusNew,
	salesOrderStatusFollowing,
	salesOrderStatusCompleted,
}

var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

type salesOrderStore struct {
	UpdatedAt string       `json:"updatedAt"`
	Orders    []salesOrder `json:"orders"`
}

type salesOrder struct {
	ID                    string   `json:"id"`
	CreatedAt             string   `json:"createdAt"`
	UpdatedAt             string   `json:"updatedAt"`
	Status                string   `json:"status"`
	ModelID               string   `json:"modelId"`
	ModelLabel            string   `json:"modelLabel"`
	CustomerName          string   `json:"customerName"`
	CustomerContact       string   `json:"customerContact"`
	Category              string   `json:"category"`
	AppearanceLabel       string   `json:"appearanceLabel"`
	ColorLabel            string   `json:"colorLabel"`
	ColorHex              string   `json:"colorHex"`
	InteriorLabel         string   `json:"interiorLabel"`
	PowerLabel            string   `json:"powerLabel"`
	OptionalPackageLabels []string `json:"optionalPackageLabels"`
	TotalPrice            int      `json:"totalPrice"`
	Source                string   `json:"source"`
}

type salesOrderCreateInput struct {
	ModelID               string   `json:"modelId"`
	ModelLabel            string   `json:"modelLabel"`
	CustomerName          string   `json:"customerName"`
	CustomerContact       string   `json:"customerContact"`
	Category              string   `json:"category"`
	AppearanceLabel       string   `json:"appearanceLabel"`
	ColorLabel            string   `json:"colorLabel"`
	ColorHex              string   `json:"colorHex"`
	InteriorLabel         string   `json:"interiorLabel"`
	PowerLabel            string   `json:"powerLabel"`
	OptionalPackageLabels []string `json:"optionalPackageLabels"`
	TotalPrice            int      `json:"totalPrice"`
	Source                string   `json:"source"`
}

type salesOrderStatusInput struct {
	Status string `json:"status"`
}

type adminSalesStateResponse struct {
	UpdatedAt     string       `json:"updatedAt"`
	NewOrderCount int          `json:"newOrderCount"`
	Orders        []salesOrder `json:"orders"`
}

type salesOrderActionResponse struct {
	Message string     `json:"message"`
	Order   salesOrder `json:"order"`
}

type stringList []string

func (list stringList) Value() (driver.Value, error) {
	data, err := json.Marshal([]string(list))
	if err != nil {
		return nil, err
	}

	return string(data), nil
}

func (list *stringList) Scan(value any) error {
	if value == nil {
		*list = []string{}
		return nil
	}

	var data []byte
	switch typedValue := value.(type) {
	case []byte:
		data = typedValue
	case string:
		data = []byte(typedValue)
	default:
		return fmt.Errorf("scan string list from %T", value)
	}

	if len(data) == 0 {
		*list = []string{}
		return nil
	}

	var parsed []string
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}

	*list = normalizeStringList(parsed)
	return nil
}

func (a *app) RegisterOrderRoutes(r *gin.RouterGroup) {
	// 前台下单
	r.POST("/orders", a.handleCreateSalesOrder)

	// 后台订单管理（加入到管理组或单独加中间件）
	adminOrder := r.Group("/admin/orders", a.adminM.AdminAuthMiddleware())
	{
		adminOrder.GET("/", a.handleAdminSalesOrders)
		adminOrder.GET("/export", a.handleAdminExportSalesOrders)
		adminOrder.PUT("/:orderID/status", a.handleAdminUpdateSalesOrderStatus)
	}
}

func (a *app) handleCreateSalesOrder(c *gin.Context) {
	var input salesOrderCreateInput
	if err := json.NewDecoder(c.Request.Body).Decode(&input); err != nil {
		writeAPIError(c, http.StatusBadRequest, fmt.Errorf("decode sales order input: %w", err))
		return
	}

	order, err := buildSalesOrder(input)
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.createSalesOrder(order); err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, salesOrderActionResponse{
		Message: "Sales order created",
		Order:   order,
	})
}

func (a *app) handleAdminSalesOrders(c *gin.Context) {
	state, err := a.buildAdminSalesState()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, state)
}

func (a *app) handleAdminExportSalesOrders(c *gin.Context) {
	state, err := a.buildAdminSalesState()
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	data, err := exportSalesOrdersCSV(state.Orders)
	if err != nil {
		writeAPIError(c, http.StatusInternalServerError, fmt.Errorf("export sales orders csv: %w", err))
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="sales-orders.csv"`)
	c.Header("Content-Length", fmt.Sprintf("%d", len(data)))
	_, _ = c.Writer.Write(data)
}

func exportSalesOrdersCSV(orders []salesOrder) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.Write(utf8BOM)

	writer := csv.NewWriter(&buffer)
	writer.UseCRLF = true
	writeSalesOrdersCSVRows(writer, orders)
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func writeSalesOrdersCSVRows(writer *csv.Writer, orders []salesOrder) {
	_ = writer.Write([]string{"订单号", "创建时间", "状态", "船型ID", "船只名称",
		"客户称呼", "联系方式", "分类", "外观",
		"颜色", "内饰", "动力", "选装", "总价", "来源"})
	for _, order := range orders {
		_ = writer.Write([]string{
			order.ID,
			order.CreatedAt,
			order.Status,
			order.ModelID,
			order.ModelLabel,
			order.CustomerName,
			order.CustomerContact,
			order.Category,
			order.AppearanceLabel,
			joinCSVField(order.ColorLabel, order.ColorHex),
			order.InteriorLabel,
			order.PowerLabel,
			strings.Join(order.OptionalPackageLabels, "、"),
			fmt.Sprintf("%d", order.TotalPrice),
			order.Source,
		})
	}
}

func (a *app) handleAdminUpdateSalesOrderStatus(c *gin.Context) {
	orderID := strings.TrimSpace(c.Param("orderID"))
	if orderID == "" {
		writeAPIError(c, http.StatusBadRequest, errors.New("orderID is required"))
		return
	}

	var input salesOrderStatusInput
	if err := json.NewDecoder(c.Request.Body).Decode(&input); err != nil {
		writeAPIError(c, http.StatusBadRequest, fmt.Errorf("decode sales order status input: %w", err))
		return
	}

	nextStatus, err := normalizeSalesOrderStatus(input.Status)
	if err != nil {
		writeAPIError(c, http.StatusBadRequest, err)
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	order, err := a.updateSalesOrderStatus(orderID, nextStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeAPIError(c, http.StatusNotFound, fmt.Errorf("sales order %s does not exist", orderID))
			return
		}

		writeAPIError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, salesOrderActionResponse{
		Message: fmt.Sprintf("Updated sales order %s", orderID),
		Order:   order,
	})
}

func buildSalesOrder(input salesOrderCreateInput) (salesOrder, error) {
	modelID := strings.TrimSpace(input.ModelID)
	modelLabel := strings.TrimSpace(input.ModelLabel)
	if modelID == "" && modelLabel == "" {
		return salesOrder{}, errors.New("modelId or modelLabel is required")
	}

	if modelLabel == "" {
		modelLabel = modelID
	}

	customerName := strings.TrimSpace(input.CustomerName)
	customerContact := strings.TrimSpace(input.CustomerContact)
	if customerName == "" {
		return salesOrder{}, errors.New("customerName is required")
	}
	if customerContact == "" {
		return salesOrder{}, errors.New("customerContact is required")
	}

	orderID, err := generateSalesOrderID()
	if err != nil {
		return salesOrder{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)

	return salesOrder{
		ID:                    orderID,
		CreatedAt:             now,
		UpdatedAt:             now,
		Status:                salesOrderStatusNew,
		ModelID:               modelID,
		ModelLabel:            modelLabel,
		CustomerName:          customerName,
		CustomerContact:       customerContact,
		Category:              strings.TrimSpace(input.Category),
		AppearanceLabel:       strings.TrimSpace(input.AppearanceLabel),
		ColorLabel:            strings.TrimSpace(input.ColorLabel),
		ColorHex:              strings.TrimSpace(input.ColorHex),
		InteriorLabel:         strings.TrimSpace(input.InteriorLabel),
		PowerLabel:            strings.TrimSpace(input.PowerLabel),
		OptionalPackageLabels: normalizeStringList(input.OptionalPackageLabels),
		TotalPrice:            max(0, input.TotalPrice),
		Source:                normalizeSalesOrderSource(input.Source),
	}, nil
}

func generateSalesOrderID() (string, error) {
	randomBytes := make([]byte, 4)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate sales order id: %w", err)
	}

	return fmt.Sprintf("SO-%s-%s",
		time.Now().UTC().Format("20060102-150405"),
		strings.ToUpper(hex.EncodeToString(randomBytes))), nil
}

func normalizeSalesOrderSource(source string) string {
	trimmed := strings.TrimSpace(source)
	if trimmed == "" {
		return "showcase-web"
	}

	return trimmed
}

func normalizeStringList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}

		result = append(result, trimmed)
	}

	return result
}

func normalizeSalesOrderStatus(status string) (string, error) {
	trimmed := strings.TrimSpace(status)
	if !slices.Contains(salesOrderStatuses, trimmed) {
		return "", fmt.Errorf("unsupported sales order status %q", status)
	}

	return trimmed, nil
}

func defaultSalesOrderStore() salesOrderStore {
	return salesOrderStore{
		Orders: []salesOrder{},
	}
}

func (a *app) buildAdminSalesState() (adminSalesStateResponse, error) {
	store, err := a.readSalesOrderStore()
	if err != nil {
		return adminSalesStateResponse{}, err
	}

	return adminSalesStateResponse{
		UpdatedAt:     store.UpdatedAt,
		NewOrderCount: countNewSalesOrders(store.Orders),
		Orders:        store.Orders,
	}, nil
}

func countNewSalesOrders(orders []salesOrder) int {
	count := 0
	for _, order := range orders {
		if order.Status == salesOrderStatusNew {
			count += 1
		}
	}

	return count
}

func (a *app) initializeSalesOrderDatabase() error {
	databaseURL := strings.TrimSpace(os.Getenv("SALESBOAT_DATABASE_URL"))
	if databaseURL == "" {
		databaseURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if databaseURL == "" {
		return nil
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("open sales order database: %w", err)
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return fmt.Errorf("connect sales order database: %w", err)
	}

	a.orderDB = db
	if err := a.ensureSalesOrderTable(); err != nil {
		return err
	}
	if err := a.migrateSalesOrdersFromJSON(); err != nil {
		return err
	}

	return nil
}

func (a *app) ensureSalesOrderTable() error {
	if a.orderDB == nil {
		return nil
	}

	_, err := a.orderDB.Exec(`
CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',
  model_label TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  appearance_label TEXT NOT NULL DEFAULT '',
  color_label TEXT NOT NULL DEFAULT '',
  color_hex TEXT NOT NULL DEFAULT '',
  interior_label TEXT NOT NULL DEFAULT '',
  power_label TEXT NOT NULL DEFAULT '',
  optional_package_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'showcase-web'
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status_created ON sales_orders(status, created_at DESC);
`)
	if err != nil {
		return fmt.Errorf("ensure sales_orders table: %w", err)
	}

	return nil
}

func (a *app) migrateSalesOrdersFromJSON() error {
	if a.orderDB == nil {
		return nil
	}

	store, err := a.readSalesOrderFileStore()
	if err != nil {
		return err
	}
	for _, order := range store.Orders {
		if err := a.createSalesOrderInDB(order); err != nil {
			return fmt.Errorf("migrate sales order %s: %w", order.ID, err)
		}
	}

	return nil
}

func (a *app) createSalesOrder(order salesOrder) error {
	if a.orderDB != nil {
		if err := a.createSalesOrderInDB(order); err == nil {
			return a.syncSalesOrderFileSnapshot()
		}
	}

	store, err := a.readSalesOrderFileStore()
	if err != nil {
		return err
	}

	store.Orders = append([]salesOrder{order}, store.Orders...)
	return a.writeSalesOrderFileStore(store)
}

func (a *app) createSalesOrderInDB(order salesOrder) error {
	if a.orderDB == nil {
		return errors.New("sales order database is not configured")
	}

	createdAt, err := parseSalesOrderTimeOrNow(order.CreatedAt)
	if err != nil {
		return err
	}
	updatedAt, err := parseSalesOrderTimeOrNow(order.UpdatedAt)
	if err != nil {
		return err
	}

	_, err = a.orderDB.Exec(`
INSERT INTO sales_orders (
  id, created_at, updated_at, status, model_id, model_label, customer_name, customer_contact,
  category, appearance_label, color_label, color_hex, interior_label, power_label,
  optional_package_labels, total_price, source
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8,
  $9, $10, $11, $12, $13, $14,
  $15, $16, $17
)
ON CONFLICT (id) DO NOTHING`,
		order.ID, createdAt, updatedAt, order.Status, order.ModelID, order.ModelLabel, order.CustomerName, order.CustomerContact,
		order.Category, order.AppearanceLabel, order.ColorLabel, order.ColorHex, order.InteriorLabel, order.PowerLabel,
		stringList(order.OptionalPackageLabels), order.TotalPrice, order.Source,
	)
	if err != nil {
		return fmt.Errorf("insert sales order into database: %w", err)
	}

	return nil
}

func (a *app) updateSalesOrderStatus(orderID string, status string) (salesOrder, error) {
	if a.orderDB != nil {
		order, err := a.updateSalesOrderStatusInDB(orderID, status)
		if err == nil {
			_ = a.syncSalesOrderFileSnapshot()
			return order, nil
		}
	}

	store, err := a.readSalesOrderFileStore()
	if err != nil {
		return salesOrder{}, err
	}

	for idx := range store.Orders {
		if store.Orders[idx].ID == orderID {
			store.Orders[idx].Status = status
			store.Orders[idx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			if err := a.writeSalesOrderFileStore(store); err != nil {
				return salesOrder{}, err
			}
			return store.Orders[idx], nil
		}
	}

	return salesOrder{}, sql.ErrNoRows
}

func (a *app) updateSalesOrderStatusInDB(orderID string, status string) (salesOrder, error) {
	if a.orderDB == nil {
		return salesOrder{}, errors.New("sales order database is not configured")
	}

	row := a.orderDB.QueryRow(`
UPDATE sales_orders
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING id, created_at, updated_at, status, model_id, model_label, customer_name, customer_contact,
  category, appearance_label, color_label, color_hex, interior_label, power_label,
  optional_package_labels, total_price, source`,
		orderID, status,
	)

	return scanSalesOrder(row)
}

func (a *app) readSalesOrderStore() (salesOrderStore, error) {
	if a.orderDB != nil {
		store, err := a.readSalesOrderDBStore()
		if err == nil {
			return store, nil
		}
	}

	return a.readSalesOrderFileStore()
}

func (a *app) readSalesOrderDBStore() (salesOrderStore, error) {
	if a.orderDB == nil {
		return salesOrderStore{}, errors.New("sales order database is not configured")
	}

	rows, err := a.orderDB.Query(`
SELECT id, created_at, updated_at, status, model_id, model_label, customer_name, customer_contact,
  category, appearance_label, color_label, color_hex, interior_label, power_label,
  optional_package_labels, total_price, source
FROM sales_orders
ORDER BY created_at DESC`)
	if err != nil {
		return salesOrderStore{}, fmt.Errorf("query sales orders from database: %w", err)
	}
	defer rows.Close()

	orders := []salesOrder{}
	var updatedAt time.Time
	for rows.Next() {
		order, err := scanSalesOrder(rows)
		if err != nil {
			return salesOrderStore{}, err
		}

		orders = append(orders, order)
		if parsedUpdatedAt, err := time.Parse(time.RFC3339, order.UpdatedAt); err == nil && parsedUpdatedAt.After(updatedAt) {
			updatedAt = parsedUpdatedAt
		}
	}
	if err := rows.Err(); err != nil {
		return salesOrderStore{}, err
	}

	updatedAtValue := ""
	if !updatedAt.IsZero() {
		updatedAtValue = updatedAt.UTC().Format(time.RFC3339)
	}

	return salesOrderStore{
		UpdatedAt: updatedAtValue,
		Orders:    orders,
	}, nil
}

func (a *app) readSalesOrderFileStore() (salesOrderStore, error) {
	data, err := os.ReadFile(a.ordersPath)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultSalesOrderStore(), nil
		}

		return salesOrderStore{}, fmt.Errorf("read sales orders: %w", err)
	}

	var store salesOrderStore
	if err := json.Unmarshal(data, &store); err != nil {
		return salesOrderStore{}, fmt.Errorf("parse sales orders: %w", err)
	}

	if store.Orders == nil {
		store.Orders = []salesOrder{}
	}

	return store, nil
}

func (a *app) writeSalesOrderFileStore(store salesOrderStore) error {
	if store.Orders == nil {
		store.Orders = []salesOrder{}
	}

	store.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := os.MkdirAll(filepath.Dir(a.ordersPath), 0o755); err != nil {
		return fmt.Errorf("create sales order directory: %w", err)
	}

	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal sales orders: %w", err)
	}

	if err := os.WriteFile(a.ordersPath, append(data, '\n'), 0o644); err != nil {
		return fmt.Errorf("write sales orders: %w", err)
	}

	return nil
}

func (a *app) syncSalesOrderFileSnapshot() error {
	store, err := a.readSalesOrderDBStore()
	if err != nil {
		return err
	}

	return a.writeSalesOrderFileStore(store)
}

type salesOrderScanner interface {
	Scan(dest ...any) error
}

func scanSalesOrder(scanner salesOrderScanner) (salesOrder, error) {
	var order salesOrder
	var createdAt time.Time
	var updatedAt time.Time
	var optionalLabels stringList
	if err := scanner.Scan(
		&order.ID,
		&createdAt,
		&updatedAt,
		&order.Status,
		&order.ModelID,
		&order.ModelLabel,
		&order.CustomerName,
		&order.CustomerContact,
		&order.Category,
		&order.AppearanceLabel,
		&order.ColorLabel,
		&order.ColorHex,
		&order.InteriorLabel,
		&order.PowerLabel,
		&optionalLabels,
		&order.TotalPrice,
		&order.Source,
	); err != nil {
		return salesOrder{}, err
	}

	order.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	order.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	order.OptionalPackageLabels = []string(optionalLabels)
	return order, nil
}

func parseSalesOrderTime(value string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse sales order time %q: %w", value, err)
	}

	return parsed, nil
}

func parseSalesOrderTimeOrNow(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Now().UTC(), nil
	}

	return parseSalesOrderTime(trimmed)
}

func joinCSVField(parts ...string) string {
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		values = append(values, trimmed)
	}

	return strings.Join(values, " ")
}
