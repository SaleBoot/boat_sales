package types

// BoatCabinType 驾舱形式
type BoatCabinType struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

const (
	BoatCabinTypeFlybridge = "FlybridgeCabin"
	BoatCabinTypeClosed    = "ClosedCabin"
	BoatCabinTypeOpen      = "OpenCabin"
)

// BoatCabinType 驾舱形式（varchar (32)）
// 行业通用枚举值，直接选用即可：
// 开放式驾舱
// 封闭式驾舱
// 硬顶驾舱
// 飞桥驾舱（游艇最常用）
// 单体驾舱
// 双驾舱
// 精简常用列表（项目优先用这些）：
// 飞桥驾舱、封闭式驾舱、开放式驾舱
var boatCabinTypeList = []BoatCabinType{
	{StrID: BoatCabinTypeFlybridge, Label: "飞桥驾舱"},
	{StrID: BoatCabinTypeClosed, Label: "封闭式驾舱"},
	{StrID: BoatCabinTypeOpen, Label: "开放式驾舱"},
}

// map
var boatCabinTypeMap = buildBoatCabinTypeMap()

func buildBoatCabinTypeMap() map[string]BoatCabinType {
	m := make(map[string]BoatCabinType, len(boatCabinTypeList))
	for _, v := range boatCabinTypeList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatCabinType(aStrID string) bool {
	_, ok := boatCabinTypeMap[aStrID]
	return ok
}

func GetBoatCabinType(aStrID string) (BoatCabinType, bool) {
	cat, ok := boatCabinTypeMap[aStrID]
	return cat, ok
}
