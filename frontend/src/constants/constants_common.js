
// 对应后端 BoatNavAreaList (行业术语，用于描述船舶的导航区域类型)
export const BOAT_NAV_AREA_OPTIONS = [
  { value: "InlandClassA", label: "内河 A 级" },
  { value: "InlandClassB", label: "内河 B 级" },
  { value: "ShelteredArea", label: "遮蔽航区" },
  { value: "RestrictedWaters", label: "限定水域" },
  { value: "CoastalArea", label: "近海航区" },
  { value: "NearshoreArea", label: "沿海航区" },
  { value: "OffshoreArea", label: "远海航区" },
];

// 对应后端 BoatMaterialList  (行业术语)
export const BOAT_MATERIAL_OPTIONS = [
  { value: "Steel", label: "钢质" },
  { value: "AlAlloy", label: "铝合金" },
  { value: "FRP", label: "玻璃钢（FRP）" },
  { value: "CarbonFiberComposite", label: "碳纤维复合材料" },
  { value: "Wood", label: "木质" },
  { value: "MixedMaterial", label: "混合材质" },
  { value: "StainlessSteel", label: "不锈钢" },
  { value: "TiAlloy", label: "钛合金" },
];

// 对应后端 BoatCertiTypeList  (行业术语)
export const BOAT_CERTI_TYPE_OPTIONS = [
  { value: "CCSInlandSurvey", label: "CCS内河检验" },
  { value: "CCSSeagoingSurvey", label: "CCS海船检验" },
  { value: "CCSClassSurvey", label: "CCS入级检验" },
  { value: "LocalShipSurvey", label: "地方船检" },
  { value: "MSASmallCraftSurvey", label: "海事局小型船检" },
  { value: "YachtSeaworthinessCerti", label: "游艇适航证书" },
  { value: "FishingVesselSurvey", label: "渔业船舶检验" },
];

// 对应后端 BoatEngineCategoryList  (行业术语)
export const BOAT_ENGINE_CATEGORY_OPTIONS = [    
    { StrID: "diesel", Label: "柴油", Descr: "柴油引擎"},
    { StrID: "electric", Label: "纯电", Descr: "纯电引擎"},
    { StrID: "diesel-electric-hybrid", Label: "柴电混动", Descr: "柴油+电混动引擎" },
    { StrID: "gasoline", Label: "汽油", Descr: "汽油引擎"},
    { StrID: "gasoline-electric-hybrid", Label: "油电混动", Descr: "汽油+电混动引擎"},
];

export function getBoatEngineCategoryLabelByID(aStrID)
{
  return BOAT_ENGINE_CATEGORY_OPTIONS.find(item => item.StrID === aStrID)?.Label || "";
}

export const SALES_ORDER_STATUS_LIST = [     
 	{StrID: "new", Label: "新提交"},
	{StrID: "processing", Label: "跟进中"},
	{StrID: "finished", Label: "已完成"},
];

export function getSalesOrderStatusLabelByID(statusID) {
  return SALES_ORDER_STATUS_LIST.find(item => item.StrID === statusID)?.Label || "";
}
