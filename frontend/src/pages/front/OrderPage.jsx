import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom';

import ShipScene from '../scene3d/ShipScene'
import { vesselCategoryMenus } from '../../constants/constants_front_homepage.js'
import { buildModel4ShipScene } from '../../utils/utils_ship_scene'
 
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
  powerOptions: [
    {
      id: 'dual-electric-standard',
      label: '高效巡航动力',
      description: '兼顾静音巡航、日常接待与中短途运营，适合作为标准交付方案',
      price: 368000
    },
    {
      id: 'dual-electric-performance',
      label: '高性能任务动力',
      description: '提升加速响应与连续航行稳定性，适合高频使用与更复杂水域',
      price: 428000
    },
    {
      id: 'hybrid-rescue',
      label: '混动应急动力',
      description: '面向救援、巡逻与长时间值守任务，兼顾续航和负载能力',
      price: 468000
    }
  ], 
  focusTargets: {}
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
    powerOptions: Array.isArray(config.powerOptions) ? config.powerOptions : [], 
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
    () => normalizeOrderConfig(currentModel?.primaryModelInfo?.orderConfig), 
    [currentModel?.primaryModelInfo])
  const [loadedFocusTargets, setLoadedFocusTargets] = useState(currentOrderConfig.focusTargets)
  const [selectedAppearanceId, setSelectedAppearanceId] = useState(currentOrderConfig.appearanceOptions[0]?.id ?? '')
  const [selectedInteriorId, setSelectedInteriorId] = useState(currentOrderConfig.interiorOptions[0]?.id ?? '')
  const [selectedPowerId, setSelectedPowerId] = useState(currentOrderConfig.powerOptions[0]?.id ?? '')
 

  // 
  const [activeConfigStep, setActiveConfigStep] = useState('船型')
  const [activeOrderStage, setActiveOrderStage] = useState('config')
  const [exteriorColor, setExteriorColor] = useState('#EAEAEA')      // 船体
  const [interiorColor, setInteriorColor] = useState('#332E2B') // 内饰
  const [deckColor, setDeckColor] = useState('#995522')       // 甲板
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

  useEffect(() => {
    if (currentModel) {
      // currentModel.category english
      setSelectedCategory(currentModel.category) 
    }
  }, [currentModel])

  useEffect(() => {
    const nextConfig = normalizeOrderConfig(currentModel?.orderConfig)

    setSelectedAppearanceId(
      (current) => nextConfig.appearanceOptions.some((item) => item.id === current) 
                  ? current : (nextConfig.appearanceOptions[0]?.id ?? ''))
 

    setSelectedInteriorId((current) => nextConfig.interiorOptions.some((item) => item.id === current) 
                  ? current : (nextConfig.interiorOptions[0]?.id ?? ''))

    setSelectedPowerId((current) => nextConfig.powerOptions.some((item) => item.id === current) 
                  ? current : (nextConfig.powerOptions[0]?.id ?? ''))

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
    console.log("handleModelSelectChange:00 newModelId=", newModelId);
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

  //---- orderConfig
  const activeOrderConfig = useMemo(
    () => normalizeOrderConfig(activeModel?.orderConfig), 
    [activeModel])

  const effectiveFocusTargets = loadedFocusTargets && Object.keys(loadedFocusTargets).length
    ? loadedFocusTargets
    : activeOrderConfig.focusTargets

  useEffect(() => {
    setLoadedFocusTargets(activeOrderConfig.focusTargets)
  }, [activeOrderConfig.focusTargets, currentModel?.id])

  useEffect(() => {
    if (!currentModel?.id) {
      setLoadedFocusTargets({})
      return
    }

    let cancelled = false

    const loadFocusTargets = async () => {
      try {
        const response = await fetch(buildApiUrl(apiBasePath, `api/models/${encodeURIComponent(currentModel.id)}/focus-targets`))
        if (!response.ok) {
          throw new Error(`Failed to load focus targets: ${response.status}`)
        }

        const payload = await response.json()
        if (!cancelled) {
          setLoadedFocusTargets(payload?.focusTargets ?? {})
        }
      } catch (error) {
        console.error(`Failed to load focus targets for ${currentModel.id}:`, error)
        if (!cancelled) {
          setLoadedFocusTargets(activeOrderConfig.focusTargets)
        }
      }
    }

    loadFocusTargets()

    return () => {
      cancelled = true
    }
  }, [activeOrderConfig.focusTargets, apiBasePath, currentModel?.id])

  const activeAppearance = activeOrderConfig.appearanceOptions.find((item) => item.id === selectedAppearanceId) 
                        ?? activeOrderConfig.appearanceOptions[0]
  const activeColor = activeOrderConfig.colorOptions.find((item) => item.id === selectedColorId) 
                        ?? activeOrderConfig.colorOptions[0]
  const activeInterior = activeOrderConfig.interiorOptions.find((item) => item.id === selectedInteriorId) 
                        ?? activeOrderConfig.interiorOptions[0]
  const activePower = activeOrderConfig.powerOptions.find((item) => item.id === selectedPowerId) 
                        ?? activeOrderConfig.powerOptions[0]
  const activeModelReferencePrice = getModelReferencePrice(activeModel)
  const activeModelReferencePriceLabel = getModelReferencePriceLabel(activeModel)
  
  const sceneFocusTarget = 'exterior'

  const totalPrice = (activeModelReferencePrice ?? 0)
    + (activeAppearance?.price ?? 0)
    + (activeColor?.surcharge ?? 0)
    + (activeInterior?.price ?? 0)
    + (activePower?.price ?? 0) 

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

  if (!currentModel) {
    return (
      <div className="page-loading" style={{ textAlign: 'center', paddingTop: '100px', color: '#f5f5f7' }}>
        <h2>正在加载模型数据...</h2>
        <p>如果长时间没有响应，请尝试 <Link to="/">返回首页</Link> 并重新选择。</p>
      </div>
    );
  }

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
                    <main className="capture-screen">
                      <div className="capture-scene-shell">
                        <ShipScene 
                          modelConfig={modelConfig}
                          focusTarget={sceneFocusTarget}
                          focusTargetPresets={effectiveFocusTargets}
                          colorConfig={{
                             mat_part01_color : exteriorColor ,
                             mat_part02_color : interiorColor ,
                             mat_part03_color : deckColor  ,                              
                          }}
                          overviewZoomScale={0.82}
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
          <div className="order-config-nav" aria-label="配置导航">
            {configurationSteps.map((item) => (
              <button
                key={item}
                type="button"
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
              <button
                key={category.id}
                type="button"
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
            <select
              id="boat-select"
              value={selectedBoatIdLocal}
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
            <select
              id="model-select"
              value={selectedModelIdLocal}
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
                       style={{ width: '110px', flexShrink: 0 }}>船体颜色：</div>
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

            <div className="order-option-stack">
              {activeOrderConfig.appearanceOptions.map((option) => (
                <label key={option.id} className={`order-radio-card ${selectedAppearanceId === option.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="appearanceOption"
                    checked={selectedAppearanceId === option.id}
                    onChange={() => setSelectedAppearanceId(option.id)}
                  />
                  <div>
                    <h3>{option.label}</h3>
                    <p>{option.description}</p>
                  </div>
                  <strong>{option.price > 0 ? formatPrice(option.price) : '标准'}</strong>
                </label>
              ))}
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
              {activeOrderConfig.powerOptions.map((option) => (
                <label key={option.id} className={`order-radio-card ${selectedPowerId === option.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="powerOption"
                    checked={selectedPowerId === option.id}
                    onChange={() => setSelectedPowerId(option.id)}
                  />
                  <div>
                    <h3>{option.label}</h3>
                    <p>{option.description}</p>
                  </div>
                  <strong>{formatPrice(option.price)}</strong>
                </label>
              ))}
            </div>
          </section>

          <section id="order-section-submit" className="order-summary-card">
            <p className="order-kicker">配置摘要</p>
            <h2>{activeModel?.label ?? '未选择船型'}</h2>

            <div className="order-summary-list">
              <div>
                <span>船型</span>
                <strong>{activeModel?.label ?? '-'}</strong>
              </div>
              {activeModelReferencePriceLabel && (
                <div>
                  <span>船型参考价</span>
                  <strong>{formatPrice(activeModelReferencePrice)}</strong>
                </div>
              )}
              <div>
                <span>外观</span>
                <strong>{activeAppearance?.label ?? '-'}</strong>
              </div>
              <div>
                <span>内饰</span>
                <strong>{activeInterior?.label ?? '-'}</strong>
              </div>
              <div>
                <span>动力</span>
                <strong>{activePower?.label ?? '-'}</strong>
              </div>
              <div>
                <span>船体颜色</span>
                <strong>{activeColor?.label ?? '-'}</strong>
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