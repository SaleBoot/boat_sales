import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {   
  updateOrthographicFrustum,
} from '../../../utils/utils_3js.js';

// import {  
//   normalizeMaterialName, 
//   formatTransferSize,
//   formatTransferSpeed,
//   isStudioLookModel,  
// } from '../utils/utils_ship_scene.js';

function setupLights(scene, modelRoot, isStudioLook) {
  const ambientLight = new THREE.HemisphereLight(
    new THREE.Color(isStudioLook ? '#dde8f6' : '#bfd9f2'),
    new THREE.Color(isStudioLook ? '#32251c' : '#52606c'),
    isStudioLook ? 0.62 : 1.02
  )

  const keyLight = new THREE.DirectionalLight(
    new THREE.Color(isStudioLook ? '#fff1de' : '#ffd7ab'),
    isStudioLook ? 2.05 : 1.18
  )
  keyLight.position.set(...(isStudioLook ? [5.4, 3.5, 4.8] : [6.8, 4.6, 2.2]))
  keyLight.target = modelRoot
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  keyLight.shadow.bias = -0.0002
  keyLight.shadow.normalBias = 0.03
  keyLight.shadow.camera.near = 0.5
  keyLight.shadow.camera.far = 24
  keyLight.shadow.camera.left = -8
  keyLight.shadow.camera.right = 8
  keyLight.shadow.camera.top = 8
  keyLight.shadow.camera.bottom = -8

  const underGlowLight = new THREE.PointLight(
    new THREE.Color(isStudioLook ? '#72f6ff' : '#ffffff'),
    isStudioLook ? 0 : 0,
    10,
    2
  )
  underGlowLight.position.set(0.2, -0.55, 1.1)

  scene.add(ambientLight, keyLight, underGlowLight)

  return {
    ambientLight,
    keyLight,
    underGlowLight
  }
}

function setupCameras(scene, exteriorCameraPreset, interiorDeckPresetConfig, isStudioLook) {
  // 外部相机（正交）：用于外部环绕观察，提供无透视失真的产品展示视图，类似于工程蓝图。
  const exteriorCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.005, 5000)
  // 内部相机（透视）：用于内部第一人称漫游，提供具有深度感的真实沉浸式体验。
  const interiorCamera = new THREE.PerspectiveCamera(56, 1, isStudioLook ? 0.02 : 0.005, 5000)
  
  exteriorCamera.position.set(...exteriorCameraPreset.position)
  exteriorCamera.zoom = exteriorCameraPreset.zoom
  interiorCamera.position.set(...(interiorDeckPresetConfig['1']?.position ?? [0, 0.68, -0.82]))
  
  
  scene.add(exteriorCamera, interiorCamera)

  return {
    exteriorCamera,
    interiorCamera
  }
}

function setupRenderer(canvas, isStudioLook) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor('#010203', 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = isStudioLook ? 0.92 : 0.94
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  return renderer
}

function setupOrbitControls(camera, canvas, targetY) {
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = false
  controls.target.set(0, targetY, 0)
  controls.update()
  return controls
}



