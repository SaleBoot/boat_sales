package types

// Boat Material type
type BoatMaterial struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

/*
：
铝合金：Aluminum Alloy
玻璃钢（FRP）：FRP / Fiberglass Reinforced Plastic
碳纤维复合材料：Carbon Fiber Composite
木质：Wood
不锈钢：Stainless Steel
钛合金：Titanium Alloy
混合材质：Mixed Material
*/

const (
	BoatMatSteel   = "Steel"   // 钢质
	BoatMatAlAlloy = "AlAlloy" // 铝合金// Aluminum Alloy
	// FRP / Fiberglass Reinforced Plastic
	BoatMatFRP                  = "FRP"                  // 玻璃钢（FRP）
	BoatMatCarbonFiberComposite = "CarbonFiberComposite" // 碳纤维复合材料
	BoatMatWood                 = "Wood"                 // 木质
	BoatMatMixedMaterial        = "MixedMaterial"        // 混合材质
	//
	BoatMatStainlessSteel = "StainlessSteel" // 不锈钢
	BoatMatTiAlloy        = "TiAlloy"        // 钛合金// TitaniumAlloy
)

var BoatMaterialList = []BoatMaterial{
	{StrID: BoatMatSteel, Label: "钢质"},
	{StrID: BoatMatAlAlloy, Label: "铝合金"},
	{StrID: BoatMatFRP, Label: "玻璃钢（FRP）"},
	{StrID: BoatMatCarbonFiberComposite, Label: "碳纤维复合材料"},
	{StrID: BoatMatWood, Label: "木质"},
	{StrID: BoatMatMixedMaterial, Label: "混合材质"},
	{StrID: BoatMatStainlessSteel, Label: "不锈钢"},
	{StrID: BoatMatTiAlloy, Label: "钛合金"},
}

// map
var BoatMaterialMap = buildBoatMaterialMap()

func buildBoatMaterialMap() map[string]BoatMaterial {
	m := make(map[string]BoatMaterial, len(BoatMaterialList))
	for _, v := range BoatMaterialList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatMaterial(aStrID string) bool {
	_, ok := BoatMaterialMap[aStrID]
	return ok
}

func GetBoatMaterial(aStrID string) (BoatMaterial, bool) {
	material, ok := BoatMaterialMap[aStrID]
	if !ok {
		return material, false
	}
	return material, true
}
