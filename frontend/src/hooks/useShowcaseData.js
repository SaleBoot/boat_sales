import { useState, useEffect } from 'react';
import { getFrontBoatModels } from '../apis/frontApi';
import {
  getRequestedModelId,
  resolveManifestPath
} from '../utils/utils_homepage'; 

// Helper to create a deep copy
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

export const useShowcaseData = (
  route,
  runtimeBasePath,
  staticAssetBaseUrl
) => {
  const [internalModelManifest, setInternalModelManifest] = useState(null);
  const [internalSiteContent, setInternalSiteContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(() => getRequestedModelId());

  useEffect(() => {
    const fetchDataAndMerge = async () => {
      try {
        setLoading(true);

        // 1. Fetch local JSON files from the public directory
        const manifestResponse = await fetch('/app-json/asset-manifest.json');
        const siteContentResponse = await fetch('/app-json/site-content.json');

        if (!manifestResponse.ok || !siteContentResponse.ok) {
          throw new Error('Failed to fetch local data files.');
        }

        const localModelManifest = await manifestResponse.json();
        const localSiteContent = await siteContentResponse.json();
        
        // Initialize selectedModelId once local manifest is loaded
        const initialId = getRequestedModelId();
        if (initialId && localModelManifest.models.some(m => m.id === initialId)) {
          setSelectedModelId(initialId);
        } else if (route !== 'showcase') {
          setSelectedModelId(null);
        } else {
          // Fallback to the first model if no specific one is requested
          setSelectedModelId(localModelManifest.models[0]?.id || null);
        }
        

        // 2. Fetch remote API data
        const allBoats = await getFrontBoatModels();
        if (!allBoats || !Array.isArray(allBoats.content)) {
          console.warn("API did not return valid boat data.");
          // If API fails, still proceed with local data
          setInternalModelManifest(localModelManifest);
          setInternalSiteContent(localSiteContent);
          return;
        }
        const allBoatsFlat = allBoats.content.flatMap(category => category.boats);

        // 3. Merge data (create copies to avoid mutation)
        const newManifest = deepClone(localModelManifest);
        const newSiteContent = deepClone(localSiteContent);

        // Enhance manifest models
        newManifest.models = newManifest.models.map((model) => {
          const boat = allBoatsFlat.find(b => b.boatEnName?.toLowerCase() === model.id?.toLowerCase());
          if (boat) {
            return { ...model, ...boat, id: model.id, path: boat.modelRuntimePath || model.path };
          }
          return model;
        });

        // DO NOT merge API data into siteContent. It breaks the menu structure.
        // The menu relies on the original structure from site-content.json.
        // if (newSiteContent.models?.boats) {
        //   for (const category in newSiteContent.models.boats) {
        //     newSiteContent.models.boats[category] = newSiteContent.models.boats[category].map(model => {
        //       const boat = allBoatsFlat.find(b => b.boatEnName?.toLowerCase() === model.id?.toLowerCase());
        //       if (boat) {
        //         return { ...model, ...boat, id: model.id };
        //       }
        //       return model;
        //     });
        //   }
        // }
        
        // Resolve paths using the newly centralized function
        newManifest.models.forEach(
          (m) => (m.path = resolveManifestPath(m.path, staticAssetBaseUrl))
        );

        // 4. Update state with the new, merged data
        setInternalModelManifest(newManifest);
        setInternalSiteContent(newSiteContent);

      } catch (err) {
        setError(err);
        console.error("Failed to fetch and merge showcase data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAndMerge();
  }, [route, runtimeBasePath]); // Add route to dependency array

  // Return a consistent shape, even while loading
  return {
    modelManifest: internalModelManifest,
    siteContent: internalSiteContent,
    selectedModelId,
    setSelectedModelId,
    loading,
    error,
  };
};