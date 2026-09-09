import * as THREE from 'three'

const ROUTES = [
  { name:'上海洋山港 · 东海巡航', port:'上海洋山港', points:[[122.1242,30.5646],[122.205,30.48],[122.36,30.38],[122.58,30.22],[122.82,30.05]] },
  { name:'青岛港 · 黄海巡检', port:'青岛港', points:[[120.3019,36.0052],[120.42,35.92],[120.58,35.82],[120.76,35.72],[120.95,35.58]] },
  { name:'宁波舟山港 · 锚地通勤', port:'宁波舟山港', points:[[122.10,29.80],[122.22,29.72],[122.38,29.66],[122.54,29.58],[122.68,29.48]] },
  { name:'厦门港 · 近岸安巡', port:'厦门港', points:[[118.065,24.43],[118.18,24.36],[118.30,24.28],[118.42,24.20],[118.56,24.10]] },
  { name:'深圳盐田港 · 大鹏湾航线', port:'深圳盐田港', points:[[114.29,22.54],[114.36,22.49],[114.48,22.43],[114.62,22.36],[114.76,22.28]] },
  { name:'大连港 · 渤海湾保障', port:'大连港', points:[[121.72,38.90],[121.86,38.82],[122.04,38.74],[122.22,38.66],[122.42,38.54]] }
]