function createReflectionEnvironmentScene() {
  const environmentScene = new THREE.Scene()
  const disposables = []

  const registerMesh = (geometry, material, transform) => {
    const mesh = new THREE.Mesh(geometry, material)
    transform(mesh)
    environmentScene.add(mesh)
    disposables.push(geometry, material)
    return mesh
  }

  registerMesh(
    new THREE.SphereGeometry(14, 48, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bcd3ea'),
      side: THREE.BackSide
    }),
    (mesh) => {
      mesh.scale.set(1, 0.88, 1)
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(20, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#d7e6f5') }),
    (mesh) => {
      mesh.position.set(-6.4, 2.2, 1.8)
      mesh.rotation.y = Math.PI / 2.55
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#edf4fb') }),
    (mesh) => {
      mesh.position.set(5.6, 2.8, -2.6)
      mesh.rotation.y = -Math.PI / 2.2
    }
  )

  registerMesh(
    new THREE.CircleGeometry(1.2, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8') }),
    (mesh) => {
      mesh.position.set(-3.8, 4.6, 2.4)
      mesh.lookAt(0, 0.8, 0)
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(22, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d6f7e') }),
    (mesh) => {
      mesh.position.set(0, -2.8, 0.4)
      mesh.rotation.x = -Math.PI / 2
    }
  )

  return {
    scene: environmentScene,
    dispose: () => {
      disposables.forEach((resource) => resource.dispose?.())
      environmentScene.clear()
    }
  }
} 


function setupEnvironment(renderer, scene) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const reflectionEnvironment = createReflectionEnvironmentScene()
  const environmentTexture = pmremGenerator.fromScene(reflectionEnvironment.scene, 0.02).texture
  scene.environment = environmentTexture
  
  // 返回创建的资源，以便在清理阶段可以释放它们
  return {
    pmremGenerator,
    reflectionEnvironment,
    environmentTexture
  }
}


function createWaterSurface() {
  const geometry = new THREE.CircleGeometry(1, 120)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color('#72b8e9') },
      uDeepColor: { value: new THREE.Color('#0d3b61') },
      uHighlightColor: { value: new THREE.Color('#f2fbff') }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;

      uniform float uTime;

      void main() {
        vUv = uv;

        vec3 transformed = position;
        float primaryWave = sin((position.x * 10.0) + uTime * 1.35) * 0.018;
        float secondaryWave = cos((position.y * 13.0) - uTime * 1.05) * 0.014;
        transformed.z += primaryWave + secondaryWave;
        vWave = transformed.z;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;

      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uDeepColor;
      uniform vec3 uHighlightColor;

      void main() {
        float dist = distance(vUv, vec2(0.5));
        float surfaceMask = smoothstep(0.56, 0.08, dist);
        float shimmer = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 24.0 + uTime * 0.9 + vWave * 40.0);
        float edgeGlow = smoothstep(0.55, 0.24, dist);
        float innerShadow = smoothstep(0.0, 0.44, dist);

        vec3 color = mix(uDeepColor, uBaseColor, 0.62 + vWave * 7.5);
        color = mix(color, uDeepColor * 0.9, innerShadow * 0.18);
        color = mix(color, uHighlightColor, shimmer * 0.14 * edgeGlow);

        float alpha = surfaceMask * (0.26 + shimmer * 0.12 + edgeGlow * 0.18);
        gl_FragColor = vec4(color, alpha);
      }
    `
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, -0.8, 0.2)
  mesh.renderOrder = -1000

  return { mesh, material, geometry }
}


function createInteriorSkySphere() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024

  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  const { width, height } = canvas
  const skyGradient = context.createLinearGradient(0, 0, 0, height)
  skyGradient.addColorStop(0, '#7fc8ff')
  skyGradient.addColorStop(0.38, '#a8dcff')
  skyGradient.addColorStop(0.72, '#d5efff')
  skyGradient.addColorStop(1, '#eef8ff')
  context.fillStyle = skyGradient
  context.fillRect(0, 0, width, height)

  const glowGradient = context.createRadialGradient(
    width * 0.74,
    height * 0.22,
    width * 0.03,
    width * 0.74,
    height * 0.22,
    width * 0.24
  )
  glowGradient.addColorStop(0, 'rgba(255, 253, 245, 0.72)')
  glowGradient.addColorStop(0.45, 'rgba(255, 251, 240, 0.28)')
  glowGradient.addColorStop(1, 'rgba(255, 251, 240, 0)')
  context.fillStyle = glowGradient
  context.fillRect(0, 0, width, height)

  const hazeGradient = context.createLinearGradient(0, height * 0.56, 0, height)
  hazeGradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  hazeGradient.addColorStop(1, 'rgba(255, 255, 255, 0.36)')
  context.fillStyle = hazeGradient
  context.fillRect(0, height * 0.56, width, height * 0.44)

  const drawCloud = (centerX, centerY, cloudWidth, cloudHeight, alpha) => {
    const puffs = [
      [-0.28, 0.08, 0.26],
      [-0.08, -0.06, 0.31],
      [0.18, -0.03, 0.29],
      [0.38, 0.1, 0.22]
    ]

    puffs.forEach(([offsetX, offsetY, scale]) => {
      const radius = cloudWidth * scale
      const puffX = centerX + cloudWidth * offsetX
      const puffY = centerY + cloudHeight * offsetY
      const puff = context.createRadialGradient(
        puffX,
        puffY,
        radius * 0.1,
        puffX,
        puffY,
        radius
      )
      puff.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
      puff.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.76})`)
      puff.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = puff
      context.fillRect(puffX - radius, puffY - radius, radius * 2, radius * 2)
    })
  }

  ;[
    [width * 0.18, height * 0.21, width * 0.16, height * 0.09, 0.82],
    [width * 0.42, height * 0.28, width * 0.19, height * 0.1, 0.74],
    [width * 0.72, height * 0.18, width * 0.17, height * 0.09, 0.78],
    [width * 0.86, height * 0.33, width * 0.14, height * 0.08, 0.68],
    [width * 0.3, height * 0.46, width * 0.23, height * 0.12, 0.54],
    [width * 0.64, height * 0.52, width * 0.2, height * 0.1, 0.5]
  ].forEach((cloud) => drawCloud(...cloud))

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const geometry = new THREE.SphereGeometry(260, 64, 32)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  mesh.renderOrder = -1000

  return {
    mesh,
    geometry,
    material,
    texture
  }
}



