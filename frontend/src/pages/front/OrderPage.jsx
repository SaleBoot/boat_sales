import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom';
import { useFocusTarget } from '../../hooks/useFocusTarget';
import ShipScene from '../scene3d/ShipScene'
import { vesselCategoryMenus } from '../../constants/constants_front_homepage.js'
import { buildModel4ShipScene } from '../../utils/utils_ship_scene'
import { 
  BOAT_ENGINE_CATEGORY_OPTIONS
} from '../../constants/constants_common.js'
 
const configurationSteps = ['船型', '外观', '内饰', '动力' ]

const sectionIds = {
  船型: 'order-section-model',
  外观: 'order-section-appearance',
  内饰: 'order-section-interior',
  动力: 'order-section-power', 
}

const orderStageOptions = [
  { id: 'model', label: '1 确认船型' },
  { id: 'config', label: '2 定制方案' },
  { id: 'submit', label: '3 留资跟进' }
]

const stepFocusTargets = {
  船型: 'exterior',
  外观: 'exterior',
  内饰: 'exterior',
  动力: 'engine', 
}

const COMPACT_STEP_WHEEL_LOCK_MS = 520
const COMPACT_STEP_HEIGHT_RATIO = 0.82
const MIN_WHEEL_DELTA = 8
const CONFIG_STEP_SCROLL_OFFSET = 112

const DEFAULT_ORDER_CONFIG = {
  appearanceOptions: [
    {
      id: 'business',
      label: '商务接待外观',
      description: '以干净比例和稳重识别为主，适合展示、接待与日常运营',
      price: 0
    },
    {
      id: 'sport',
      label: '动感识别外观',
      description: '强化速度感与视觉记忆点，适合品牌展示和高曝光场景',
      price: 12000
    },
    {
      id: 'duty',
      label: '公务执法外观',
      description: '突出任务属性和远距离识别度，适合巡航、执法与应急联动',
      price: 18000
    }
  ],
  colorOptions: [],
  interiorOptions: [
    {
      id: 'marine-gray',
      label: '海舱灰功能内饰',
      description: '克制、耐看、易维护，适合商务接待与现代化工作船',
      price: 0
    },
    {
      id: 'warm-teak',
      label: '暖木游艇内饰',
      description: '突出木饰面、软包与温暖氛围，适合游艇休闲和高端接待',
      price: 26000
    },
    {
      id: 'task-black',
      label: '任务黑耐用内饰',
      description: '强调耐磨、抗污和设备集成，适合执法、救援与高强度任务',
      price: 18000
    }
  ],
  // -------------------------
  powerTypes: [
    {
      id: 'electric',
      label: '纯电动力',
      engines: [
        {
          id: 'electric-standard',
          label: '高效巡航电机',
          description: '兼顾静音巡航、日常接待与中短途运营，适合作为标准交付方案',
          price: 36000
        } 
      ]
    },
    {
      id: 'diesel',
      label: '柴油动力',
      engines: [
        {
          id: 'diesel-d01',
          label: 'D01 型柴油发动机', // 加个空格更美观
          description: '适用于救援、巡逻与长时间值守任务，续航与负载能力均衡',
          price: 68000
        },
        {
          id: 'diesel-d02',
          label: 'D02 型柴油发动机',
          description: '适用于救援、巡逻与长时间值守任务，续航与负载能力均衡',
          price: 58000
        }
      ]
    }
  ],  
  // -----------------
  focusTargets: {}
}

function getEngineCategoryLabel(engineCategory) {
  const category = BOAT_ENGINE_CATEGORY_OPTIONS.find(item => item.StrID === engineCategory)
  return category?.Label ?? ''
}

function formatPrice(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0
  }).format(value)
}

function getModelReferencePrice(boat) {
  const candidate = `${boat?.price ?? ''}`.trim()
  if (!candidate) {
    return null
  }

  const amount = Number(candidate)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return amount
}

function getModelReferencePriceLabel(boat) {
  const amount = getModelReferencePrice(boat)
  if (amount === null) {
    return ''
  }

  return `参考价 ${formatPrice(amount)}`
}

function normalizeBasePath(basePath) {
  const normalizedValue = `${basePath ?? ''}`.trim()
  if (!normalizedValue) {
    return '/'
  }

  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}

function buildApiUrl(basePath, path) {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedPath = `${path ?? ''}`.replace(/^\/+/, '')
  return `${normalizedBasePath}${normalizedPath}`
}

function getCategoryForModel(model) {
  const explicitType = `${model?.type ?? ''}`.trim()
  if (explicitType) {
    return explicitType
  }

  const label = `${model?.label ?? model?.id ?? ''}`.toLowerCase()
  if (label.includes('yacht') || label.includes('游艇')) {
    return '游艇'
  }
  if (label.includes('two')) {
    return '公务执法艇'
  }
  if (label.includes('test') || label.includes('pleasure')) {
    return '新能源船'
  }
  return '应急救援船'
}