function stableHash(value) {
  let hash = 2166136261
  for (const ch of String(value || 'ship')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0
  return hash
}

export function shipLocation(boat) {
  const hash = stableHash(boat.shipId || boat.name)
  const route = ROUTES[hash % ROUTES.length]
  const [lon, lat] = route.points[0]
  const p = boat.twinConfig?.position
  if (p && Number.isFinite(p.longitude) && Number.isFinite(p.latitude) && Math.abs(p.longitude)<=180 && Math.abs(p.latitude)<=90) {
    const custom = { ...route, port:p.port || '当前船位', points:route.points.map(([x,y], i) => [p.longitude + (x - lon) + i * .004, p.latitude + (y - lat) - i * .002]) }
    return { port: custom.port, routeName: custom.name, lon:p.longitude, lat:p.latitude, route:custom, simulated:false }
  }
  return { port: route.port, routeName: route.name, lon, lat, route, simulated:true }
}

export class TwinGeography {
  constructor(twin, boat) {
    this.twin = twin
    this.boat = boat
    this.location = shipLocation(boat)
    this.mode = 'ship'
    this.progress = 0
    this.playing = false
    this.C = window.Cesium
    this.scale = Math.max(5, Number.parseFloat(boat.length) || 22)/3
  }

  async init() {
    const C = this.C
    if (!C) throw new Error('地图库未加载，请刷新重试')
    C.Ion.defaultAccessToken = ''
    this.viewer = new C.Viewer('geoViewport', {
      baseLayer:false, baseLayerPicker:false, geocoder:false, homeButton:false,
      sceneModePicker:false, navigationHelpButton:false, animation:false,
      timeline:false, fullscreenButton:false, selectionIndicator:false, infoBox:false,
      creditContainer:'geoCredit', useDefaultRenderLoop:false,
      requestRenderMode:true, maximumRenderTimeChange:Infinity,
      contextOptions:{webgl:{alpha:false, preserveDrawingBuffer:true}}
    })
    const v = this.viewer
    v.scene.globe.baseColor = C.Color.fromCssColorString('#082742')
    v.scene.globe.maximumScreenSpaceError = 1.3
    v.scene.fog.density = .00006
    v.scene.highDynamicRange = true
    v.scene.light = new C.DirectionalLight({direction:new C.Cartesian3(0,0,-1),intensity:2.5})
    v.resolutionScale = 1
    v.scene.screenSpaceCameraController.minimumZoomDistance = 15
    v.scene.screenSpaceCameraController.maximumZoomDistance = 24000000
    v.camera.frustum.near = .1
    this.status = document.getElementById('geoStatus')
    const imagery = await C.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer')
    const layer = v.imageryLayers.addImageryProvider(imagery)
    layer.brightness = .82
    layer.saturation = .75
    imagery.errorEvent.addEventListener(error => {
      error.retry=error.timesRetried<2
      this.status.textContent=error.retry?'部分影像加载失败，正在重试':'部分影像暂不可用'
    })
    v.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
      url:'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      maximumLevel:16, credit:'Esri, HERE, Garmin, © OpenStreetMap contributors'
    }))
    this.terrainReady = C.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer')
      .then(provider => {
        v.terrainProvider=provider; this.status.textContent='卫星影像 · 三维地形'; this.terrainLoaded=true
        // ponytail: sea-level tint is visual only; surveyed water masks are needed for navigation-grade coastlines.
        v.scene.globe.material = new C.Material({fabric:{type:'CoastalOcean',uniforms:{time:0},source:`
          czm_material czm_getMaterial(czm_materialInput materialInput) {
            czm_material m=czm_getDefaultMaterial(materialInput);
            float wave=sin(materialInput.st.x*300.0+time)*sin(materialInput.st.y*240.0-time*.6);
            m.diffuse=vec3(.018,.065,.115)+wave*.003;
            m.alpha=(1.0-smoothstep(1.0,2.0,materialInput.height))*.94;
            return m;
          }`}})
      })
      .catch(error => { this.status.textContent='地形加载失败，当前仅显示卫星影像'; console.warn(error) })
    this.routePoints = this.location.route.points
    this.route = v.entities.add({polyline:{
      positions:C.Cartesian3.fromDegreesArray(this.routePoints.flat()), width:3,
      material:new C.PolylineGlowMaterialProperty({glowPower:.18,color:C.Color.CYAN}), clampToGround:true
    }})
    this.ship = v.entities.add({name:boatName(this.boat), position:C.Cartesian3.fromDegrees(this.location.lon,this.location.lat),
      point:{pixelSize:9,color:C.Color.CYAN,outlineColor:C.Color.WHITE,outlineWidth:2},
      label:{text:boatName(this.boat),font:'14px sans-serif',pixelOffset:new C.Cartesian2(0,-32),
        fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#091c2bdd'),
        distanceDisplayCondition:new C.DistanceDisplayCondition(400,25000000)}
    })
    // Export the already-normalized displayed model so every supported upload format matches the detail page.
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
    const glb = await new GLTFExporter().parseAsync(this.twin.inner.currentModel,{binary:true})
    this.modelUrl = URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}))
    this.ship.model = {uri:this.modelUrl,scale:this.scale,minimumPixelSize:260,maximumScale:this.scale*180,
      imageBasedLightingFactor:new C.Cartesian2(1.5,1),runAnimations:true,silhouetteColor:C.Color.CYAN,silhouetteSize:1}
    this.ship.orientation = C.Transforms.headingPitchRollQuaternion(this.ship.position.getValue(C.JulianDate.now()),new C.HeadingPitchRoll(0,0,0))
    v.screenSpaceEventHandler.setInputAction(event=>{
      if(v.scene.pick(event.position)?.id===this.ship) this.setMode('ship')
    },C.ScreenSpaceEventType.LEFT_CLICK)
    this.setProgress(0)
    document.querySelectorAll('[data-geo]').forEach(button => button.addEventListener('click',()=>this.setMode(button.dataset.geo)))
    document.getElementById('routeVisible').addEventListener('change',event=>{this.route.show=event.target.checked})
    document.getElementById('routePlay').addEventListener('click',()=>{
      this.playing=!this.playing
      if(this.progress>=1) this.setProgress(0)
      document.getElementById('routePlay').textContent=this.playing?'暂停回放':'播放航迹'
    })
    document.getElementById('routeReset').addEventListener('click',()=>{this.playing=false;this.setProgress(0);document.getElementById('routePlay').textContent='播放航迹'})
    document.getElementById('routeTime').addEventListener('input',event=>this.setProgress(Number(event.target.value)/1000))
    this.setMode('port')
    this.last=performance.now()
    this.tick=()=>{
      const now=performance.now(), delta=Math.min((now-this.last)/1000,.1);this.last=now
      if(this.playing) {
        this.setProgress(Math.min(1,this.progress+delta/120))
        if(this.progress>=1){this.playing=false;document.getElementById('routePlay').textContent='播放航迹'}
      }
      v.resize()
      if(this.mode==='ship')this.syncCamera()
      C.Cartesian3.clone(v.camera.directionWC,v.scene.light.direction)
      if(v.scene.globe.material)v.scene.globe.material.uniforms.time=now*.0003
      v.render()
      this.frame=requestAnimationFrame(this.tick)
    }
    this.tick()
  }

  setProgress(progress) {
    this.progress=progress
    const C=this.C, n=progress*(this.routePoints.length-1), i=Math.min(Math.floor(n),this.routePoints.length-2), t=n-i
    const a=this.routePoints[i],b=this.routePoints[i+1]
    this.lon=a[0]+(b[0]-a[0])*t;this.lat=a[1]+(b[1]-a[1])*t
    this.origin=C.Cartesian3.fromDegrees(this.lon,this.lat,2)
    this.transform=C.Transforms.eastNorthUpToFixedFrame(this.origin)
    this.ship.position=this.origin
    document.getElementById('routeTime').value=String(Math.round(progress*1000))
    document.getElementById('geoPosition').textContent=this.location.routeName+'\n'+(this.location.simulated?'模拟船位':'已录入船位')+' · '+this.lon.toFixed(4)+'°E  '+this.lat.toFixed(4)+'°N'
  }

  syncCamera() {
    const C=this.C, camera=this.twin.inner.camera, box=this.twin._bound
    const signature=[...camera.matrixWorld.elements,camera.aspect,this.lon,this.lat].join(',')
    if(this.cameraSignature===signature)return
    this.cameraSignature=signature
    const water=box.min.y+(box.max.y-box.min.y)*.1
    const local=new C.Cartesian3(camera.position.x*this.scale,-camera.position.z*this.scale,(camera.position.y-water)*this.scale)
    const direction=camera.getWorldDirection(new THREE.Vector3())
    const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion)
    const worldVector=p=>C.Matrix4.multiplyByPointAsVector(this.transform,new C.Cartesian3(p.x,-p.z,p.y),new C.Cartesian3())
    const aspect=camera.aspect, fovy=THREE.MathUtils.degToRad(camera.fov)
    this.viewer.camera.frustum.fov=aspect>1 ? 2*Math.atan(Math.tan(fovy/2)*aspect) : fovy
    this.viewer.camera.setView({destination:C.Matrix4.multiplyByPoint(this.transform,local,new C.Cartesian3()),
      orientation:{direction:worldVector(direction),up:worldVector(up)}})
  }

  setMode(mode) {
    if(!this.viewer || !this.origin) return
    this.mode=mode
    this.cameraSignature=null
    const C=this.C, shipMode=mode==='ship'
    document.getElementById('twinViewport').hidden=!shipMode
    this.ship.show=!shipMode
    this.twin.inner.controls.enabled=shipMode
    this.viewer.scene.screenSpaceCameraController.enableInputs=!shipMode
    document.querySelectorAll('[data-geo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.geo===mode)))
    if(shipMode) { this.viewer.camera.cancelFlight(); this.twin.inner.onResize() }
    else {
      this.viewer.camera.frustum.fov=C.Math.toRadians(60)
      this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(this.origin,1),{
        duration:1.4,offset:new C.HeadingPitchRange(C.Math.toRadians(-30),C.Math.toRadians(mode==='globe'?-80:-38),mode==='globe'?15000000:18000)
      })
    }
  }

  destroy() {cancelAnimationFrame(this.frame);if(this.modelUrl)URL.revokeObjectURL(this.modelUrl);this.viewer?.destroy()}
}

function boatName(boat) { return boat.name || boat.shipId }
