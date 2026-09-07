package types

// Sales order status
type SalesOrderStatus struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

const (
	SalesOrderStatNew        = "new"        // 新提交
	SalesOrderStatProcessing = "processing" // 跟进中
	SalesOrderStatFinished   = "finished"   // 已完成
)

var salesOrderStatusList = []SalesOrderStatus{
	{StrID: SalesOrderStatNew, Label: "新提交"},
	{StrID: SalesOrderStatProcessing, Label: "跟进中"},
	{StrID: SalesOrderStatFinished, Label: "已完成"},
}

// map
var salesOrderStatusMap = buildSalesOrderStatusMap()

func buildSalesOrderStatusMap() map[string]SalesOrderStatus {
	m := make(map[string]SalesOrderStatus, len(salesOrderStatusList))
	for _, v := range salesOrderStatusList {
		m[v.StrID] = v
	}
	return m
}

func ValidateSalesOrderStatus(aStrID string) bool {
	_, ok := salesOrderStatusMap[aStrID]
	return ok
}

func GetSalesOrderStatus(aStrID string) (SalesOrderStatus, bool) {
	status, ok := salesOrderStatusMap[aStrID]
	if !ok {
		return status, false
	}
	return status, true
}
