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

var SalesOrderStatusList = []SalesOrderStatus{
	{StrID: SalesOrderStatNew, Label: "新提交"},
	{StrID: SalesOrderStatProcessing, Label: "跟进中"},
	{StrID: SalesOrderStatFinished, Label: "已完成"},
}

// map
var SalesOrderStatusMap = buildSalesOrderStatusMap()

func buildSalesOrderStatusMap() map[string]SalesOrderStatus {
	m := make(map[string]SalesOrderStatus, len(SalesOrderStatusList))
	for _, v := range SalesOrderStatusList {
		m[v.StrID] = v
	}
	return m
}

func ValidateSalesOrderStatus(aStrID string) bool {
	_, ok := SalesOrderStatusMap[aStrID]
	return ok
}

func GetSalesOrderStatus(aStrID string) (SalesOrderStatus, bool) {
	status, ok := SalesOrderStatusMap[aStrID]
	if !ok {
		return status, false
	}
	return status, true
}
