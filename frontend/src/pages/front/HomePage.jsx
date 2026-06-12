import { useEffect, useMemo, useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { getFrontBoatModels, getSiteContent, getFrontVideos } from '../../apis/frontApi';
import { usePointerGlow, useGlobalMenuClose } from '../../hooks/useUIEvents';
import { MODEL_STORAGE_KEY } from '../../constants/constants_front_homepage';
import { buildUrl, buildUrls} from '../../utils/format'
import { buildModel4ShipScene } from '../../utils/utils_ship_scene.js'

import {
  buildComparisonSpecSections,
  buildViewerSpecItems,
  getCategoryIdForModel,
  getModelDetailImageAssetPath,
  getModelDisplayLabel,
  getModelPriceLabel,
  getRouteFromHash,
  getRuntimeBasePath,
  isCaptureModeEnabled,
  isVesselModel,
  normalizeHeroContent,
  normalizeSiteSettings,
  getStaticAssetBaseUrl,
  getRequestedModelId,
} from '../../utils/utils_homepage';
import HomepageHeader from './homepage/HomepageHeader';
import HomePageHeroScreen from './homepage/HomePageHeroScreen';
import HomePageViewerScreen from './homepage/HomePageViewerScreen';
import DetailSpecShowcase from './homepage/DetailSpecShowcase';
import DetailCompareStack from './homepage/DetailCompareStack';
import VideoShowcase from './homepage/VideoShowcase';
import EnginePowerShowcase from './homepage/EnginePowerShowcase';
import SmartSystemShowcase from './homepage/SmartSystemShowcase'; // 导入新的智能系统组件
import ShipScene from '../scene3d/ShipScene';

export default function HomePage() {
  // --- Logic migrated from App.jsx ---
  const runtimeBasePath = getRuntimeBasePath();
  const staticAssetBaseUrl = getStaticAssetBaseUrl(
    import.meta.env.VITE_STATIC_ASSET_ORIGIN,
    import.meta.env.BASE_URL
  );
  const remoteFbxOrigin = import.meta.env.VITE_REMOTE_FBX_ORIGIN || '';

  const captureMode = isCaptureModeEnabled();
  const resolveStaticPath = (relativePath) => {
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    return `${staticAssetBaseUrl}${normalizedRelativePath}`;
  };

  const location = useLocation();
  const isOrderPage = location.pathname.startsWith('/order');

  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [openCompareSelectId, setOpenCompareSelectId] = useState(null);

  const [siteContent, setSiteContent] = useState(null);
  const [boatsMap, setBoatsMap] = useState({});
  const [categoryMenus, setCategoryMenus] = useState([]);
  // Model GlobalId 包含2个字段 boatId、modelId 
  const [selectedModelGid, setSelectedModelGid] = useState(() => getRequestedModelId());
  const [videos, setVideos] = useState([]); // New state for videos

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [localSiteContent, apiBoats] = await Promise.all([
          getSiteContent(),
          getFrontBoatModels(),
        ]);

        if (localSiteContent) {
          setSiteContent(localSiteContent);
        }
        console.log('apiBoats:', apiBoats);
        if (apiBoats) {
          const { menu, boatMap } = apiBoats; 

          // 1. Directly set the menu data for the header
          setCategoryMenus(menu || []);

          // 2. Set the boat map for quick O(1) lookups
          setBoatsMap(boatMap || {});

          // 3. Set the initial model based on the first item in the menu if not already set
          if (!getRequestedModelId()) {
            const firstCategory = menu?.[1];
            const firstBoatId = firstCategory?.boats?.[0]?.id;
            const firstModelId = firstCategory?.boats?.[0]?.models?.[0]?.id;
            if (firstBoatId) {
              setSelectedModelGid({ boatId: firstBoatId, modelId: firstModelId });
            }
          }
        } else {
          console.warn('API did not return valid boat data or has incorrect structure.');
        }
      } catch (error) {
        console.error("获取首页数据失败:", error);
      }
    };

    const fetchVideos = async () => { // New function to fetch videos
      try {
        const response = await getFrontVideos();
        setVideos(response || []);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
        setVideos([]);
      }
    };

    fetchData();
    fetchVideos(); // Call the new fetchVideos function
  }, []);

  usePointerGlow();
  useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId);

  // const videos = siteContent?.videos ?? []; // Replaced by state
  const siteSettings = normalizeSiteSettings(siteContent?.settings);
  const heroContent = normalizeHeroContent(siteContent?.hero);

  const primaryModel = useMemo(() => {
    const createStructuredModel = (boatData,modelId) => {
      if (!boatData) return null;

    const primaryModelInfo = 
      boatData.models?.find(item => item.id === modelId) 
      || boatData.models?.[ boatData.models?.length -1 ] 
      || {};
      return {
        ...boatData, // boatData from API now includes id and label
        primaryModelInfo: primaryModelInfo, // Nest the specific model info
      };
    };

    if (!boatsMap) 
      return null;

    const selectBoat = boatsMap?.[selectedModelGid.boatId];
    if (selectBoat) {
      return createStructuredModel(selectBoat, selectedModelGid.modelId);
    }

    // Fallback to the first boat 
    const firstBoatKey = Object.keys(boatsMap)[0];
    if (firstBoatKey) {
      return createStructuredModel(boatsMap[firstBoatKey], selectedModelGid.modelId || "");
    }
    return null; // 如果整个 map 确实是空的，安全返回 null
  }, [selectedModelGid, boatsMap]);

  // Diagnostic useEffect to track primaryModel changes
  useEffect(() => {
    console.log('[HomePage] selectedModelGid has been updated. New value:', selectedModelGid);
    // if (primaryModel) {
    //   console.log(`[HomePage] -> primaryModel URL is: ${primaryModel.url}`);
    // } else {
    //   console.log('[HomePage] -> The primaryModel is null.');
    // }
  }, [selectedModelGid]);

  const brochurePath = resolveStaticPath(siteSettings.brochurePath);
  const heroImagePath = resolveStaticPath(siteSettings.heroImagePath);
  const maxCompareModelCount = siteSettings.compareLimit;
  
  const selectedModelLabel = getModelDisplayLabel(primaryModel) ||
    (Object.keys(boatsMap || {}).length ? '选择船型' : '正在加载船型');
  const selectedModelPriceLabel = getModelPriceLabel(primaryModel);
  
  const specImagePaths = primaryModel
    ?  primaryModel.primaryModelInfo?.adImgs?.map( (adImgPath)=>  resolveStaticPath(adImgPath))
    : '';
  console.log("^^^^HomePage::specImagePaths=",specImagePaths)    
  const viewerSpecItems = buildViewerSpecItems(primaryModel);
  const primaryDetailSpecCards = buildComparisonSpecSections(primaryModel);
  const activeCategoryId = primaryModel?.category ?? categoryMenus[0]?.id ?? null;

  const handleModelSelect = (modelGid) => {
    console.log("[HomePage] handleModelSelect triggered with ID: ", modelGid);
    // 1. 无效ID直接跳过
    if (!modelGid?.boatId ) {
      console.log("[HomePage] Aborting: invalid modelGid");
      return;
    }



    // 2. 和当前选中一样 → 不重复更新
    if (
      modelGid.boatId === selectedModelGid?.boatId &&
      modelGid.modelId === selectedModelGid?.modelId
    ) {
      console.log("[HomePage] Aborting: same model, no change");
      return;
    }

    // 3. 更新状态 + 本地存储
    setSelectedModelGid(modelGid);
    window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(modelGid));
  };

  const scrollToExperience = () => {
    document
      .getElementById('experience')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCompareSelectToggle = (modelId) => {
    if (!modelId) {
      return;
    }

    setOpenCompareSelectId((current) => (current === modelId ? null : current));
  };
console.log("^^^^HomePage::engineImgs for EnginePowerShowcase=", primaryModel?.primaryModelInfo?.engineImgs);
  // --- Original JSX from HomePage.jsx ---
  if (captureMode) 
  {
    const model4front  = primaryModel?.primaryModelInfo ; 
    if(model4front )
    {
      const finalModel = buildModel4ShipScene(model4front, remoteFbxOrigin)  
      if(finalModel.partPaths?.length > 0)
      {
        return (
          <main className="capture-screen">
            <div className="capture-scene-shell">
              <ShipScene 
                modelConfig={ {
                  id : finalModel.id,
                  label : finalModel.label,
                  partPaths: finalModel.partPaths,
                  matSlots: finalModel.matSlots
                } } 
              />
            </div>
          </main>
        );
      }else{
        console.log("error: finalModel is empty::",finalModel)
      }
    }
  }

  if (isOrderPage) {
    return (
      <Outlet
        context={{
          categoryMenus: categoryMenus,
          boats: Object.values(boatsMap),
          primaryModel,
          selectedModelGid: selectedModelGid,
          onSelectModel:    handleModelSelect,
          remoteFbxOrigin:  remoteFbxOrigin,
          apiBasePath:      runtimeBasePath,          
        }}
      />
    );
  }

  return (
    <div className="page">
      <HomepageHeader
        categoryMenus={categoryMenus}
        activeCategoryId={activeCategoryId}
        openCategoryId={openCategoryId}
        setOpenCategoryId={setOpenCategoryId}
        handleModelSelect={handleModelSelect}
        scrollToExperience={scrollToExperience}
        selectedModelGid={selectedModelGid}
        brochurePath={brochurePath}
      />

      <main className="page-main" id="top">
        <HomePageHeroScreen
          heroImagePath={heroImagePath}
          heroContent={heroContent}
          scrollToExperience={scrollToExperience}
        />

        <HomePageViewerScreen
          selectedModelGid={selectedModelGid}
          primaryModel={primaryModel}
          runtimeBasePath={runtimeBasePath}
          remoteFbxOrigin={remoteFbxOrigin}
          selectedModelLabel={selectedModelLabel}
          selectedModelPriceLabel={selectedModelPriceLabel}
          viewerSpecItems={viewerSpecItems}
        />

        <section className="detail-screen" id="details">
          <div className="detail-screen-inner">
            <DetailSpecShowcase
              specImagePaths={specImagePaths}
              selectedModelLabel={selectedModelLabel}
              selectedModelPriceLabel={selectedModelPriceLabel}
              primaryDetailSpecCards={primaryDetailSpecCards}
            />

            {/* 添加 EnginePowerShowcase 组件 */}
            <EnginePowerShowcase
              engineImgs={
                 (primaryModel?.primaryModelInfo?.engineImgs && 
                  primaryModel.primaryModelInfo.engineImgs.length > 0)
                ? primaryModel.primaryModelInfo.engineImgs
                : ['/img/electric-engine01.png']
              }          
              engineTitle={ '动力引擎参数'}
              engineParams={{
                designSpeed: primaryModel?.primaryModelInfo?.designSpeed || '0',
                cruiseSpeed: primaryModel?.primaryModelInfo?.cruiseSpeed || '0',
                cruiseRange: primaryModel?.primaryModelInfo?.cruiseRange || '0',
                cabinType: primaryModel?.primaryModelInfo?.cabinType || '开放式驾舱',
                controlMode: primaryModel?.primaryModelInfo?.controlMode || '方向盘操控',
                passengerNum: primaryModel?.primaryModelInfo?.passengerNum || '0',
              }}
            />

            {/* 添加 SmartSystemShowcase 组件 */}
            <SmartSystemShowcase
              smartSystemImgs={
                 (primaryModel?.primaryModelInfo?.smartSystemImgs && 
                  primaryModel.primaryModelInfo.smartSystemImgs.length > 0)
                ? primaryModel.primaryModelInfo.smartSystemImgs
                : ['/img/smart-system01.png', '/img/smart-system02.png']
              }   
              smartSystemTitle={primaryModel?.primaryModelInfo?.smartSystemName || '智能系统'}
              smartSystemDescription={primaryModel?.primaryModelInfo?.smartSystemDescr || '智能系统简介'}
            />

            <DetailCompareStack
              models={Object.values(boatsMap)}
              selectedModelGid={selectedModelGid}
              maxCompareModelCount={maxCompareModelCount}
              openCompareSelectId={openCompareSelectId}
              setOpenCompareSelectId={setOpenCompareSelectId}
              handleModelSelect={handleModelSelect}
              resolveStaticPath={resolveStaticPath}
            />

            <VideoShowcase videos={videos} />
          </div>
        </section>
      </main>

      <div className="mobile-cta">
        <a className="btn primary" href="#experience">
          查看 3D 船型
        </a>
      </div>
    </div>
  );
}