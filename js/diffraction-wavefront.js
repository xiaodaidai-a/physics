/**
 * 衍射波前传播观察舱
 * 抽象化、教学化的 3D 光场可视化：入射波前 → 单缝孔径 → 衍射扩展 → 接收屏成像
 * 当前版本仅实现「单缝衍射」，代码结构预留圆孔 / 双缝 / 光栅扩展位
 */

(function () {
    'use strict';

    // ===== 场景全局对象 =====
    let scene, camera, renderer, controls;
    let animationId = null;

    let incidentWavefronts = [];   // 入射波前平面组
    let apertureGroup = null;      // 孔径面
    let diffractedArcs = [];       // 衍射波前弧面组
    let pathGroup = null;          // 传播路径线组
    let screenGroup = null;        // 接收屏
    let slicePlane = null;         // 空间切片面

    // ===== 状态 =====
    const state = {
        playing: false,
        apertureType: 'single-slit',          // 预留: circular / double-slit / grating
        observationMode: 'both',              // wavefront | path | both
        slicePosition: 'mid',                 // near | mid | far
        sliceTargetX: 4.0
    };

    // ===== 配置 =====
    const CFG = {
        apertureX: 0,        // 孔径面 x 位置
        screenX: 8,          // 接收屏 x 位置
        incidentStartX: -8,  // 入射波前起始 x
        boardWidth: 6,       // 孔径板宽（z 方向）
        boardHeight: 4.5,    // 孔径板高（y 方向）
        slitHeight: 2.6,     // 缝长（竖直）
        slitWidth: 0.14,     // 缝宽（水平）
        incidentCount: 6,    // 入射波前平面数量
        incidentSpeed: 0.028,
        arcCount: 5,         // 衍射弧面数量
        arcSpread: 1.25,     // 弧面张角（弧度，约 72°）
        arcSpeed: 0.0042,
        sliceX: { near: 1.2, mid: 4.0, far: 7.5 },
        colors: {
            background: 0x0b1d33,
            wavefront: 0x4dd9ff,
            arc: 0x6fe3ff,
            board: 0x10243d,
            slit: 0xeafcff,
            pathCenter: 0xffffff,
            pathSide: 0x53c8ff
        }
    };

    // =====================================================================
    // 初始化
    // =====================================================================

    function initScene() {
        const container = document.getElementById('dwf-scene-container');
        if (!container) {
            console.error('找不到观察舱场景容器 #dwf-scene-container');
            return;
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(CFG.colors.background);
        scene.fog = new THREE.Fog(CFG.colors.background, 22, 40);

        const w = container.clientWidth;
        const h = container.clientHeight;
        camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
        camera.position.set(-3.5, 5.5, 13);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0.5, 0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 5;
        controls.maxDistance = 30;
        controls.update();

        // 光照
        scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // 地面参考网格
        const grid = new THREE.GridHelper(30, 30, 0x29547e, 0x16314f);
        grid.position.y = -2.6;
        scene.add(grid);

        // 创建场景对象
        createIncidentWavefronts();
        createAperturePlane(state.apertureType);
        createDiffractedWavefronts(state.apertureType);
        createPropagationPaths(state.apertureType);
        createDiffractionScreen(state.apertureType);
        createSlicePlane();
        addSceneLabels();

        updateObservationMode(state.observationMode);

        window.addEventListener('resize', onWindowResize);
        animate();
    }

    function onWindowResize() {
        const container = document.getElementById('dwf-scene-container');
        if (!container || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    // =====================================================================
    // 3D 对象创建
    // =====================================================================

    /** 入射波前：多层半透明青蓝色平面，沿 +x 方向缓慢推进并循环 */
    function createIncidentWavefronts() {
        const geo = new THREE.PlaneGeometry(CFG.boardWidth, CFG.boardHeight);
        geo.rotateY(Math.PI / 2); // 法线指向 +x，平面位于 yz 平面内

        const spacing = Math.abs(CFG.incidentStartX) / CFG.incidentCount;
        for (let i = 0; i < CFG.incidentCount; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: CFG.colors.wavefront,
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const plane = new THREE.Mesh(geo, mat);
            plane.position.x = CFG.incidentStartX + i * spacing;
            plane.userData.baseOpacity = 0.16;
            scene.add(plane);
            incidentWavefronts.push(plane);
        }
    }

    /** 孔径面：深色挡板 + 视觉亮缝（不做真实布尔挖孔） */
    function createAperturePlane(type) {
        if (apertureGroup) {
            scene.remove(apertureGroup);
            apertureGroup = null;
        }
        apertureGroup = new THREE.Group();

        // 挡板（中间留缝，用上下左右四块拼出真实"开口"层次感的简化版：单块板 + 亮缝叠加）
        const boardGeo = new THREE.PlaneGeometry(CFG.boardWidth, CFG.boardHeight);
        boardGeo.rotateY(Math.PI / 2);
        const boardMat = new THREE.MeshPhongMaterial({
            color: CFG.colors.board,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            shininess: 60
        });
        const board = new THREE.Mesh(boardGeo, boardMat);
        apertureGroup.add(board);

        // 板边框发光描边
        const edges = new THREE.EdgesGeometry(boardGeo);
        const edgeLine = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x2e6da8, transparent: true, opacity: 0.8 })
        );
        apertureGroup.add(edgeLine);

        if (type === 'single-slit') {
            // 竖直亮缝
            const slitGeo = new THREE.PlaneGeometry(CFG.slitWidth, CFG.slitHeight);
            slitGeo.rotateY(Math.PI / 2);
            const slitMat = new THREE.MeshBasicMaterial({
                color: CFG.colors.slit,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
            const slit = new THREE.Mesh(slitGeo, slitMat);
            slit.position.x = 0.01; // 避免 z-fighting
            apertureGroup.add(slit);

            // 缝周围淡淡的光晕
            const glowGeo = new THREE.PlaneGeometry(CFG.slitWidth * 5, CFG.slitHeight * 1.08);
            glowGeo.rotateY(Math.PI / 2);
            const glowMat = new THREE.MeshBasicMaterial({
                color: CFG.colors.wavefront,
                transparent: true,
                opacity: 0.18,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.x = 0.005;
            apertureGroup.add(glow);
        }
        // TODO: circular / double-slit / grating 孔径形态在此扩展

        apertureGroup.position.x = CFG.apertureX;
        scene.add(apertureGroup);
    }

    /** 衍射波前：缝后展开的扇形（柱面）波前，半径逐渐增大、透明度逐渐降低 */
    function createDiffractedWavefronts(type) {
        diffractedArcs.forEach(function (arc) { scene.remove(arc); });
        diffractedArcs = [];

        if (type !== 'single-slit') return; // 其余类型预留

        for (let i = 0; i < CFG.arcCount; i++) {
            const phase = (i + 1) / (CFG.arcCount + 1); // 初始静态分布，避免空场景
            const arc = buildArcMesh(1);
            arc.userData.phase = phase;
            applyArcPhase(arc);
            scene.add(arc);
            diffractedArcs.push(arc);
        }
    }

    /** 构建单个柱面弧（轴沿 y，张角朝 +x） */
    function buildArcMesh(radius) {
        const thetaStart = Math.PI / 2 - CFG.arcSpread / 2; // 以 +x 方向为中心
        const geo = new THREE.CylinderGeometry(
            radius, radius, CFG.slitHeight, 48, 1, true,
            thetaStart, CFG.arcSpread
        );
        const mat = new THREE.MeshBasicMaterial({
            color: CFG.colors.arc,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(CFG.apertureX, 0, 0);
        return mesh;
    }

    /** 按相位（0~1）更新弧面的半径与透明度 */
    function applyArcPhase(arc) {
        const phase = arc.userData.phase;
        const maxR = CFG.screenX - CFG.apertureX;
        const r = Math.max(phase * maxR, 0.05);
        arc.scale.set(r, 1, r); // 基础半径 1，按比例缩放（y 方向保持缝长）
        arc.material.opacity = 0.34 * (1 - phase) + 0.04;
    }

    /** 传播路径：从缝出发指向接收屏的发光方向线（中央 0 级最亮，两侧依次减弱） */
    function createPropagationPaths(type) {
        if (pathGroup) {
            scene.remove(pathGroup);
            pathGroup = null;
        }
        pathGroup = new THREE.Group();

        if (type === 'single-slit') {
            const len = CFG.screenX - CFG.apertureX;
            // 中央主方向 + 两侧次级方向（示意角度，非严格计算）
            const dirs = [
                { angle: 0, color: CFG.colors.pathCenter, opacity: 0.95 },
                { angle: 0.13, color: CFG.colors.pathSide, opacity: 0.55 },
                { angle: -0.13, color: CFG.colors.pathSide, opacity: 0.55 },
                { angle: 0.27, color: CFG.colors.pathSide, opacity: 0.3 },
                { angle: -0.27, color: CFG.colors.pathSide, opacity: 0.3 }
            ];
            dirs.forEach(function (d) {
                const points = [
                    new THREE.Vector3(CFG.apertureX, 0, 0),
                    new THREE.Vector3(CFG.screenX, 0, Math.tan(d.angle) * len)
                ];
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = new THREE.LineBasicMaterial({
                    color: d.color,
                    transparent: true,
                    opacity: d.opacity,
                    blending: THREE.AdditiveBlending
                });
                pathGroup.add(new THREE.Line(geo, mat));
            });
        }

        scene.add(pathGroup);
    }

    /** 接收屏：半透明玻璃感平面 + Canvas 纹理显示衍射图样 */
    function createDiffractionScreen(type) {
        if (screenGroup) {
            scene.remove(screenGroup);
            screenGroup = null;
        }
        screenGroup = new THREE.Group();

        // 屏幕图样
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 768;
        drawPatternForType(type, canvas, 1.0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const screenGeo = new THREE.PlaneGeometry(CFG.boardWidth, CFG.boardHeight);
        screenGeo.rotateY(-Math.PI / 2); // 面向 -x（朝向孔径）
        const screenMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.96,
            side: THREE.DoubleSide
        });
        const screenMesh = new THREE.Mesh(screenGeo, screenMat);
        screenGroup.add(screenMesh);
        screenGroup.userData.canvas = canvas;
        screenGroup.userData.texture = texture;

        // 玻璃边框
        const frameGeo = new THREE.PlaneGeometry(CFG.boardWidth + 0.2, CFG.boardHeight + 0.2);
        frameGeo.rotateY(-Math.PI / 2);
        const frameMat = new THREE.MeshPhongMaterial({
            color: 0x9fd9ff,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            shininess: 100
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.x = 0.03;
        screenGroup.add(frame);

        screenGroup.position.x = CFG.screenX;
        scene.add(screenGroup);
    }

    /** 空间切片面：半透明平面 + 随传播距离变化的亮度纹理 */
    function createSlicePlane() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 384;

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const geo = new THREE.PlaneGeometry(CFG.boardWidth, CFG.boardHeight);
        geo.rotateY(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        slicePlane = new THREE.Mesh(geo, mat);
        slicePlane.userData.canvas = canvas;
        slicePlane.userData.texture = texture;

        slicePlane.position.x = CFG.sliceX[state.slicePosition];
        state.sliceTargetX = slicePlane.position.x;
        updateSliceTexture();
        scene.add(slicePlane);
    }

    /** 文字标签：入射波前 / 单缝孔径 / 接收屏 */
    function addSceneLabels() {
        makeLabel('入射波前', new THREE.Vector3(-5, 3.0, 0));
        makeLabel('单缝孔径', new THREE.Vector3(CFG.apertureX, 3.0, 0));
        makeLabel('接收屏', new THREE.Vector3(CFG.screenX, 3.0, 0));
    }

    function makeLabel(text, position) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(77, 217, 255, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#dff4ff';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.4, 0.6, 1);
        sprite.position.copy(position);
        scene.add(sprite);
    }

    // =====================================================================
    // Canvas 2D 图样绘制
    // =====================================================================

    function drawPatternForType(type, canvas, spread) {
        if (type === 'single-slit') {
            drawSingleSlitPattern(canvas, spread);
        }
        // TODO: drawCircularAperturePattern / drawDoubleSlitPattern / drawGratingPattern
    }

    /**
     * 单缝衍射图样：中央竖直亮纹最宽最亮，两侧明纹逐渐变窄变暗
     * @param {HTMLCanvasElement} canvas
     * @param {number} spread 0~1，传播距离系数：越小越接近缝的几何投影，越大越接近远场图样
     */
    function drawSingleSlitPattern(canvas, spread) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const sincScale = 9.0;        // 远场 sinc² 横向密度
        const nearSigma = 0.018 + 0.1 * (1 - spread); // 近场亮带宽度

        for (let px = 0; px < w; px++) {
            const u = (px - cx) / w; // -0.5 ~ 0.5

            // 远场：sinc² 分布
            const beta = Math.PI * sincScale * u;
            const sinc = beta === 0 ? 1 : Math.sin(beta) / beta;
            const farI = sinc * sinc;

            // 近场：缝的几何投影（高斯模糊的窄亮带）
            const nearI = Math.exp(-(u * u) / (2 * nearSigma * nearSigma));

            // 按传播距离插值
            const I = (1 - spread) * nearI + spread * farI;

            const bright = Math.pow(Math.min(Math.max(I, 0), 1), 0.75); // gamma 提升暗部可见性
            const r = Math.round(190 * bright + 65 * bright * bright);
            const g = Math.round(230 * bright);
            const b = Math.round(255 * bright);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            ctx.fillRect(px, 0, 1, h);
        }

        // 上下渐隐，模拟缝长方向的有限范围
        const fade = ctx.createLinearGradient(0, 0, 0, h);
        fade.addColorStop(0, 'rgba(0,0,0,0.85)');
        fade.addColorStop(0.18, 'rgba(0,0,0,0)');
        fade.addColorStop(0.82, 'rgba(0,0,0,0)');
        fade.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, w, h);
    }

    // =====================================================================
    // 状态更新
    // =====================================================================

    function updateAperture(type) {
        state.apertureType = type;
        createAperturePlane(type);
        createDiffractedWavefronts(type);
        createPropagationPaths(type);
        updateScreenPattern(type);
        updateSliceTexture();
        updateObservationMode(state.observationMode);
    }

    function updateObservationMode(mode) {
        state.observationMode = mode;
        const showWavefront = (mode === 'wavefront' || mode === 'both');
        const showPath = (mode === 'path' || mode === 'both');

        diffractedArcs.forEach(function (arc) { arc.visible = showWavefront; });
        incidentWavefronts.forEach(function (p) { p.visible = showWavefront; });
        if (pathGroup) pathGroup.visible = showPath;

        // 弱化处理：叠加模式下两者都正常显示；单一模式下另一类隐藏
        document.querySelectorAll('[data-dwf-mode]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-dwf-mode') === mode);
        });
    }

    function updateScreenPattern(type) {
        if (!screenGroup) return;
        drawPatternForType(type, screenGroup.userData.canvas, 1.0);
        screenGroup.userData.texture.needsUpdate = true;
    }

    /** 切片面移动到指定位置（near / mid / far） */
    function moveSlicePlane(position) {
        if (!CFG.sliceX.hasOwnProperty(position)) return;
        state.slicePosition = position;
        state.sliceTargetX = CFG.sliceX[position];
        updateSliceTexture();

        document.querySelectorAll('[data-dwf-slice]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-dwf-slice') === position);
        });
    }

    /** 根据切片当前位置生成对应"形成中"的图样 */
    function updateSliceTexture() {
        if (!slicePlane) return;
        const t = (state.sliceTargetX - CFG.apertureX) / (CFG.screenX - CFG.apertureX); // 0~1
        drawPatternForType(state.apertureType, slicePlane.userData.canvas, Math.min(Math.max(t, 0.05), 1));
        slicePlane.userData.texture.needsUpdate = true;
    }

    // =====================================================================
    // 动画
    // =====================================================================

    function animate() {
        animationId = requestAnimationFrame(animate);

        if (state.playing) {
            // 入射波前推进
            incidentWavefronts.forEach(function (p) {
                p.position.x += CFG.incidentSpeed;
                if (p.position.x > CFG.apertureX - 0.4) {
                    p.position.x = CFG.incidentStartX;
                }
                // 接近孔径时渐隐
                const d = CFG.apertureX - p.position.x;
                p.material.opacity = d < 1.5 ? p.userData.baseOpacity * (d / 1.5) : p.userData.baseOpacity;
            });

            // 衍射弧面扩展
            diffractedArcs.forEach(function (arc) {
                arc.userData.phase += CFG.arcSpeed;
                if (arc.userData.phase >= 1) arc.userData.phase -= 1;
                applyArcPhase(arc);
            });
        }

        // 切片面平滑移动
        if (slicePlane) {
            slicePlane.position.x += (state.sliceTargetX - slicePlane.position.x) * 0.08;
        }

        controls.update();
        renderer.render(scene, camera);
    }

    // =====================================================================
    // 控件绑定
    // =====================================================================

    function bindControls() {
        const startBtn = document.getElementById('dwf-start');
        const pauseBtn = document.getElementById('dwf-pause');
        const resetBtn = document.getElementById('dwf-reset');

        if (startBtn) startBtn.addEventListener('click', function () {
            state.playing = true;
            startBtn.classList.add('active');
            if (pauseBtn) pauseBtn.classList.remove('active');
        });

        if (pauseBtn) pauseBtn.addEventListener('click', function () {
            state.playing = false;
            pauseBtn.classList.add('active');
            if (startBtn) startBtn.classList.remove('active');
        });

        if (resetBtn) resetBtn.addEventListener('click', function () {
            state.playing = false;
            if (startBtn) startBtn.classList.remove('active');
            if (pauseBtn) pauseBtn.classList.remove('active');

            // 恢复初始相位与位置
            incidentWavefronts.forEach(function (p, i) {
                const spacing = Math.abs(CFG.incidentStartX) / CFG.incidentCount;
                p.position.x = CFG.incidentStartX + i * spacing;
                p.material.opacity = p.userData.baseOpacity;
            });
            diffractedArcs.forEach(function (arc, i) {
                arc.userData.phase = (i + 1) / (CFG.arcCount + 1);
                applyArcPhase(arc);
            });

            updateObservationMode('both');
            moveSlicePlane('mid');

            // 恢复相机
            camera.position.set(-3.5, 5.5, 13);
            controls.target.set(0.5, 0, 0);
            controls.update();
        });

        // 观察模式
        document.querySelectorAll('[data-dwf-mode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                updateObservationMode(btn.getAttribute('data-dwf-mode'));
            });
        });

        // 切片位置
        document.querySelectorAll('[data-dwf-slice]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                moveSlicePlane(btn.getAttribute('data-dwf-slice'));
            });
        });

        // 孔径类型（当前仅单缝可用）
        document.querySelectorAll('[data-dwf-aperture]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                const type = btn.getAttribute('data-dwf-aperture');
                if (type !== state.apertureType) updateAperture(type);
                document.querySelectorAll('[data-dwf-aperture]').forEach(function (b) {
                    b.classList.toggle('active', b === btn);
                });
            });
        });
    }

    // =====================================================================
    // 启动
    // =====================================================================

    window.addEventListener('load', function () {
        if (typeof THREE === 'undefined') {
            console.error('Three.js 未加载，无法初始化观察舱');
            return;
        }
        initScene();
        bindControls();
    });
})();
