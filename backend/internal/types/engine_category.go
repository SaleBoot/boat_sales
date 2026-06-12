package types

import "fmt"

// BoatEngineCategory 引擎分类
type BoatEngineCategory struct {
	StrID string `json:"strID"`
	Label string `json:"label"`
	Descr string `json:"introduction"`
}

// String 实现字符串方法，方便日志打印
func (e BoatEngineCategory) String() string {
	return fmt.Sprintf("ID: %s, 名称: %s", e.StrID, e.Label)
}

// 引擎分类ID常量
const (
	EngineCatGasoline       = "gasoline"
	EngineCatDiesel         = "diesel"
	EngineCatElectric       = "electric"
	EngineCatDieselElectric = "diesel-electric-hybrid"
	EngineCatGasElectric    = "gas-electric-hybrid"
)

// **内河小快艇/小型休闲船，绝大多数是纯汽油或纯柴油；混动极少，而且基本都是“柴电混动”，几乎没有“汽油+电”的油电混动。**
//
// 引擎分类比较固定，只有5类，所以不建表了，只定义一个全局变量。
var BoatEngineCategoryList = []BoatEngineCategory{
	//
	// ### 一、最常见：纯汽油（舷外机）
	// - 4–7米内河小快艇、钓鱼艇、冲锋舟，**90%是汽油舷外机**（雅马哈、水星、本田等）。
	// - 特点：轻、便宜、启动快、加速猛、好维修。
	{StrID: EngineCatGasoline, Label: "汽油", Descr: "汽油引擎"},
	// ### 二、次常见：纯柴油（舷内/挂机）
	// - 6米以上、要载重/跑远路、公务巡逻艇，多用**纯柴油**（舷内机或柴油挂机）。
	// - 特点：扭矩大、省油、耐用、安全（不易燃）。
	{StrID: EngineCatDiesel, Label: "柴油", Descr: "柴油引擎"},
	// ### 三、纯电：短途、景区多见
	// - 内河景区、短途观光、固定航线的小船，**纯电动**越来越多（零排放、安静）。
	// - 缺点：续航短（一般1–3小时），需要充电设施。
	{StrID: EngineCatElectric, Label: "纯电", Descr: "纯电引擎"},
	// ### 四、混动：很少见，且基本是柴电
	// - **柴电混动**：内河只有**高端观光船、公务执法船、工程船**才用，小快艇几乎没有。
	//   - 模式：低速/进出港纯电（安静零排放）；高速/电量低时柴油机发电驱动。
	{StrID: EngineCatDieselElectric, Label: "柴电混动", Descr: "柴油+电混动引擎"},
	// ### 五 **汽油+电混动（油电混动）**：**内河小艇几乎没有**。
	// 原因：汽油易燃、混动系统贵、体积大，小快艇没必要。
	//
	// 汽油（gasoline/petrol）+ 锂电的船非常少，主要是一些中型游艇、高端休闲艇、特种工作艇。
	{StrID: EngineCatGasElectric, Label: "油电混动", Descr: "汽油+电混动引擎"},
	// ### 总结（一句话）
	// - 普通内河小快艇：**汽油为主，柴油次之**。
	// - 混动：**柴电只在大船/公务船，油电混动基本没有**。
	// - 纯电：**景区短途小船**常见。
}

// ID 映射表：用于后端快速查找、参数校验
var BoatEngineCategoryMap = buildBoatEngineCategoryMap()

func buildBoatEngineCategoryMap() map[string]BoatEngineCategory {
	m := make(map[string]BoatEngineCategory, len(BoatEngineCategoryList))
	for _, v := range BoatEngineCategoryList {
		m[v.StrID] = v
	}
	return m
}

func ValidateBoatEngineCategory(aStrID string) bool {
	_, ok := BoatEngineCategoryMap[aStrID]
	return ok
}

func GetBoatEngineCategory(aStrID string) (BoatEngineCategory, bool) {
	cat, ok := BoatEngineCategoryMap[aStrID]
	if !ok {
		return cat, false
	}
	return cat, true
}
