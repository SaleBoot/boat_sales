package types

// BoatNavArea
type BoatNavArea struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
}

/*
内河 A 级: 内河高等级航道，通航条件好、水流平稳、船舶密集，主流客运 / 观光游艇、公务艇常用。
内河 B 级:普通内河航道、支流、小型河道，通航条件一般，小型休闲艇、作业艇居多。
遮蔽航区: 被陆地 / 岛屿屏障、风浪小的近岸水域，浪高受限，多数中小型游艇、快艇主力航区。
限定水域: 码头、港池、避风塘、封闭园区水域，活动范围严格受限，仅限港内 / 园区短途使用。
近海 / 沿海 / 远海航区（拓展）: 面向海船，按离岸距离、风浪等级划分，用于大型巡航游艇。

remark: 前端下拉框直接用上面文本作为选项，和数据库navigation_area 字段的英文值一一对应；
*/
const (
	BoatNavAreaInlandClassA     = "InlandClassA"     // 内河 A 级
	BoatNavAreaInlandClassB     = "InlandClassB"     // 内河 B 级
	BoatNavAreaShelteredArea    = "ShelteredArea"    // 遮蔽航区
	BoatNavAreaRestrictedWaters = "RestrictedWaters" // 限定水域
	BoatNavAreaCoastalArea      = "CoastalArea"      // 近海航区
	BoatNavAreaNearshoreArea    = "NearshoreArea"    // 沿海航区
	BoatNavAreaOffshoreArea     = "OffshoreArea"     // 远海航区
)

var boatNavAreaList = []BoatNavArea{
	{StrID: BoatNavAreaInlandClassA, Label: "内河 A级"},
	{StrID: BoatNavAreaInlandClassB, Label: "内河 B级"},
	{StrID: BoatNavAreaShelteredArea, Label: "遮蔽航区"},
	{StrID: BoatNavAreaRestrictedWaters, Label: "限定水域"},
	{StrID: BoatNavAreaCoastalArea, Label: "近海航区"},
	{StrID: BoatNavAreaNearshoreArea, Label: "沿海航区"},
	{StrID: BoatNavAreaOffshoreArea, Label: "远海航区"},
}

// map
var boatNavAreaMap = buildBoatNavAreaMap()

func buildBoatNavAreaMap() map[string]BoatNavArea {
	m := make(map[string]BoatNavArea, len(boatNavAreaList))
	for _, v := range boatNavAreaList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatNavArea(aStrID string) bool {
	_, ok := boatNavAreaMap[aStrID]
	return ok
}

func GetBoatNavArea(aStrID string) (BoatNavArea, bool) {
	area, ok := boatNavAreaMap[aStrID]
	if !ok {
		return area, false
	}
	return area, true
}
