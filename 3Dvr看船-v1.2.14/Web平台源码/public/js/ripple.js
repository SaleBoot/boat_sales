(function () {
// ============================================
// 全屏水波纹折射效果 — GPU 波动方程模拟
// Ping-Pong 双缓冲 + HalfFloat 渲染目标
// 鼠标拖动产生拖尾水波纹: 尖端小、尾部稍大
// 以 海浪.png 为背景, 程序化生成焦散光斑叠加 (无需外部纹理)
// ============================================

try {
    if (typeof THREE === 'undefined') {
        throw new Error('THREE not loaded');
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    document.body.prepend(renderer.domElement);

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '1';
    renderer.domElement.style.pointerEvents = 'none';

    // ============================================
    // 检测浮点渲染目标支持
    // ============================================
    const gl = renderer.getContext();
    const hasFloat = gl.getExtension('EXT_color_buffer_float') ||
                     gl.getExtension('EXT_color_buffer_half_float');
    if (!hasFloat) {
        throw new Error('GPU does not support float render targets');
    }

    // ============================================
    // 背景图片纹理 — 直接用 TextureLoader 加载
    // 避免 canvas 中间环节导致的 tainting 问题
    // ============================================
    const imageTexture = new THREE.TextureLoader().load(
        '/海浪.png',
        function (tex) {
            renderMaterial.uniforms.uImageResolution.value.set(
                tex.image.width, tex.image.height
            );
        },
        undefined,
        function () {
            var div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:18px;font-family:sans-serif;text-align:center;';
            div.textContent = '背景图片加载失败，请确保 海浪.png 与 index.html 在同一目录';
            document.body.appendChild(div);
        }
    );
    imageTexture.minFilter = THREE.LinearFilter;
    imageTexture.magFilter = THREE.LinearFilter;

    // (焦散光斑已改为程序化生成, 无需外部纹理)

    // ============================================
    // 浮点渲染目标 — Ping-Pong 双缓冲
    // ============================================
    const rtOptions = {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false
    };

    let rtA = new THREE.WebGLRenderTarget(width * dpr, height * dpr, rtOptions);
    let rtB = new THREE.WebGLRenderTarget(width * dpr, height * dpr, rtOptions);

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtA);
    renderer.clear(true, true, true);
    renderer.setRenderTarget(rtB);
    renderer.clear(true, true, true);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);

    // ============================================
    // 场景 & 正交相机
    // ============================================
    const simScene = new THREE.Scene();
    const renderScene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // ============================================
    // 鼠标轨迹 (6 个历史位置)
    // index 0 = 最新位置 (尖端, 最小)
    // index 5 = 最旧位置 (尾部, 最大)
    // ============================================
    const TRAIL_LEN = 6;
    const trail = [];
    for (let i = 0; i < TRAIL_LEN; i++) {
        trail.push(new THREE.Vector2(0.5, 0.5));
    }
    let lastMoveTime = 0;

    // ============================================
    // 模拟着色器 — 2D 波动方程 + 拖尾注入
    // ============================================
    const simMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uResolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
            uDamping: { value: 0.985 },
            uMouseActive: { value: 0.0 },
            uFrame: { value: 0 },
            uPrevTexture: { value: null },
            uTrail: { value: trail }
        },
        vertexShader,
        fragmentShader: `
            #define TRAIL_LEN 6
            uniform vec2 uResolution;
            uniform float uDamping;
            uniform float uMouseActive;
            uniform float uFrame;
            uniform sampler2D uPrevTexture;
            uniform vec2 uTrail[TRAIL_LEN];
            varying vec2 vUv;

            void main() {
                if (uFrame < 2.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    return;
                }

                vec2 uv = vUv;
                vec2 texel = 1.0 / uResolution;

                // 读取波高
                float center = texture2D(uPrevTexture, uv).r;
                float prevCenter = texture2D(uPrevTexture, uv).g;

                // 四邻居拉普拉斯
                float n = texture2D(uPrevTexture, uv + vec2(0.0, texel.y)).r;
                float s = texture2D(uPrevTexture, uv - vec2(0.0, texel.y)).r;
                float e = texture2D(uPrevTexture, uv + vec2(texel.x, 0.0)).r;
                float w = texture2D(uPrevTexture, uv - vec2(texel.x, 0.0)).r;

                // 波动方程
                float nextValue = (n + s + e + w) * 0.5 - prevCenter;
                nextValue *= uDamping;

                // === 拖尾能量注入 ===
                // index 0 = 尖端 (最新位置, 半径大, 强度弱)
                // index 5 = 尾部 (最旧位置, 半径更大, 强度稍强)
                if (uMouseActive > 0.5) {
                    for (int i = 0; i < TRAIL_LEN; i++) {
                        float fi = float(i);
                        float dist = distance(uv, uTrail[i]);

                        // 半径: 尖端 0.025 → 尾部 0.045 (更大更柔和)
                        float radius = 0.025 + fi * 0.004;

                        if (dist < radius) {
                            float falloff = 1.0 - dist / radius;
                            // 强度: 尖端 0.05 → 尾部 0.12 (更弱)
                            float strength = 0.05 + fi * 0.012;
                            nextValue += falloff * falloff * strength;
                        }
                    }
                }

                gl_FragColor = vec4(nextValue, center, 0.0, 1.0);
            }
        `,
        depthWrite: false,
        depthTest: false
    });

    // ============================================
    // 渲染着色器 — 波场梯度折射背景图片
    // 在着色器内做 cover 适配, 无需 canvas 中间层
    // ============================================
    const renderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uResolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
            uImageResolution: { value: new THREE.Vector2(1, 1) },
            uDisplacement: { value: 0.08 },
            uSimTexture: { value: null },
            uImageTexture: { value: imageTexture },
            uTime: { value: 0.0 }
        },
        vertexShader,
        fragmentShader: `
            uniform vec2 uResolution;
            uniform vec2 uImageResolution;
            uniform float uDisplacement;
            uniform float uTime;
            uniform sampler2D uSimTexture;
            uniform sampler2D uImageTexture;
            varying vec2 vUv;

            // cover UV: 让图片铺满全屏, 多余部分裁剪
            vec2 coverUV(vec2 uv, vec2 screen, vec2 img) {
                float screenAspect = screen.x / screen.y;
                float imageAspect = img.x / img.y;
                vec2 nuv = uv;
                if (imageAspect > screenAspect) {
                    // 图片更宽 → 左右裁剪
                    float s = screenAspect / imageAspect;
                    nuv.x = (uv.x - 0.5) * s + 0.5;
                } else {
                    // 图片更高 → 上下裁剪
                    float s = imageAspect / screenAspect;
                    nuv.y = (uv.y - 0.5) * s + 0.5;
                }
                return nuv;
            }

            // 程序化焦散光斑 — 多角度正弦波干涉 + 锐化
            float proceduralCaustic(vec2 uv, float t) {
                // UV 有机扭曲 + 缩放
                vec2 p = uv;
                p += 0.15 * vec2(
                    sin(t * 0.3 + uv.y * 4.0),
                    cos(t * 0.25 + uv.x * 4.0)
                );
                p *= 5.0;

                // 多角度正弦波叠加
                float n = 0.0;
                n += sin(p.x + t * 0.4);
                n += sin(p.y + t * 0.3);
                n += sin(p.x * 0.8 + p.y * 1.2 + t * 0.5);
                n += sin(p.x * 1.3 - p.y * 0.7 - t * 0.35);

                // 归一化 + 锐化 → 焦散亮线
                n = abs(n) / 4.0;
                return pow(1.0 - n, 5.0);
            }

            void main() {
                vec2 uv = vUv;
                vec2 texel = 1.0 / uResolution;

                float h = texture2D(uSimTexture, uv).r;
                float hR = texture2D(uSimTexture, uv + vec2(texel.x, 0.0)).r;
                float hU = texture2D(uSimTexture, uv + vec2(0.0, texel.y)).r;

                // 波场梯度 → UV 偏移 → 折射采样背景
                vec2 offset = vec2(hR - h, hU - h) * uDisplacement;
                vec2 bgUV = coverUV(uv + offset, uResolution, uImageResolution);
                vec4 color = texture2D(uImageTexture, bgUV);

                // 高光: 波峰右侧亮
                float highlight = max(0.0, (hR - h)) * 0.2;
                color.rgb += vec3(highlight);

                // 阴影: 波谷右侧暗
                float shadow = max(0.0, -(hR - h)) * 0.1;
                color.rgb -= vec3(shadow);

                // === 程序化焦散光斑动态叠加 (双层) ===
                // 焦散颜色: 青蓝色调
                vec3 causticColor = vec3(0.3, 0.65, 0.85);

                // 第一层: 受水波折射扭曲
                float c1 = proceduralCaustic(uv * 2.0 + offset * 3.0, uTime);

                // 第二层: 不同缩放与时间偏移, 叠加更自然
                float c2 = proceduralCaustic(uv * 3.0 + offset * 3.0, uTime * 1.3 + 10.0);

                // 呼吸效果: 焦散强度随时间轻微脉动
                float causticPulse = 0.8 + 0.2 * sin(uTime * 0.7);

                // 加法混合
                float cIntensity = 0.25;
                color.rgb += causticColor * c1 * cIntensity * causticPulse;
                color.rgb += causticColor * c2 * cIntensity * 0.6 * causticPulse;

                gl_FragColor = color;
            }
        `,
        depthWrite: false,
        depthTest: false
    });

    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    simScene.add(new THREE.Mesh(quadGeometry, simMaterial));
    renderScene.add(new THREE.Mesh(quadGeometry, renderMaterial));

    // ============================================
    // 鼠标 / 触摸交互 — 更新轨迹
    // ============================================
    function addTrailPos(x, y) {
        for (let i = TRAIL_LEN - 1; i > 0; i--) {
            trail[i].copy(trail[i - 1]);
        }
        trail[0].set(x, y);
        lastMoveTime = performance.now();
    }

    window.addEventListener('mousemove', (e) => {
        addTrailPos(e.clientX / width, 1.0 - e.clientY / height);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            addTrailPos(e.touches[0].clientX / width, 1.0 - e.touches[0].clientY / height);
        }
    }, { passive: true });

    // ============================================
    // 窗口自适应
    // ============================================
    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        renderer.setSize(width, height);
        rtA.setSize(width * dpr, height * dpr);
        rtB.setSize(width * dpr, height * dpr);
        simMaterial.uniforms.uResolution.value.set(width * dpr, height * dpr);
        renderMaterial.uniforms.uResolution.value.set(width * dpr, height * dpr);

        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(rtA);
        renderer.clear(true, true, true);
        renderer.setRenderTarget(rtB);
        renderer.clear(true, true, true);
        renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 1);
    });

    // ============================================
    // 渲染循环 — Ping-Pong 双 Pass
    // ============================================
    let frameCount = 0;

    function loop() {
        requestAnimationFrame(loop);
        frameCount++;

        // 鼠标静止超过 150ms → 停止注入
        const isActive = (performance.now() - lastMoveTime) < 150;

        // Pass 1: 模拟
        simMaterial.uniforms.uPrevTexture.value = rtA.texture;
        simMaterial.uniforms.uMouseActive.value = isActive ? 1.0 : 0.0;
        simMaterial.uniforms.uFrame.value = frameCount;
        renderer.setRenderTarget(rtB);
        renderer.render(simScene, camera);

        // Pass 2: 渲染
        renderMaterial.uniforms.uSimTexture.value = rtB.texture;
        renderMaterial.uniforms.uTime.value = performance.now() * 0.001;
        renderer.setRenderTarget(null);
        renderer.render(renderScene, camera);

        // 交换缓冲区
        const swap = rtA;
        rtA = rtB;
        rtB = swap;
    }

    loop();

} catch (err) {
    console.error('Water ripple effect error:', err);
    document.body.innerHTML =
        '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'color:#fff;font-size:20px;font-family:sans-serif;">' +
        '错误: ' + err.message + '</div>';
}

})();