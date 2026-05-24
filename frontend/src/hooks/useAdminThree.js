import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
// import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { isFunction } from 'lodash-es';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js'; 

// 基础配置
const CONFIG = {
  CAMERA_POSITION: [0.2, 1.0, 0.4],
  CONTROL_TARGET: [0, 1.1, 0],
  DECODER_PATH: `/js/draco/gltf/`, // React public 文件夹路径
};

export function useAdminThree() {
  const containerRef = useRef(null);
  const scene = useRef(null);
  const camera = useRef(null);
  const renderer = useRef(null);
  const cssRenderer = useRef(null);
  const ocontrol = useRef(null);
  const tcontrol = useRef(null);
  const outlinePass = useRef(null);
  const composers = useRef(new Map()).current;
  const mixers = useRef([]).current;
  const clock = useRef(new THREE.Timer()).current;
  const renderMixins = useRef(new Map()).current;

  const isAnimating = useRef(false);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(CONFIG.DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: 'js' });

  const bootstrap = useCallback(() => {
    if (!containerRef.current) 
      return;

    bootstrapScene();
    bootstrapCamera();
    bootstrapRenderer();
    bootstrapControls();
    bootstrapLights();
    onAnimate();
    // onWindowResize is handled by useEffect
    addOutlineEffect();
    addHexEffect();
  }, []);

  const bootstrapScene = () => {
    if (scene.current) return;
    scene.current = new THREE.Scene();
  };

  const bootstrapCamera = () => {
    if (camera.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    camera.current = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 10000);
    camera.current.position.set(...CONFIG.CAMERA_POSITION);
  };

  const bootstrapRenderer = () => {
    if (renderer.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    
    renderer.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.current.setPixelRatio(window.devicePixelRatio);
    renderer.current.shadowMap.enabled = false;
    renderer.current.setSize(clientWidth, clientHeight);
    renderer.current.localClippingEnabled = true;
    renderer.current.setClearAlpha(0.0);
    renderer.current.domElement.className = 'webgl-renderer';
    renderer.current.domElement.style.position = 'absolute';
    renderer.current.domElement.style.top = '0px';
    renderer.current.domElement.style.left = '0px';
    renderer.current.domElement.style.zIndex = 1;
    containerRef.current.appendChild(renderer.current.domElement);

    cssRenderer.current = new CSS2DRenderer();
    cssRenderer.current.setSize(clientWidth, clientHeight);
    cssRenderer.current.domElement.className = 'css2d-renderer';
    cssRenderer.current.domElement.style.position = 'absolute';
    cssRenderer.current.domElement.style.top = '0px';
    cssRenderer.current.domElement.style.pointerEvents = 'none';
    cssRenderer.current.domElement.style.zIndex = 2;
    containerRef.current.appendChild(cssRenderer.current.domElement);
  };

  const bootstrapControls = () => {
    if (ocontrol.current) return;
    ocontrol.current = new OrbitControls(camera.current, renderer.current.domElement);
    ocontrol.current.enableDamping = true;
    ocontrol.current.dampingFactor = 0.1;
    ocontrol.current.target.set(0, 2.65, 0);
    ocontrol.current.maxPolarAngle = THREE.MathUtils.degToRad(90);
    ocontrol.current.minPolarAngle = THREE.MathUtils.degToRad(45);
    ocontrol.current.minDistance = 0.5;
    ocontrol.current.maxDistance = 2;
    ocontrol.current.update();
  };

  const bootstrapLights = () => {
    if (scene.current.children.some(c => c.isLight)) return;
    const ambientLight = new THREE.AmbientLight(0x999999, 1.5);
    scene.current.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(20, 20, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
    scene.current.add(directionalLight);
  };

  const onAnimate = useCallback((time) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    function animate() {
      if (!renderer.current || !scene.current || !camera.current) {
        isAnimating.current = false;
        return;
      }

      ocontrol.current.update();

      const delta = clock.getDelta();
      TWEEN.update();
      mixers.forEach((mixer) => mixer.update(delta));
      renderMixins.forEach((mixin) => isFunction(mixin) && mixin());

      if (composers.size > 0) {
        composers.forEach((composer) => composer.render(delta));
      } else {
        renderer.current.render(scene.current, camera.current);
      }

      if (cssRenderer.current) {
        cssRenderer.current.render(scene.current, camera.current);
      }

      requestAnimationFrame(animate);
    }
    animate();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !camera.current || !renderer.current || !cssRenderer.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      camera.current.aspect = clientWidth / clientHeight;
      camera.current.updateProjectionMatrix();
      renderer.current.setSize(clientWidth, clientHeight);
      cssRenderer.current.setSize(clientWidth, clientHeight);
      if (ocontrol.current) ocontrol.current.update();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // Cleanup logic here
      if (renderer.current) {
        containerRef.current?.removeChild(renderer.current.domElement);
        renderer.current.dispose();
      }
      if (cssRenderer.current) {
        containerRef.current?.removeChild(cssRenderer.current.domElement);
      }
    };
  }, []);

  const loadBgEnv = useCallback((url) => {
    const rgbeLoader = new HDRLoader();

    return new Promise((resolve, reject) => {
      
      rgbeLoader.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        if (scene.current) {
          scene.current.background = texture;
          scene.current.environment = texture;
          texture.colorSpace = THREE.LinearSRGBColorSpace;
        }
        resolve(texture);
      }, undefined, (error) => {
        console.error('加载环境贴图出错:', error);
        reject(error);
      });
    });
  }, []);

  const initInstancedMeshColor = (obj) => {
    if (obj.isInstancedMesh && !obj.instanceColor) {
      const count = obj.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      }
      obj.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
  };

  const loadGltf = useCallback((url) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    return new Promise((resolve, reject) => {

      loader.load(url, (object) => {
        object.scene.traverse((child) => {
          initInstancedMeshColor(child);
          if (child.isMesh && child.name.includes('_semitransparent')) {
            const mesh = child;
            const mat = mesh.material;
            mesh.material = mat.clone();
            const newMat = mesh.material;
            newMat.transparent = true;
            newMat.opacity = 0.5;
            newMat.metalness = 0.1;
            newMat.roughness = 0.05;
            newMat.depthWrite = false;
            newMat.side = THREE.DoubleSide;
          }
        });
        resolve(object);

      }, (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      }, (error) => {
        console.error('加载模型出错:', error);
        reject(error);
      });
    });
  }, []);

  const loadAnimationMixer = useCallback((mesh, animations, animationName) => {
    const mixer = new THREE.AnimationMixer(mesh);
    const clip = THREE.AnimationClip.findByName(animations, animationName);
    if (!clip) return undefined;
    // ... (rest of the function is missing in the provided snippet)
    return mixer;
  }, []);
  
  // Placeholder for missing functions
  const addOutlineEffect = () => { /* TODO */ };
  const addHexEffect = () => { /* TODO */ };


  // The hook returns the container ref and the bootstrap function
  return {
    containerRef,
    bootstrap,
    scene,
    camera,
    ocontrol,
    loadGltf,
    loadBgEnv,
    loadAnimationMixer,
    // Expose other necessary functions and refs
  };
}