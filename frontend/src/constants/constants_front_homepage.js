export const PREFERRED_MODEL_ID = 'FireFighting'
export const MODEL_STORAGE_KEY = 'salesboat.selected-model-id'
export const NON_VESSEL_MODEL_IDS = new Set(['Dabao'])
export const HERO_IMAGE_FILE_NAME = 'FrontPage.png'
// 《2026京穹船舰产品宣传册》文件名
export const BROCHURE_FILE_NAME = '2026\u4eac\u7a57\u8239\u8236\u4ea7\u54c1\u5ba3\u4f20\u518c.pdf'
// 网站的默认设置。
export const DEFAULT_SITE_SETTINGS = {
  primaryModelId: '',
  heroImagePath: `pdf/${HERO_IMAGE_FILE_NAME}`,
  brochurePath: `pdf/${BROCHURE_FILE_NAME}`,
  compareLimit: 4
}

// 首页首屏内容的默认文案。
export const DEFAULT_HERO_CONTENT = {
  // 京穗船舶 · 智能船型选购体验
  kicker: '\u4eac\u7a57\u8239\u8236 \u00b7 \u667a\u80fd\u8239\u578b\u9009\u8d2d\u4f53\u9a8c',
  // 为您找到更适合任务需求的船型方案。
  heading: '\u4e3a\u60a8\u627e\u5230\u66f4\u9002\u5408\u4efb\u52a1\u9700\u6c42\u7684\u8239\u578b\u65b9\u6848\u3002',
  // ('从新能源船、应急救援船、公务执法艇到游艇，您可以通过 3D 沉浸式看船、查看核心参数与选装方案，更直观地了解产品，更从容地做出选择。',)
  summary:
    '\u4ece\u65b0\u80fd\u6e90\u8239\u3001\u5e94\u6025\u6551\u63f4\u8239\u3001\u516c\u52a1\u6267\u6cd5\u8247\u5230\u6e38\u8247\uff0c\u60a8\u53ef\u4ee5\u901a\u8fc7 3D \u6c89\u6d78\u5f0f\u770b\u8239\u3001\u67e5\u770b\u6838\u5fc3\u53c2\u6570\u4e0e\u9009\u88c5\u65b9\u6848\uff0c\u66f4\u76f4\u89c2\u5730\u4e86\u89e3\u4ea7\u54c1\uff0c\u66f4\u4ece\u5bb9\u5730\u505a\u51fa\u9009\u62e9\u3002',
  proofPoints: [
    // 沉浸式 3D 看船
    '\u6c89\u6d78\u5f0f 3D \u770b\u8239',
    // 关键参数一目了然
    '\u5173\u952e\u53c2\u6570\u4e00\u76ee\u4e86\u7136',
    // 专属方案快速沟通
    '\u4e13\u5c5e\u65b9\u6848\u5feb\u901f\u6c9f\u901a'
  ],
  // 立即看船
  primaryButtonLabel: '\u7acb\u5373\u770b\u8239',
  // 获取专属方案
  secondaryButtonLabel: '\u83b7\u53d6\u4e13\u5c5e\u65b9\u6848',
  // 继续了解
  scrollCueLabel: '\u7ee7\u7eed\u4e86\u89e3'
}

// 备用的默认船只规格。
export const legacyFallbackSpecs = {
  overallLength: '15.80',
  waterlineLength: '15.10',
  beam: '3.50',
  depth: '1.20',
  draft: '0.50',
  navigationArea: '',
  mainEnginePower: '10 - 75 HP',
  designSpeed: '25',
  ratedCapacity: '32',
  // 电动舷外机
  powerType: '\u7535\u52a8\u8237\u5916\u673a',
  // 铝合金或玻璃钢
  material: '\u94dd\u5408\u91d1\u6216\u73bb\u7483\u94a2',
  // 检验证书
  certificateType: '\u68c0\u9a8c\u8bc1\u4e66'
}

// 定义了船只规格的分组方式。
export const modelSpecGroups = [
  {
    title: '\u8239\u4f53\u53c2\u6570', // 船体参数
    fields: ['overallLength', 'waterlineLength', 'beam']
  },
  {
    title: '\u5c3a\u5ea6\u4e0e\u822a\u533a',// 尺度与航区
    fields: ['depth', 'draft', 'navigationArea']
  },
  {
    title: '\u52a8\u529b\u4e0e\u4e58\u5458',// 动力与乘员
    fields: ['mainEnginePower', 'designSpeed', 'ratedCapacity', 'powerType']
  },
  {
    title: '\u6750\u8d28\u4e0e\u8ba4\u8bc1',// 材质与认证
    fields: ['material', 'certificateType']
  }
]

// 定义了船只规格字段的显示标签（中文名）。
export const modelSpecFieldLabels = {
  overallLength: '\u603b\u957f', // 总长
  waterlineLength: '\u6c34\u7ebf\u957f',// 水线长
  beam: '\u8239\u5bbd', //  船宽
  depth: '\u578b\u6df1',// 型深
  draft: '\u5403\u6c34', // 吃水
  navigationArea: '\u822a\u533a', // 航区
  mainEnginePower: '\u4e3b\u673a\u529f\u7387', // 主机功率
  designSpeed: '\u8bbe\u8ba1\u822a\u901f', // 设计航速
  ratedCapacity: '\u989d\u5b9a\u4e58\u5458', // 额定乘员
  powerType: '\u52a8\u529b\u5f62\u5f0f', // 动力形式
  material: '\u6750\u8d28', // 材质
  certificateType: '\u8bc1\u4e66\u7c7b\u578b' //  证书类型
}

export const viewerSpecFields = ['overallLength', 'draft', 'mainEnginePower']

// 定义了船只的分类。
export const vesselCategories = [
  '\u65b0\u80fd\u6e90\u8239',// 新能源船
  '\u5e94\u6025\u6551\u63f4\u8239',// 应急救援船 
  '\u516c\u52a1\u6267\u6cd5\u8247',// 公务执法艇  
  '\u6e38\u8247'//---  游艇
]
// 定义了船只的分类菜单。
export const vesselCategoryMenus = [
  { id: 'NewEnergy', label: '\u65b0\u80fd\u6e90\u8239' },// 新能源船
  { id: 'EmergencyRescue', label: '\u5e94\u6025\u6551\u63f4\u8239' },// 应急救援船 
  { id: 'OfficialEnforcement', label: '\u516c\u52a1\u6267\u6cd5\u8247' },// 公务执法艇  
  { id: 'Yacht', label: '\u6e38\u8247' }//---  游艇
]