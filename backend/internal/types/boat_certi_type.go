package types

// Boat certificate type
type BoatCertiType struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

const (
	BoatCertiCCSInlandSurvey     = "CCSInlandSurvey"         // CCS内河检验
	BoatCertiCCSSeagoingSurvey   = "CCSSeagoingSurvey"       // CCS海船检验
	BoatCertiCCSClassSurvey      = "CCSClassSurvey"          // CCS入级检验
	BoatCertiLocalShipSurvey     = "LocalShipSurvey"         // 地方船检
	BoatCertiMSASmallCraftSurvey = "MSASmallCraftSurvey"     // 海事局小型船检
	BoatCertiYachtSeaworthiness  = "YachtSeaworthinessCerti" // 游艇适航证书
	BoatCertiFishingVesselSurvey = "FishingVesselSurvey"     // 渔业船舶检验
)

var boatCertiTypeList = []BoatCertiType{
	{StrID: BoatCertiCCSInlandSurvey, Label: "CCS内河检验"},
	{StrID: BoatCertiCCSSeagoingSurvey, Label: "CCS海船检验"},
	{StrID: BoatCertiCCSClassSurvey, Label: "CCS入级检验"},
	{StrID: BoatCertiLocalShipSurvey, Label: "地方船检"},
	{StrID: BoatCertiMSASmallCraftSurvey, Label: "海事局小型船检"},
	{StrID: BoatCertiYachtSeaworthiness, Label: "游艇适航证书"},
	{StrID: BoatCertiFishingVesselSurvey, Label: "渔业船舶检验"},
}

// map
var boatCertiTypeMap = buildBoatCertiTypeMap()

func buildBoatCertiTypeMap() map[string]BoatCertiType {
	m := make(map[string]BoatCertiType, len(boatCertiTypeList))
	for _, v := range boatCertiTypeList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatCertiType(aStrID string) bool {
	_, ok := boatCertiTypeMap[aStrID]
	return ok
}

func GetBoatCertiType(aStrID string) (BoatCertiType, bool) {
	certiType, ok := boatCertiTypeMap[aStrID]
	if !ok {
		return certiType, false
	}
	return certiType, true
}

// ##  航区-证书匹配参考（录入数据参考）
// - 内河A级、内河B级、限定水域：CCS内河检验 / 地方船检 / 海事局小型船检
// - 遮蔽航区、近海航区、沿海航区：CCS海船检验
// - 远海航区：CCS海船检验 / CCS入级检验
// - 小型休闲游艇：游艇适航证书 / 海事局小型船检
func GetBoatCertiTypeByNavArea(aNavAreaID string) []BoatCertiType {
	if aNavAreaID == BoatNavAreaInlandClassA ||
		aNavAreaID == BoatNavAreaInlandClassB ||
		aNavAreaID == BoatNavAreaRestrictedWaters {
		return []BoatCertiType{
			{StrID: BoatCertiCCSInlandSurvey, Label: "CCS内河检验"},
			{StrID: BoatCertiLocalShipSurvey, Label: "地方船检"},
			{StrID: BoatCertiMSASmallCraftSurvey, Label: "海事局小型船检"},
		}
	}

	if aNavAreaID == BoatNavAreaShelteredArea ||
		aNavAreaID == BoatNavAreaCoastalArea ||
		aNavAreaID == BoatNavAreaNearshoreArea {
		return []BoatCertiType{
			{StrID: BoatCertiCCSSeagoingSurvey, Label: "CCS海船检验"},
		}
	}

	if aNavAreaID == BoatNavAreaOffshoreArea {
		return []BoatCertiType{
			{StrID: BoatCertiCCSSeagoingSurvey, Label: "CCS海船检验"},
			{StrID: BoatCertiCCSClassSurvey, Label: "CCS入级检验"},
		}
	}

	// CCS内河检验  CCS海船检验  地方船检  海事局小型船检
	return boatCertiTypeList
}