function setupScene(shouldShowWaterSurface) {
  const scene = new THREE.Scene()
  const presentationRoot = new THREE.Group()
  const modelRoot = new THREE.Group()
  const waterRoot = new THREE.Group()
  const stageRoot = new THREE.Group()
  const waterSurface = shouldShowWaterSurface ? createWaterSurface() : null
  const interiorSkySphere = createInteriorSkySphere()
  scene.add(presentationRoot)
  presentationRoot.add(stageRoot, waterRoot, modelRoot)
  if (interiorSkySphere) {
    scene.add(interiorSkySphere.mesh)
  }

  return {
    scene,
    presentationRoot,
    modelRoot,
    waterRoot,
    stageRoot,
    waterSurface,
    interiorSkySphere
  }
}

function setupWindowResize(canvas, renderer, exteriorCamera, interiorCamera) {
  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;

    updateOrthographicFrustum(exteriorCamera, width / height, 7.6);
    exteriorCamera.updateProjectionMatrix();

    interiorCamera.aspect = width / height;
    interiorCamera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize(); // Initial call

  return resizeObserver;
}

export function useThree(canvasRef,  
    { isStudioLook, 
        shouldShowWaterSurface, 
        exteriorCameraPreset, 
        interiorDeckPresetConfig 
    }) 
{
  const [threeContext, setThreeContext] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const {
      scene,
      presentationRoot,
      modelRoot,
      waterRoot,
      stageRoot,
      waterSurface,
      interiorSkySphere
    } = setupScene(shouldShowWaterSurface);

    const renderer = setupRenderer(canvas, isStudioLook);

    const { exteriorCamera, interiorCamera } = setupCameras(scene, 
        exteriorCameraPreset, interiorDeckPresetConfig, isStudioLook);

    const { 
        ambientLight, 
        keyLight, 
        underGlowLight 
    } = setupLights(scene, modelRoot, isStudioLook);

    const controls = setupOrbitControls(exteriorCamera, canvas, exteriorCameraPreset.targetY);

    const { 
        pmremGenerator, 
        reflectionEnvironment, 
        environmentTexture 
    } = setupEnvironment(renderer, scene);

    if (waterSurface) {
      waterRoot.add(waterSurface.mesh);
    }

    const context = {
      renderer,
      scene,
      presentationRoot,
      modelRoot,
      waterRoot,
      stageRoot,
      waterSurface,
      interiorSkySphere,
      exteriorCamera,
      interiorCamera,
      ambientLight,
      keyLight,
      underGlowLight,
      controls,
      pmremGenerator,
      reflectionEnvironment,
      environmentTexture,
    };

    setThreeContext(context);

    const resizeObserver = setupWindowResize(canvas, renderer, exteriorCamera, interiorCamera);

    return () => {
      resizeObserver.disconnect();
      // Cleanup logic
      Object.values(context).forEach(item => {
        if (item && typeof item.dispose === 'function') {
          item.dispose();
        }
      });
    };
  }, [canvasRef, isStudioLook, shouldShowWaterSurface, exteriorCameraPreset, interiorDeckPresetConfig]);

  return threeContext;
}