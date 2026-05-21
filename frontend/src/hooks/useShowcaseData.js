import { useEffect, useState } from 'react';
import {
  MODEL_STORAGE_KEY,
  DEFAULT_HERO_CONTENT,
  DEFAULT_SITE_SETTINGS,
  PREFERRED_MODEL_ID,
} from '../constants/constants_front_homepage';
import {
  isVesselModel,
  getRequestedModelId,
} from '../utils/utils_homepage';

/**
 * 一个自定义 Hook，用于加载和管理应用所需的核心展示数据。
 *
 * @param {string} route - 当前的应用路由。
 * @param {string} runtimeBasePath - API 的基础路径。
 * @param {string} staticAssetBaseUrl - 静态资源的基础 URL。
 * @returns {{
 *   modelManifest: object | null,
 *   siteContent: object,
 *   selectedModelId: string,
 *   setSelectedModelId: Function
 * }} - 返回数据状态和相关的状态设置函数。
 */
export function useShowcaseData(route, runtimeBasePath, staticAssetBaseUrl) {
  const [modelManifest, setModelManifest] = useState(null);
  const [siteContent, setSiteContent] = useState({
    settings: DEFAULT_SITE_SETTINGS,
    hero: DEFAULT_HERO_CONTENT,
    videos: [],
    models: {},
  });
  //  (当前选中的船型),
  const [selectedModelId, setSelectedModelId] = useState('');

  const resolveStaticPath = (relativePath) => `${staticAssetBaseUrl}${relativePath}`;
  const resolveApiPath = (relativePath) => `${runtimeBasePath}${relativePath}`;

  useEffect(() => {
    if (route === 'admin') {
      return undefined;
    }

    let isCancelled = false;

    const loadShowcaseData = async () => {
      try {
        const manifestUrl = resolveStaticPath('gltf/asset-manifest.json');
        const contentUrl = resolveApiPath('api/site-content');

        const [manifestResponse, contentResponse] = await Promise.all([
          fetch(manifestUrl, { cache: 'no-store' }),
          fetch(contentUrl, { cache: 'no-store' }).catch(() => null),
        ]);

        if (!manifestResponse.ok) {
          throw new Error(`Failed to fetch asset-manifest.json: ${manifestResponse.status}`);
        }

        const manifest = await manifestResponse.json();
        const content = contentResponse?.ok
          ? await contentResponse.json()
          : { settings: DEFAULT_SITE_SETTINGS, 
              hero: DEFAULT_HERO_CONTENT, 
              videos: [], 
              models: {} 
              };

        if (isCancelled) {
          return;
        }

        setModelManifest(manifest);
        setSiteContent(content ?? { settings: DEFAULT_SITE_SETTINGS, 
          hero: DEFAULT_HERO_CONTENT, 
          videos: [], 
          models: {} });

        const vesselManifestModels = (manifest.models ?? []).filter(isVesselModel);
        const availableIds = new Set(vesselManifestModels.map((model) => model.id));
        const requestedModelId = getRequestedModelId();
        const storedModelId = window.localStorage.getItem(MODEL_STORAGE_KEY);
        const persistedModelId = storedModelId && availableIds.has(storedModelId) 
         ? storedModelId 
         : '';
        const queryModelId = requestedModelId && availableIds.has(requestedModelId) 
            ? requestedModelId 
            : '';
        const configuredPrimaryModelId = `${content?.settings?.primaryModelId ?? ''}`.trim();
        const defaultModelId = configuredPrimaryModelId && availableIds.has(configuredPrimaryModelId)
          ? configuredPrimaryModelId
          : availableIds.has(manifest.primaryModelId)
          ? manifest.primaryModelId
          : vesselManifestModels[0]?.id ?? '';
        const preferredModelId = availableIds.has(PREFERRED_MODEL_ID) ? PREFERRED_MODEL_ID : '';
        const initialModelId = queryModelId || persistedModelId || defaultModelId || preferredModelId;

        setSelectedModelId(initialModelId);

        if (initialModelId) {
          window.localStorage.setItem(MODEL_STORAGE_KEY, initialModelId);
        }
      } catch (error) {
        console.error('Failed to load showcase data:', error);
      }
    };

    loadShowcaseData();

    return () => {
      isCancelled = true;
    };
  }, [route, runtimeBasePath, staticAssetBaseUrl]); // 依赖项现在是传递给 Hook 的参数

  return { modelManifest, siteContent, selectedModelId, setSelectedModelId };
}
