package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildSalesOrderRequiresCustomerContact(t *testing.T) {
	_, err := buildSalesOrder(salesOrderCreateInput{
		ModelID:      "Cabnet",
		ModelLabel:   "测试船型",
		CustomerName: "王先生",
	})
	if err == nil {
		t.Fatal("buildSalesOrder succeeded without customer contact, want error")
	}
}

func TestBuildSalesOrderStoresCustomerInfo(t *testing.T) {
	order, err := buildSalesOrder(salesOrderCreateInput{
		ModelID:         "Cabnet",
		ModelLabel:      "测试船型",
		CustomerName:    " 王先生 ",
		CustomerContact: " 13800138000 ",
	})
	if err != nil {
		t.Fatalf("buildSalesOrder returned error: %v", err)
	}

	if order.CustomerName != "王先生" {
		t.Fatalf("CustomerName = %q, want %q", order.CustomerName, "王先生")
	}
	if order.CustomerContact != "13800138000" {
		t.Fatalf("CustomerContact = %q, want %q", order.CustomerContact, "13800138000")
	}
}

func TestExportSalesOrdersCSVIncludesUTF8BOMAndChineseText(t *testing.T) {
	data, err := exportSalesOrdersCSV([]salesOrder{
		{
			ID:                    "SO-test",
			CreatedAt:             "2026-05-12T00:00:00Z",
			Status:                salesOrderStatusNew,
			ModelID:               "Cabnet",
			ModelLabel:            "公务执法艇",
			CustomerName:          "王先生",
			CustomerContact:       "13800138000",
			Category:              "公务执法艇",
			AppearanceLabel:       "任务识别外观",
			ColorLabel:            "珍珠白",
			ColorHex:              "#ffffff",
			InteriorLabel:         "海舱灰功能内饰",
			PowerLabel:            "高性能任务动力",
			OptionalPackageLabels: []string{"智能监控系统", "执法辅助系统"},
			TotalPrice:            688000,
			Source:                "showcase-web",
		},
	})
	if err != nil {
		t.Fatalf("exportSalesOrdersCSV returned error: %v", err)
	}

	if !bytes.HasPrefix(data, utf8BOM) {
		firstBytesLength := len(data)
		if firstBytesLength > 3 {
			firstBytesLength = 3
		}
		t.Fatalf("CSV does not start with UTF-8 BOM: first bytes % x", data[:firstBytesLength])
	}

	csvText := string(bytes.TrimPrefix(data, utf8BOM))
	if !strings.Contains(csvText, "\r\n") {
		t.Fatalf("CSV should use CRLF line endings for spreadsheet compatibility: %q", csvText)
	}
	for _, want := range []string{"订单号", "公务执法艇", "王先生", "智能监控系统、执法辅助系统"} {
		if !strings.Contains(csvText, want) {
			t.Fatalf("CSV text does not contain %q: %s", want, csvText)
		}
	}
}

func TestHandleAdminExportSalesOrdersReturnsExcelFriendlyCSV(t *testing.T) {
	tempDir := t.TempDir()
	application := &app{
		ordersPath: filepath.Join(tempDir, "orders.json"),
	}
	store := salesOrderStore{
		Orders: []salesOrder{
			{
				ID:              "SO-test",
				CreatedAt:       "2026-05-12T00:00:00Z",
				UpdatedAt:       "2026-05-12T00:00:00Z",
				Status:          salesOrderStatusNew,
				ModelID:         "Cabnet",
				ModelLabel:      "公务执法艇",
				CustomerName:    "王先生",
				CustomerContact: "13800138000",
				Category:        "公务执法艇",
			},
		},
	}
	if err := application.writeSalesOrderFileStore(store); err != nil {
		t.Fatalf("writeSalesOrderFileStore returned error: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/orders/export", nil)
	application.handleAdminExportSalesOrders(recorder, request)

	response := recorder.Result()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if got := response.Header.Get("Content-Type"); got != "text/csv; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want text/csv; charset=utf-8", got)
	}
	if got := response.Header.Get("Content-Disposition"); !strings.Contains(got, "sales-orders.csv") {
		t.Fatalf("Content-Disposition = %q, want sales-orders.csv attachment", got)
	}
	if !bytes.HasPrefix(recorder.Body.Bytes(), utf8BOM) {
		t.Fatalf("response body does not start with UTF-8 BOM")
	}
	if !strings.Contains(recorder.Body.String(), "公务执法艇") {
		t.Fatalf("response body does not contain Chinese order text: %s", recorder.Body.String())
	}
}