function getModelCaption(boat) {
  const specs = boat ?? {}
  if (specs.mainEnginePower) {
    return `主机功率 ${specs.mainEnginePower}`
  }
  if (specs.designSpeed) {
    return `设计航速 ≥ ${specs.designSpeed} km/h`
  }
  if (specs.navigationArea) {
    return specs.navigationArea
  }
  return boat?.id ?? ''
}

function normalizeOrderConfig(orderConfig) 
{
  const config = orderConfig ?? {}
  return {
    appearanceOptions: Array.isArray(config.appearanceOptions) ? config.appearanceOptions : [],
    colorOptions: Array.isArray(config.colorOptions) ? config.colorOptions : [],
    interiorOptions: Array.isArray(config.interiorOptions) ? config.interiorOptions : [],
    powerTypes: Array.isArray(config.powerTypes) ? config.powerTypes : [], 
    focusTargets: config.focusTargets && Object.keys(config.focusTargets).length ? config.focusTargets : {}
  }
}
 
// 创建一个增强的模型对象，包含 primaryModelInfo
function createAugmentedModel(boat) {
  if (!boat) return null;
  const primaryModelInfo = boat.models?.[0] ?? null;
  if (!primaryModelInfo) {
    return {
      ...boat,
      primaryModelInfo: null,
    };
  }
  return {
    ...boat,
    primaryModelInfo: primaryModelInfo,
  };
}

