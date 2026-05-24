import React, { useState, useEffect, useCallback, useRef } from 'react';
import { forEach } from 'lodash-es';
import { useAdminThree } from './useAdminThree'; // 确保路径正确
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import * as THREE from 'three';

const CONFIG = {
  HDR_source: `/hdr/venice_sunset_1k.hdr`,
  MODEL_SOURCES: {
    EQUIPMENT: `/gltf/Yacht/950.glb`,
    PLANE: `/gltf/plane.glb`, // not used now, but reserved for future use
  },
  MODEL_SCALES: [0.5, 0.5, 0.5],
};

export function useAdminBoatScene({ modelPath = CONFIG.MODEL_SOURCES.EQUIPMENT } = {}) {
  const {
    containerRef,
    bootstrap: bootstrapThree,
    scene,
    camera,
    ocontrol,
    loadBgEnv,
    loadGltf,
    // transitionAnimation, // Assuming this is part of useAdminThree now
  } = useAdminThree();

  const [current, setCurrent] = useState({ name: '', id: 0 });
  const [isAnimation, setIsAnimation] = useState(false);
  const [loading, setLoading] = useState({
    total: 2,
    loaded: 0,
    isLoading: true,
  });

  const models = useRef({ equipment: null, plane: null }).current;
  const labelGroup = useRef(new THREE.Group()).current;

  // A helper for transitionAnimation if it's not from useAdminThree
  const transitionAnimation = useCallback((options) => {
      return new TWEEN.Tween(options.from)
        .to(options.to, options.duration)
        .easing(options.easing)
        .onUpdate(options.onUpdate)
        .onComplete(options.onComplete)
        .start();
  }, []);


  const loadModels = useCallback(async () => {
    const loadBg = async () => {
      await loadBgEnv(CONFIG.HDR_source);
      setLoading(prev => ({ ...prev, loaded: prev.loaded + 1 }));
    };

    const loadEquipment = async () => {
      const gltf = await loadGltf(modelPath);
      const model = gltf.scene;
      model.scale.set(...CONFIG.MODEL_SCALES);
      models.equipment = model;
      model.name = 'equipment';
      if (scene.current) {
        scene.current.add(model);
      }
      setLoading(prev => ({ ...prev, loaded: prev.loaded + 1 }));
    };

    await Promise.all([loadEquipment(), loadBg()]);
    setLoading(prev => ({ ...prev, isLoading: false, loaded: prev.total }));
  }, [loadBgEnv, loadGltf, models, scene, modelPath]);

  const loadLights = useCallback(() => {
    const LIGHT_LIST = [
      [0, 0, 0],
      [-100, 100, 100],
      [100, -100, 100],
      [100, 100, -100],
    ];
    forEach(LIGHT_LIST, ([x, y, z]) => {
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(x, y, z);
      if (scene.current) {
        scene.current.add(directionalLight);
      }
    });
  }, [scene]);

  const openingAnimation = useCallback(() => {
    return new Promise((resolve) => {
      setIsAnimation(true);
      transitionAnimation({
        from: camera.current.position,
        to: { x: 0.5, y: 0.5, z: 0.5 },
        duration: 1000 * 2,
        easing: TWEEN.Easing.Quintic.InOut,
        onUpdate: (coords) => {
          if (camera.current) camera.current.position.set(coords.x, coords.y, coords.z);
          if (ocontrol.current) ocontrol.current.update();
        },
        onComplete: () => {
          setIsAnimation(false);
          resolve(undefined);
        },
      });
    });
  }, [camera, ocontrol, transitionAnimation]);

  const bootstrapScene = useCallback(async () => {
    loadLights();
    await openingAnimation();

    // Model picking logic
    const highlightColor = new THREE.Color(0xff0000);
    const defaultColor = new THREE.Color(0xffffff);
    let lastSelectedMesh = null;
    let lastInstanceId = -1;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
        if (!models.equipment || !camera.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera.current);
        const intersects = raycaster.intersectObject(models.equipment, true);

        let isInstanceClicked = false;
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const intersect_obj = intersect.object;

            if (intersect_obj.isInstancedMesh) {
                isInstanceClicked = true;
                const instanceId = intersect.instanceId;

                if (lastSelectedMesh && lastInstanceId !== -1) {
                    lastSelectedMesh.setColorAt(lastInstanceId, defaultColor);
                    if(lastSelectedMesh.instanceColor) lastSelectedMesh.instanceColor.needsUpdate = true;
                }

                intersect_obj.setColorAt(instanceId, highlightColor);
                if(intersect_obj.instanceColor) intersect_obj.instanceColor.needsUpdate = true;

                lastSelectedMesh = intersect_obj;
                lastInstanceId = instanceId;

                let current_name = intersect_obj.name;
                let jarId = instanceId;
                if (intersect_obj.name.includes('shortJar')) {
                    current_name = 'ShortJar';
                    jarId += 1;
                } else if (intersect_obj.name.includes('tallJar')) {
                    current_name = 'TallJar';
                    jarId += 301;
                }
                setCurrent({ name: current_name, id: jarId });
            }
        }

        if (!isInstanceClicked) {
            if (lastSelectedMesh && lastInstanceId !== -1) {
                lastSelectedMesh.setColorAt(lastInstanceId, defaultColor);
                if(lastSelectedMesh.instanceColor) lastSelectedMesh.instanceColor.needsUpdate = true;
                lastSelectedMesh = null;
                lastInstanceId = -1;
            }
            setCurrent({ name: '', id: 0 });
        }
    };
    
    const container = containerRef.current;
    container.addEventListener('click', onClick);

    // Cleanup function for the event listener
    return () => {
        container.removeEventListener('click', onClick);
    };

  }, [loadLights, openingAnimation, camera, containerRef, models.equipment]);

  useEffect(() => {
    let cleanupClick;
    if (containerRef.current) {
        // One-time setup
        bootstrapThree(); 
        loadBgEnv(CONFIG.HDR_source);
        bootstrapScene().then(cleanupFn => {
            cleanupClick = cleanupFn;
        });
    }
    return () => {
        if (typeof cleanupClick === 'function') {
            cleanupClick();
        }
    };
  }, [containerRef, bootstrapThree, bootstrapScene, loadBgEnv]);

  useEffect(() => {
    if (!modelPath || !scene.current || !loadGltf) 
      return;

    // Cleanup previous model
    if (models.equipment) {
        scene.current.remove(models.equipment);
    }
    
    setLoading(prev => ({ ...prev, isLoading: true, loaded: 0, total: 1 }));

    // Load new model
    loadGltf(modelPath).then(gltf => {
        const model = gltf.scene;
        model.scale.set(...CONFIG.MODEL_SCALES);
        models.equipment = model;
        model.name = 'equipment';
        scene.current.add(model);
        setLoading(prev => ({ ...prev, isLoading: false, loaded: 1 }));
    }).catch(error => {
        console.error("Failed to load model:", error);
        setLoading(prev => ({ ...prev, isLoading: false }));
    });

    // Return a cleanup function to remove the model when the component unmounts or path changes
    return () => {
        if (models.equipment && scene.current) {
            scene.current.remove(models.equipment);
        }
    };
  }, [modelPath, scene, loadGltf, models]);

  // Mock warning functions
  const startWarning = () => console.log("Start warning simulation");
  const stopWarning = () => console.log("Stop warning simulation");

  return {
    containerRef,
    loading,
    current,
    startWarning,
    stopWarning,
  };
}

// Note: The default export 'useFactory' is unusual for a file named 'useAdminBoatScene'.
// I'm keeping it as is, but you might want to rename it for consistency.
export default useAdminBoatScene;