// 1. 定义一个独立的发动机详情组件
function EngineDetails({ engine }) {
  if (!engine) return null;

  const isFuel = engine.engineCategoryID === "diesel" || engine.engineCategoryID === "gasoline";

  return (
    <div style={{ marginTop: '15px', padding: '15px', border: '1px solid #eee',
                  borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#555' }}>
        {engine.description}
      </p>
      <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#555' }}>
        额定功率：{engine.powerKW}KW
      </p>
      
      {/* 巧用三元或与运算符，避免大段重复的 HTML */}
      {isFuel ? (
        <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#555' }}>
          燃油排量：{engine.displacement}L
        </p>
      ) : (
        <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#555' }}>
          额定电池容量：{engine.batteryKWh}kWh
        </p>
      )}
    </div>
  );
}

export default function OrderPage() {
  const {
    categoryMenus,
    boats,
    primaryModel,
    selectedModelGid,
    onSelectModel,
    remoteFbxOrigin,
    apiBasePath = '/'
  } = useOutletContext();

  const productCategories = useMemo(() => { 
    // 如果modelsByCategory是数组 && 有长度
    if (categoryMenus && categoryMenus.length > 0) {
      return categoryMenus.map(item => ({
        id: item.id,
        label: item.label
      }));
    }
    // 备用
    return vesselCategoryMenus;
  }, [categoryMenus]); // vesselCategoryMenus 是常量，无需作为依赖
  console.log("OrderPage:productCategories=",productCategories)

  const currentModel = useMemo(() => {
    // 1. 优先使用手动指定的模型
    if (primaryModel) {
      console.log("OrderPage:0:primaryModel=",primaryModel,",selectedModelGid=",selectedModelGid)
      return primaryModel;
    }
    console.log("OrderPage:1.0:selectedModelGid=",selectedModelGid)
    // 🔴 安全判断 
    if (!boats || boats.length === 0 || !selectedModelGid) {
      return null;
    } 
    console.log("OrderPage:1:selectedModelGid=",selectedModelGid)
    // 2. 根据 selectedModelGid.boatId 找船
    const boat = boats.find((boat) => boat.id === selectedModelGid.boatId) ?? boats[0];
 
    // 3. 精确匹配 modelId，找不到就用第一个模型
    console.log("OrderPage:2:boat=",boat)
    const primaryModelInfo =
      boat.models?.find((model) => model.id === selectedModelGid.modelId) ??
      boat.models?.[0] ??
      null;

    if (!primaryModelInfo) { // 4. 没有模型也返回 null
      return null;
    }

    // 4. 返回最终结构
    return {
      ...boat,
      primaryModelInfo: primaryModelInfo,
    };
  }, [primaryModel, boats, selectedModelGid]);

 


  // category 英文id
  const [selectedCategory, setSelectedCategory] = useState(currentModel?.category ?? '')


  // currentOrderConfig
  const currentOrderConfig = useMemo(
    () => normalizeOrderConfig(DEFAULT_ORDER_CONFIG), //(currentModel?.primaryModelInfo?.orderConfig), 
    [currentModel?.primaryModelInfo])
  const [loadedFocusTargets, setLoadedFocusTargets] = useState(currentOrderConfig.focusTargets)
  const [selectedAppearanceId, setSelectedAppearanceId] = useState(currentOrderConfig.appearanceOptions[0]?.id ?? '')
  const [selectedInteriorId, setSelectedInteriorId] = useState(currentOrderConfig.interiorOptions[0]?.id ?? '')

  const [selectedPowerId, setSelectedPowerId] = useState(currentOrderConfig.powerTypes[0]?.id ?? '')
  const [selectedEngineId, setSelectedEngineId] = useState('');

  // Derived state for active power type and engine
   
  // 
  const [activeConfigStep, setActiveConfigStep] = useState('船型')
  const [activeOrderStage, setActiveOrderStage] = useState('config')
  const [exteriorColor, setExteriorColor] = useState('#FFFFFF')      // 船体
  const [interiorColor, setInteriorColor] = useState('#FFFFFF') // 内饰
  const [deckColor, setDeckColor] = useState('#FFFFFF')       // 甲板
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const compactStepWheelLockRef = useRef({
    step: '',
    direction: 0,
    unlockAt: 0
  })
  const programmaticStepScrollRef = useRef({
    step: '',
    releaseAt: 0,
    timerId: null
  })

  // 视角切换操作台
  const viewTogglePortalTargetRef = useRef(null)

  useEffect(() => {
    if (currentModel) {
      // currentModel.category english
      setSelectedCategory(currentModel.category) 
    }
  }, [currentModel])


  const filteredBoats = useMemo(
    () => Array.isArray(boats) 
    ? boats.filter((boat) => boat.category === selectedCategory)
    : [],
    [boats, selectedCategory]
  )

  const activeModel = useMemo(() => {
    
    if (currentModel) {
      console.log("activeModel =currentModel=",currentModel )
      return currentModel;
    }
    if (filteredBoats[0]) {
      console.log("activeModel =filteredBoats[0]=",filteredBoats[0] )
      return createAugmentedModel(filteredBoats[0]);
    }
    if (boats[0]) {
      console.log("activeModel =boats[0]=",boats[0] )
      return createAugmentedModel(boats[0]);
    }
    return null;
  }, [currentModel, filteredBoats, boats]);

  const modelConfig = useMemo(() => {  
    return buildModel4ShipScene(
      activeModel?.primaryModelInfo,
      remoteFbxOrigin
    );
  }, [activeModel?.primaryModelInfo?.id, remoteFbxOrigin]);

  // -----------

  useEffect(() => {
    const nextConfig = normalizeOrderConfig(activeModel?.orderConfig)

    setSelectedAppearanceId(
      (current) => nextConfig.appearanceOptions.some((item) => item.id === current) 
                  ? current : (nextConfig.appearanceOptions[0]?.id ?? ''))
 

    setSelectedInteriorId((current) => nextConfig.interiorOptions.some((item) => item.id === current) 
                  ? current : (nextConfig.interiorOptions[0]?.id ?? ''))

    setSelectedPowerId((current) => boundEngines?.some((item) => item.engineCategoryID === current) 
                  ? current : (boundEngines?.[0]?.engineCategoryID ?? ''))

  }, [activeModel])  

  // --- 引擎 ---- 
  const { boundEngines, uniqueEngineCategoryIds } = useMemo(() => {
    const engines = activeModel?.primaryModelInfo?.boundEngines || [];
    const categories = [...new Set(engines.map(item => item.engineCategoryID))];
    console.log("useMemo: boundEngines=", engines, "uniqueEngineCategoryIds=", categories);
    return {
      boundEngines: engines,
      uniqueEngineCategoryIds: categories
    };
  }, [activeModel]);

  const activeCategoryEngines = useMemo(() => {  
    const filtered = boundEngines?.filter(
        (engine) => `${engine.engineCategoryID}` === `${selectedPowerId}`
      )  
    console.log("useMemo: activeCategoryEngines=", filtered, "selectedPowerId=", selectedPowerId);
    return filtered;
  }, [boundEngines, selectedPowerId]);

  const activeEngine = useMemo(() => { 
    if (!activeCategoryEngines || activeCategoryEngines.length === 0) {
        console.log("useMemo: activeEngine=null (no activeCategoryEngines)");
        return null;
    }
    
    // 优先根据用户选择的 selectedEngineId 匹配
    const found = activeCategoryEngines.find(e => `${e.ID}` === `${selectedEngineId}`);
    if (found) {
      console.log("useMemo: activeEngine=found", found);
      return found;
    }

    // 如果找不到（说明刚切换了动力类型，ID对不上），则保底返回当前动力类型下的第一个 
    console.log("useMemo: activeEngine=first in category", activeCategoryEngines[0]);
    return activeCategoryEngines[0] || null; 
  }, [activeCategoryEngines, selectedEngineId]);

  // Effect to update selectedEngineId when selectedPowerId changes
  useEffect(() => {
    console.log("useEffect: activeCategoryEngines changed", activeCategoryEngines);
    if (activeCategoryEngines && activeCategoryEngines.length > 0) {
      console.log("useEffect: Setting selectedEngineId to", activeCategoryEngines[0].id);
      setSelectedEngineId(activeCategoryEngines[0].id);
    } else {
      console.log("useEffect: Clearing selectedEngineId");
      setSelectedEngineId('');
    }
  }, [activeCategoryEngines]);

  // ---- category 选择
  const handleCategorySelect = (aCategory) => {
    

    setSelectedCategory(aCategory.id)
    setActiveConfigStep('船型')

    const nextBoat = boats.find((boat) => boat.category === aCategory.id)
    console.log("^^^^^^^handleCategorySelect aCategory=",aCategory,"nextBoat=",nextBoat)    
    if (nextBoat) {
      console.log("^^^^^^^handleCategorySelect aCategory=",aCategory,"nextBoat=",nextBoat)    
      onSelectModel({boatId: nextBoat.id, modelId: nextBoat.models?.[0]?.id ?? ""})
    }
  }  

  //---- boat选择
  const [selectedBoatIdLocal, setSelectedBoatIdLocal] = useState(activeModel?.id || '');


  useEffect(() => {
    console.log("&&&&&useEffect: activeModel.id=", activeModel?.id, ", selectedBoatIdLocal=", selectedBoatIdLocal);
    if (activeModel?.id && selectedBoatIdLocal !== activeModel.id) {
      setSelectedBoatIdLocal(activeModel.id);
    }
  }, [activeModel?.id, selectedBoatIdLocal]);

  const handleBoatSelectChange = (event) => {
    const newBoatId = event.target.value;
    // console.log("handleBoatSelectChange: newBoatId=", newBoatId);
    setSelectedBoatIdLocal(newBoatId);

    const selectedBoat = filteredBoats.find(boat => boat.id === newBoatId);
    if (selectedBoat) {
      console.log("handleBoatSelectChange: selectedBoat=", selectedBoat);
      // console.log("handleBoatSelectChange: calling onSelectModel with boat.id=", selectedBoat.id);
      onSelectModel({ boatId: selectedBoat.id, modelId: selectedBoat.models?.[0]?.id ?? "" });
    }
  };

  //----model 选择
  const [selectedModelIdLocal, setSelectedModelIdLocal] = useState(activeModel?.id || '');

  const filteredModels = useMemo(
    () =>  {
      const selectedBoat = filteredBoats.find(boat => boat.id === selectedBoatIdLocal) 
      console.log( "filteredModels:: filteredBoats=",filteredBoats,
        "selectedBoatIdLocal=",selectedBoatIdLocal,
        ",,,selectedBoat=",selectedBoat,
        ",,,selectedBoat?.models=",selectedBoat?.models )
      return selectedBoat?.models || []
    },
    [filteredBoats, selectedBoatIdLocal]
  )
  

  const handleModelSelectChange = (event) => {
    const newModelId = event.target.value;
    // console.log("handleModelSelectChange:00 newModelId=", newModelId);
    setSelectedModelIdLocal(newModelId);
    console.log("handleModelSelectChange:01 newModelId=", newModelId);
    
    const selectedBoat = filteredBoats.find(boat => boat.id === selectedBoatIdLocal);
    if (selectedBoat) {
      const selectedModel = selectedBoat.models?.find(model => model.id === newModelId)

      console.log("handleModelSelectChange: selectedBoat=", selectedBoat);
      if (selectedModel) {
        console.log("handleModelSelectChange: selectedModel=", selectedModel,",,selectedBoat=",selectedBoat);
        onSelectModel({ boatId: selectedBoat.id, modelId: selectedModel.id ?? "" });
      }
    }

  };  
  // ------------------

  const { viewerFocusTarget, 
    setViewerFocusTarget, 
    viewerFocusTargets 
  } = useFocusTarget( selectedModelGid, activeModel, apiBasePath);


  //---- orderConfig
  const activeOrderConfig = useMemo(
    () => normalizeOrderConfig(activeModel?.orderConfig), 
    [activeModel])
 

  const activeAppearance = activeOrderConfig.appearanceOptions.find((item) => item.id === selectedAppearanceId) 
                        ?? activeOrderConfig.appearanceOptions[0]
  const activeColor = activeOrderConfig.colorOptions.find((item) => item.id === selectedColorId) 
                        ?? activeOrderConfig.colorOptions[0]
  const activeInterior = activeOrderConfig.interiorOptions.find((item) => item.id === selectedInteriorId) 
                        ?? activeOrderConfig.interiorOptions[0]
  const activePower = activeOrderConfig.powerTypes.find((item) => item.id === selectedPowerId) 
                        ?? activeOrderConfig.powerTypes[0]
  const activeModelReferencePrice = getModelReferencePrice(activeModel)
  const activeModelReferencePriceLabel = getModelReferencePriceLabel(activeModel)
   
  const totalPrice = (activeModelReferencePrice ?? 0)
    + (activeAppearance?.price ?? 0)
    + (activeColor?.surcharge ?? 0)
    + (activeInterior?.price ?? 0)
    + (activeEngine?.price ?? 0) 

  useEffect(() => {
    const updateActiveStage = () => {
      const modelSection = document.getElementById('order-section-model')
      const submitSection = document.getElementById('order-section-submit')
      if (!modelSection) {
        return
      }

      const probeLine = 140
      const modelRect = modelSection.getBoundingClientRect()
      const submitRect = submitSection?.getBoundingClientRect()

      if (submitRect && submitRect.top <= probeLine + 40) {
        setActiveOrderStage('submit')
        return
      }

      if (modelRect.bottom > probeLine) {
        setActiveOrderStage('model')
        return
      }

      setActiveOrderStage('config')
    }

    updateActiveStage()
    window.addEventListener('scroll', updateActiveStage, { passive: true })
    window.addEventListener('resize', updateActiveStage)

    return () => {
      window.removeEventListener('scroll', updateActiveStage)
      window.removeEventListener('resize', updateActiveStage)
    }
  }, [])

  useEffect(() => {
    const stepEntries = Object.entries(sectionIds)

    const updateActiveConfigStep = () => {
      const programmaticScroll = programmaticStepScrollRef.current
      if (programmaticScroll.step && performance.now() < programmaticScroll.releaseAt) {
        setActiveConfigStep((previous) => (
          previous === programmaticScroll.step ? previous : programmaticScroll.step
        ))
        return
      }

      const viewportProbe = 180
      let currentStep = configurationSteps[0]
      let bestDistance = Number.POSITIVE_INFINITY

      stepEntries.forEach(([step, sectionId]) => {
        const element = document.getElementById(sectionId)
        if (!element) {
          return
        }

        const rect = element.getBoundingClientRect()
        const distance = Math.abs(rect.top - viewportProbe)

        if (rect.top <= viewportProbe && rect.bottom >= viewportProbe) {
          currentStep = step
          bestDistance = -1
          return
        }

        if (bestDistance !== -1 && distance < bestDistance) {
          currentStep = step
          bestDistance = distance
        }
      })

      setActiveConfigStep((previous) => (previous === currentStep ? previous : currentStep))
    }

    updateActiveConfigStep()
    window.addEventListener('scroll', updateActiveConfigStep, { passive: true })
    window.addEventListener('resize', updateActiveConfigStep)

    return () => {
      window.removeEventListener('scroll', updateActiveConfigStep)
      window.removeEventListener('resize', updateActiveConfigStep)
      if (programmaticStepScrollRef.current.timerId) {
        window.clearTimeout(programmaticStepScrollRef.current.timerId)
      }
    }
  }, [])

  useEffect(() => {
    const getStepIndex = (step) => configurationSteps.indexOf(step)
    const isCompactSection = (element) => (
      element.scrollHeight <= Math.max(window.innerHeight * COMPACT_STEP_HEIGHT_RATIO, 420)
    )

    const handleWheelGate = (event) => {
      if (event.defaultPrevented || Math.abs(event.deltaY) < MIN_WHEEL_DELTA) {
        return
      }

      const direction = Math.sign(event.deltaY)
      const currentIndex = getStepIndex(activeConfigStep)
      if (currentIndex < 0) {
        return
      }

      const nextStep = configurationSteps[currentIndex + direction]
      if (!nextStep) {
        return
      }

      const currentSection = document.getElementById(sectionIds[activeConfigStep])
      const nextSection = document.getElementById(sectionIds[nextStep])
      const configColumn = document.querySelector('.order-config-column')
      if (!currentSection || !nextSection || !configColumn || !isCompactSection(currentSection)) {
        return
      }

      const columnRect = configColumn.getBoundingClientRect()
      const currentRect = currentSection.getBoundingClientRect()
      const viewportProbe = 180
      const isInsideConfigColumn = columnRect.top < window.innerHeight && columnRect.bottom > viewportProbe
      const isNearCurrentStep = currentRect.top <= viewportProbe + 48 && currentRect.bottom >= viewportProbe - 48
      if (!isInsideConfigColumn || !isNearCurrentStep) {
        return
      }

      const now = performance.now()
      const lock = compactStepWheelLockRef.current
      if (lock.direction === direction && now < lock.unlockAt) {
        event.preventDefault()
        return
      }

      event.preventDefault()
      compactStepWheelLockRef.current = {
        step: nextStep,
        direction,
        unlockAt: now + COMPACT_STEP_WHEEL_LOCK_MS
      }
      if (programmaticStepScrollRef.current.timerId) {
        window.clearTimeout(programmaticStepScrollRef.current.timerId)
      }
      programmaticStepScrollRef.current = {
        step: nextStep,
        releaseAt: now + COMPACT_STEP_WHEEL_LOCK_MS + 260,
        timerId: window.setTimeout(() => {
          programmaticStepScrollRef.current = {
            step: '',
            releaseAt: 0,
            timerId: null
          }
        }, COMPACT_STEP_WHEEL_LOCK_MS + 280)
      }
      setActiveConfigStep(nextStep)
      window.scrollTo({
        top: Math.max(nextSection.getBoundingClientRect().top + window.scrollY - CONFIG_STEP_SCROLL_OFFSET, 0),
        behavior: 'smooth'
      })
    }

    window.addEventListener('wheel', handleWheelGate, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheelGate)
    }
  }, [activeConfigStep])


 
  const handleStepJump = (step) => {
    setActiveConfigStep(step)
    const targetId = sectionIds[step]
    if (!targetId) {
      return
    }

    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleOrderStageSelect = (nextStage) => {
    setActiveOrderStage(nextStage)

    if (nextStage === 'model') {
      handleStepJump('船型')
      return
    }

    if (nextStage === 'config') {
      document.querySelector('.order-config-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    document.getElementById('order-section-submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePowerCategorySelect = (cateId) => {
    // 1. 先更新动力类型
    setSelectedPowerId(cateId); 
    
    // 2. 🌟 核心修复：找出这个新动力类型下的所有发动机
    const newBoundEngines = boundEngines.filter(e => e.engineCategoryID === cateId);
    
    // 3. 如果有发动机，就把选择的发动机 ID 默认设为第一个；如果没有，就设为空字符串
    if (newBoundEngines.length > 0) {
      setSelectedEngineId(newBoundEngines[0].ID);
    } else {
      setSelectedEngineId('');
    }
  }

   const handleSubmitOrder = async () => {
    if (!activeModel) {
      setSubmitError('当前没有可提交的船型，请先选择船型。')
      return
    }

    const normalizedCustomerName = customerName.trim()
    const normalizedCustomerContact = customerContact.trim()
    if (!normalizedCustomerName) {
      setSubmitError('请填写称呼方式。')
      return
    }
    if (!normalizedCustomerContact) {
      setSubmitError('请填写联系方式。')
      return
    }

    setIsSubmittingOrder(true)
    setSubmitError('')

    try {
      const response = await fetch(buildApiUrl(apiBasePath, '/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: activeModel.id,
          modelLabel: activeModel.label,
          customerName: normalizedCustomerName,
          customerContact: normalizedCustomerContact,
          category: activeModel.type || getCategoryForModel(activeModel),
          appearanceLabel: activeAppearance?.label ?? '',
          colorLabel: activeColor?.label ?? '',
          colorHex: activeColor?.hex ?? '',
          interiorLabel: activeInterior?.label ?? '',
          powerLabel: activePower?.label ?? '',
          totalPrice,
          source: 'showcase-web'
        })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? `提交失败，状态码 ${response.status}`)
      }

      const orderId = `${payload?.order?.id ?? ''}`.trim()
      window.location.hash = orderId
        ? `#/order-success?order=${encodeURIComponent(orderId)}`
        : '#/order-success'
    } catch (error) {
      setSubmitError(error.message || '提交方案意向失败，请稍后再试。')
    } finally {
      setIsSubmittingOrder(false)
    }
  } 
 

  // if (!activeModel) {
  //   return (
  //     <div className="page-loading" style={{ textAlign: 'center', paddingTop: '100px', color: '#f5f5f7' }}>
  //       <h2>正在加载模型数据...</h2>
  //       <p>如果长时间没有响应，请尝试 <Link to="/">返回首页</Link> 并重新选择。</p>
  //     </div>
  //   );
  // }

  return (
    <div className="order-page">
      <header className="order-topbar">
        <div className="order-topbar-inner">
          <Link className="order-back-link" to="/">返回首页</Link>
          <div className="order-progress" aria-label="订购流程">
            {orderStageOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`order-progress-step ${activeOrderStage === option.id ? 'active' : ''}`}
                onClick={() => handleOrderStageSelect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>
 
      <main className="order-shell">
        <section className="order-visual-column">
            
          <div className="order-visual-sticky">
            <div className="order-scene-panel">
              {activeModel ? (
                (() => { 
                  if (!modelConfig.partPaths?.length) {
                    console.log("error: modelConfig is empty::", modelConfig);
                    return null;
                  }
                  
                  return (
                    <main className="capture-screen" style={{ width: '100%', height: '100%' }}>
                      <div className="capture-scene-shell" style={{ width: '100%', height: '100%' }}>
                        <ShipScene 
                          modelConfig={modelConfig}
                          focusTarget={viewerFocusTarget}
                          focusTargetPresets={viewerFocusTargets}
                          focusTargetStrategy="console-driven"
                          onFocusTargetChange={setViewerFocusTarget}                          
                          colorConfig={{
                             mat_part01_color : exteriorColor ,
                             mat_part02_color : interiorColor ,
                             mat_part03_color : deckColor  ,                              
                          }}
                          overviewZoomScale={0.82}
                          viewTogglePortalTarget={viewTogglePortalTargetRef.current}
                        />
                      </div>
                    </main>
                  );
                })()
              ) : (
                <div className="order-scene-empty">暂无可预览模型</div>
              )}
            </div>
          </div>
        </section>

        <section className="order-config-column">
          <div ref={viewTogglePortalTargetRef} />
          <div className="order-config-nav" aria-label="配置导航">
            {configurationSteps.map((item) => (
              <button  key={item}  type="button"
                className={`order-config-nav-item ${activeConfigStep === item ? 'active' : ''}`}
                onClick={() => handleStepJump(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <section id="order-section-model" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">01</p>
              <div>
                <h2>船型</h2>
                <p>先确认适用场景，再选择对应船型。不同船型会带出不同的配置词条。</p>
              </div>
            </div>

            <div className="order-category-row" role="tablist" aria-label="船型类别">
            {productCategories.map((category) => (
              <button key={category.id} type="button"
                className={`order-category-chip ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => handleCategorySelect(category)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="order-model-selector">

          <div className="order-model-selection-row">
            <label htmlFor="boat-select" className="order-model-label">{'选择船型'}:</label>
            <select id="boat-select"  value={selectedBoatIdLocal}
              onChange={handleBoatSelectChange}
              className="order-model-dropdown"
            >
              {filteredBoats.map((boat) => (
                <option key={boat.id} value={boat.id}>
                  {boat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="order-model-selection-row">
            <label htmlFor="boat-select" className="order-model-label">{'选择样式'}:</label>
            <select id="model-select"  value={selectedModelIdLocal}
              onChange={handleModelSelectChange}
              className="order-model-dropdown"
            >
              {filteredModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>          

          
          {activeModel && (
            <div className="order-model-details">
              <div className="order-model-card-copy">
                <p className="order-model-category">{getCategoryForModel(activeModel)}</p>
                <h3>{activeModel.primaryModelInfo?.label}</h3>
                <p>{getModelCaption(activeModel)}</p>
                {getModelReferencePriceLabel(activeModel) && (
                  <p className="order-model-card-price">{getModelReferencePriceLabel(activeModel)}</p>
                )}
              </div>
            </div>
          )}
        </div>
          </section>

          <section id="order-section-appearance" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">02</p>
              <div>
                <h2>颜色定制</h2>
                <div className="order-config-item" 
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'nowrap' }}>
                  <div className="order-config-item-label" 
                       style={{ width: '110px', flexShrink: 0 }}>外观颜色：</div>
                  <input type="color" value={exteriorColor} 
                         onChange={(e) => setExteriorColor(e.target.value)} 
                         style={{ width: '40px', height: '24px', border: 'none', padding: '0' }} />
                  <span>{exteriorColor}</span>
                </div>
                <div className="order-config-item" 
                     style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'nowrap' }}>
                  <div className="order-config-item-label" 
                       style={{ width: '110px', flexShrink: 0 }}>内饰颜色：</div>
                  <input type="color" value={interiorColor} 
                        onChange={(e) => setInteriorColor(e.target.value)} 
                        style={{ width: '40px', height: '24px', border: 'none', padding: '0' }} />
                  <span>{interiorColor}</span>
                </div>
                <div className="order-config-item" 
                   style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'nowrap' }}>
                  <div className="order-config-item-label" style={{ width: '110px', flexShrink: 0 }}>甲板颜色：</div>
                  <input type="color" value={deckColor} 
                      onChange={(e) => setDeckColor(e.target.value)} 
                      style={{ width: '40px', height: '24px', border: 'none', padding: '0' }} />
                  <span>{deckColor}</span>
                </div>
              </div>  
            </div>
 
          </section>

  
          <section id="order-section-power" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">03</p>
              <div>
                <h2>动力</h2>
                <p>按航区、载荷与任务强度选择动力方案。</p>
              </div>
            </div>

            <div className="order-option-stack">
              <div style={{ marginBottom: '10px' }}>动力类型：</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {uniqueEngineCategoryIds.length === 0 ? (
                  <span style={{ color: '#999' }}>暂无动力类型</span>
                ) : (
                  uniqueEngineCategoryIds.map((cateId, index) => {
                    // 建议：直接把判断选中的逻辑提出来，清晰可读
                    const isChecked = selectedPowerId === cateId; 
                    const labelText = getEngineCategoryLabel(cateId);

                    return (
                      <label key={`power-cate-${cateId}`} 
                        className={`order-radio-card ${isChecked ? 'active' : ''}`}
                        style={{ flex: '1 1 calc(33.333% - 10px)', boxSizing: 'border-box', cursor: 'pointer' }} // 增加手势
                      >
                        <input  type="radio" checked={isChecked}
                          onChange={() => handlePowerCategorySelect(cateId)} 
                        />
                        <div>
                          <h3 style={{ margin: 0, fontSize: '14px' }}>
                            {labelText}
                          </h3>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            {/* Engine Selection Dropdown and Details */} 
            { activeCategoryEngines.length > 0 && (
              <div className="order-option-stack" style={{ marginTop: '20px' }}>
                <label htmlFor="engine-select" className="order-model-label">选择发动机:</label>
                <select id="engine-select" value={selectedEngineId}
                  onChange={(e) => setSelectedEngineId(e.target.value)}
                  className="order-model-dropdown"
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  {/* 🌟 修改 2：在这里直接一边过滤一边 map */}
                  {activeCategoryEngines .map((engine) => (
                      <option key={engine.ID} value={engine.ID}>
                        {engine.engineName}
                      </option>
                    ))
                  }
                </select>

                {/* 当前发动机的详情子组件 */}
                <EngineDetails engine={activeEngine} />
              </div>
            )}
            
          </section>

          <section id="order-section-submit" className="order-summary-card">
            <p className="order-kicker">配置摘要</p>
            <h2>{activeModel?.primaryModelInfo?.label ?? '未选择船型'}</h2>

            <div className="order-summary-list">
              <div>
                <span>船型</span>
                <strong>{activeModel?.primaryModelInfo?.label ?? '-'}</strong>
              </div>
              {activeModelReferencePriceLabel && (
                <div>
                  <span>船型参考价</span>
                  <strong>{formatPrice(activeModelReferencePrice)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>外观颜色</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: exteriorColor, border: '1px solid #ccc', marginRight: '8px' }}></div>
                  <strong>{exteriorColor}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>内饰颜色</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: interiorColor, border: '1px solid #ccc', marginRight: '8px' }}></div>
                  <strong>{interiorColor}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>甲板颜色</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: deckColor, border: '1px solid #ccc', marginRight: '8px' }}></div>
                  <strong>{deckColor}</strong>
                </div>
              </div>              
              <div>
                <span>动力</span>
                
                { (() => {                   
                  // 如果找不到（比如刚切换了动力类型，ID还没对上），就什么都不渲染，防止报错
                  if (!activeEngine) return (
                    <strong>{'-'}</strong>
                  );
                  
                  return (
                    <strong>{activeEngine?.engineName }</strong>
                  );
                })()}
                
              </div>

            </div>
 

            <div className="order-total">
              <span>参考总价</span>
              <strong>{formatPrice(totalPrice)}</strong>
            </div>

            <div className="order-contact-form" aria-label="联系方式">
              <div className="order-contact-header">
                <p>方案跟进信息</p>
                <span>销售顾问将基于当前配置与您确认技术细节、报价范围与交付节奏。</span>
              </div>
              <label className="order-contact-field">
                <span>称呼方式</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="例如：王先生 / 李女士"
                  autoComplete="name"
                />
              </label>
              <label className="order-contact-field">
                <span>联系方式</span>
                <input
                  type="text"
                  value={customerContact}
                  onChange={(event) => setCustomerContact(event.target.value)}
                  placeholder="手机号 / 微信 / 邮箱，任选一种即可"
                  autoComplete="tel"
                />
              </label>
            </div>

            {submitError && (
              <p className="order-submit-error">{submitError}</p>
            )}

            <div className="order-actions">
              <button
                type="button"
                className="btn primary"
                onClick={handleSubmitOrder}
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? '提交中...' : '提交订购意向'}
              </button>

              <a className="mini-btn order-secondary-btn" href="#experience">返回 3D 体验</a>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}