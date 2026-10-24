/**
 * 虚拟实验室主控制脚本 - 完全修复版
 * 解决所有DOM引用和Three.js兼容性问题
 */

// 全局变量
let labScene, labCamera, labRenderer, labControls;
let experimentTable, monitorDisplay, newtonApparatus;
let isFullscreen = false;
let isExperimentRunning = false;
let monitorCanvas, monitorTexture, monitorContext;
let monitorDemo = null;

// 实验室配置 - 设置初始视角在实验室内
const labConfig = {
    cameraPosition: { x: 0, y: 2, z: 4 }, // 设置初始视角在实验室内，面向实验台
    cameraTarget: { x: 0, y: 0, z: 0 }, // 观察目标点设在实验桌中心
    tableWidth: 3.5, // 进一步优化实验桌尺寸，确保与环境协调
    tableHeight: 0.08, // 稍微减薄桌面
    tableDepth: 2.0, // 减小深度确保不阻碍移动
    tableColor: 0x8B4513,
    monitorWidth: 5.0, // 进一步放大显示器宽度，让牛顿环现象更加清晰明显
    monitorHeight: 3.0, // 进一步放大显示器高度，大幅提升观察效果
    monitorDepth: 0.08,
    screenWidth: 4.8, // 相应放大屏幕宽度
    screenHeight: 2.8, // 相应放大屏幕高度
    apparatusPosition: { x: 0, y: 0.12, z: 0 },
    monitorPosition: { x: 0, y: 2.4, z: -4.0 }, // 调整显示器位置，给进一步放大后的屏幕留出更多空间，避免遮挡
    ambientLightIntensity: 0.6,
    directionalLightIntensity: 0.8,
    directionalLightPosition: { x: 10, y: 10, z: 5 }
};

// 页面加载完成后初始化
window.addEventListener('load', function () {
    console.log('虚拟实验室开始初始化...');
    // 确保所有依赖都加载完成后再初始化
    setTimeout(function () {
        try {
            initVirtualLab();
        } catch (error) {
            console.error('初始化过程中发生错误:', error);
            showErrorMessage('初始化失败: ' + error.message);
        }
    }, 1500);
});

/**
 * 初始化虚拟实验室
 */
async function initVirtualLab() {
    try {
        console.log('开始创建实验室场景...');
        await createLabScene();

        console.log('创建实验桌...');
        createExperimentTable();

        console.log('创建显示器...');
        await createMonitorDisplay();

        console.log('加载牛顿环仪模型...');
        try {
            await loadNewtonApparatus();
        } catch (error) {
            console.warn('GLB模型加载失败，使用占位符:', error.message);
            createPlaceholderApparatus();
        }

        console.log('初始化显示器屏幕...');
        initMonitorScreen();

        console.log('绑定控制事件...');
        bindControlEvents();

        console.log('开始渲染...');
        animate();

        console.log('隐藏加载提示...');
        hideLoadingOverlay();

        console.log('虚拟实验室初始化完成！');

    } catch (error) {
        console.error('虚拟实验室初始化失败:', error);
        showErrorMessage('实验室加载失败: ' + error.message);
    }
}

/**
 * 创建实验室主场景
 */
async function createLabScene() {
    // 检查Three.js是否加载
    if (typeof THREE === 'undefined') {
        throw new Error('Three.js库未正确加载');
    }

    // 创建场景
    labScene = new THREE.Scene();
    labScene.background = new THREE.Color(0xf0f8ff);

    // 获取容器
    const container = document.getElementById('lab-scene-container');
    if (!container) {
        throw new Error('无法找到3D场景容器元素');
    }

    // 创建相机
    const aspect = container.clientWidth / container.clientHeight;
    labCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    labCamera.position.set(
        labConfig.cameraPosition.x,
        labConfig.cameraPosition.y,
        labConfig.cameraPosition.z
    );

    // 创建渲染器 - 启用高质量渲染
    labRenderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance"
    });
    labRenderer.setSize(container.clientWidth, container.clientHeight);
    labRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 启用阴影映射和高质量设置
    labRenderer.shadowMap.enabled = true;
    labRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 启用物理光照和色调映射
    labRenderer.physicallyCorrectLights = true;
    labRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    labRenderer.toneMappingExposure = 1.0;
    labRenderer.outputEncoding = THREE.sRGBEncoding;

    // 设置清除颜色
    labRenderer.setClearColor(0xf0f8ff);

    // 清空容器并添加渲染器
    container.innerHTML = '';
    container.appendChild(labRenderer.domElement);

    // 创建轨道控制器
    if (typeof THREE.OrbitControls !== 'undefined') {
        labControls = new THREE.OrbitControls(labCamera, labRenderer.domElement);
        labControls.target.set(
            labConfig.cameraTarget.x,
            labConfig.cameraTarget.y,
            labConfig.cameraTarget.z
        );
        labControls.enableDamping = true;
        labControls.dampingFactor = 0.05;
        labControls.minDistance = 1.5;
        labControls.maxDistance = 20;
        labControls.maxPolarAngle = Math.PI / 2;
    } else {
        console.warn('OrbitControls未加载，将使用基础相机控制');
    }

    // 添加光照
    addLabLighting();

    // 创建实验室环境
    createLabEnvironment();

    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize);
}

/**
 * 添加实验室光照 - 优化光照强度和平衡
 */
function addLabLighting() {
    // 环境光 - 平衡亮度提供自然照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    labScene.add(ambientLight);

    // 主方向光 - 优化强度模拟自然光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(
        labConfig.directionalLightPosition.x,
        labConfig.directionalLightPosition.y,
        labConfig.directionalLightPosition.z
    );
    directionalLight.castShadow = true;

    // 设置阴影参数 - 优化阴影质量和性能平衡
    const shadowCamera = directionalLight.shadow.camera;
    directionalLight.shadow.mapSize.width = 1024; // 平衡质量和性能
    directionalLight.shadow.mapSize.height = 1024;
    shadowCamera.near = 0.5;
    shadowCamera.far = 30; // 减小阴影范围提升性能
    shadowCamera.left = -12;
    shadowCamera.right = 12;
    shadowCamera.top = 12;
    shadowCamera.bottom = -12;

    // 轻微柔化阴影
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.radius = 4;

    labScene.add(directionalLight);

    // 补充光源 - 简化光照系统提升性能
    const fillLight1 = new THREE.DirectionalLight(0xf0f8ff, 0.3);
    fillLight1.position.set(-6, 8, -6);
    fillLight1.castShadow = false;
    labScene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xf0f8ff, 0.25);
    fillLight2.position.set(6, 8, 6);
    fillLight2.castShadow = false;
    labScene.add(fillLight2);

    // 优化点光源配置，减少数量提升性能
    const pointLights = [
        { pos: [0, 5, 0], color: 0xffffff, intensity: 0.4 }, // 中央主光源
        { pos: [-3, 5, -3], color: 0xffffff, intensity: 0.3 }, // 左前角
        { pos: [3, 5, 3], color: 0xffffff, intensity: 0.3 } // 右后角
    ];

    pointLights.forEach(({ pos, color, intensity }) => {
        const pointLight = new THREE.PointLight(color, intensity, 10);
        pointLight.position.set(...pos);
        pointLight.castShadow = false;
        labScene.add(pointLight);
    });

    // 半球光源模拟天空光 - 降低强度
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x2f4f4f, 0.2);
    labScene.add(hemisphereLight);
}

/**
 * 创建实验室环境
 */
function createLabEnvironment() {
    createRealisticFloor();
    createRoomEnvironment();
}

/**
 * 创建真实感地面
 */
function createRealisticFloor() {
    // 主地面 - 使用更真实的实验室地面材质
    const floorGeometry = new THREE.PlaneGeometry(30, 30);

    // 创建地面纹理 - 使用程序化生成的瓷砖效果
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 基础颜色 - 实验室瓷砖白色
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 512, 512);

    // 添加瓷砖接缝
    const tileSize = 64;
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;

    for (let x = 0; x <= 512; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
    }

    for (let y = 0; y <= 512; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
    }

    // 添加微妙的污渍和磨损效果
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 3 + 1;

        ctx.fillStyle = `rgba(200, 200, 200, ${Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 创建纹理
    const floorTexture = new THREE.CanvasTexture(canvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);

    // 创建法线贴图增加表面细节
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = 512;
    normalCanvas.height = 512;
    const normalCtx = normalCanvas.getContext('2d');

    // 基础法线颜色
    normalCtx.fillStyle = '#8080ff';
    normalCtx.fillRect(0, 0, 512, 512);

    // 添加瓷砖边缘的法线变化
    normalCtx.strokeStyle = '#7070ee';
    normalCtx.lineWidth = 1;

    for (let x = 0; x <= 512; x += tileSize) {
        normalCtx.beginPath();
        normalCtx.moveTo(x, 0);
        normalCtx.lineTo(x, 512);
        normalCtx.stroke();
    }

    for (let y = 0; y <= 512; y += tileSize) {
        normalCtx.beginPath();
        normalCtx.moveTo(0, y);
        normalCtx.lineTo(512, y);
        normalCtx.stroke();
    }

    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.repeat.set(4, 4);

    // 创建高级材质
    // 创建地面材质 - 修复兼容性问题
    const floorMaterial = new THREE.MeshLambertMaterial({
        map: floorTexture,
        // 移除不兼容的属性
        color: 0x888888
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.8;
    floor.receiveShadow = true;
    labScene.add(floor);

    // 添加踢脚线
    createBaseboards();

    // 在实验桌周围添加防滑垫
    createAntiSlipMat();
}

/**
 * 创建踢脚线
 */
function createBaseboards() {
    const baseboardHeight = 0.15;
    const baseboardThickness = 0.05;
    const roomSize = 15;

    const baseboardMaterial = new THREE.MeshPhongMaterial({
        color: 0xd0d0d0,
        shininess: 20
    });

    // 四面墙的踢脚线
    const positions = [
        { pos: [0, -0.8 + baseboardHeight / 2, roomSize / 2], rot: [0, 0, 0], size: [roomSize, baseboardHeight, baseboardThickness] },
        { pos: [0, -0.8 + baseboardHeight / 2, -roomSize / 2], rot: [0, 0, 0], size: [roomSize, baseboardHeight, baseboardThickness] },
        { pos: [roomSize / 2, -0.8 + baseboardHeight / 2, 0], rot: [0, Math.PI / 2, 0], size: [roomSize, baseboardHeight, baseboardThickness] },
        { pos: [-roomSize / 2, -0.8 + baseboardHeight / 2, 0], rot: [0, Math.PI / 2, 0], size: [roomSize, baseboardHeight, baseboardThickness] }
    ];

    positions.forEach(({ pos, rot, size }) => {
        const geometry = new THREE.BoxGeometry(...size);
        const baseboard = new THREE.Mesh(geometry, baseboardMaterial);
        baseboard.position.set(...pos);
        baseboard.rotation.set(...rot);
        baseboard.receiveShadow = true;
        baseboard.castShadow = true;
        labScene.add(baseboard);
    });
}

/**
 * 创建实验桌周围的防滑垫
 */
function createAntiSlipMat() {
    const matGeometry = new THREE.PlaneGeometry(8, 6);

    // 创建防滑垫纹理
    const matCanvas = document.createElement('canvas');
    matCanvas.width = 256;
    matCanvas.height = 192;
    const matCtx = matCanvas.getContext('2d');

    // 深蓝色基础
    matCtx.fillStyle = '#1a365d';
    matCtx.fillRect(0, 0, 256, 192);

    // 添加橡胶纹理
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 192;
        const radius = Math.random() * 1.5 + 0.5;

        matCtx.fillStyle = `rgba(45, 85, 135, ${Math.random() * 0.3 + 0.2})`;
        matCtx.beginPath();
        matCtx.arc(x, y, radius, 0, Math.PI * 2);
        matCtx.fill();
    }

    const matTexture = new THREE.CanvasTexture(matCanvas);

    const matMaterial = new THREE.MeshLambertMaterial({
        map: matTexture,
        transparent: true,
        opacity: 0.9
    });

    const mat = new THREE.Mesh(matGeometry, matMaterial);
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = -0.79;
    mat.receiveShadow = true;
    labScene.add(mat);
}

/**
 * 创建房间环境
 */
function createRoomEnvironment() {
    // 添加天花板
    const ceilingGeometry = new THREE.PlaneGeometry(30, 30);
    const ceilingMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 8;
    ceiling.receiveShadow = true;
    labScene.add(ceiling);

    // 添加墙壁
    createWalls();

    // 添加环境装饰
    createEnvironmentalDetails();
}

/**
 * 创建墙壁
 */
function createWalls() {
    const wallHeight = 8.8;
    const roomSize = 15;
    const wallThickness = 0.3; // 增加墙壁厚度

    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0xf8f8f8, // 更亮的白色
        transparent: false, // 完全不透明
        shininess: 10,
        side: THREE.DoubleSide // 双面显示
    });

    // 四面墙 - 更加稳固的设计
    const wallConfigs = [
        { pos: [0, wallHeight / 2 - 0.8, roomSize / 2 + wallThickness / 2], size: [roomSize + wallThickness, wallHeight, wallThickness] }, // 后墙
        { pos: [0, wallHeight / 2 - 0.8, -roomSize / 2 - wallThickness / 2], size: [roomSize + wallThickness, wallHeight, wallThickness] }, // 前墙
        { pos: [roomSize / 2 + wallThickness / 2, wallHeight / 2 - 0.8, 0], size: [wallThickness, wallHeight, roomSize] }, // 右墙
        { pos: [-roomSize / 2 - wallThickness / 2, wallHeight / 2 - 0.8, 0], size: [wallThickness, wallHeight, roomSize] } // 左墙
    ];

    wallConfigs.forEach(({ pos, size }) => {
        const wallGeometry = new THREE.BoxGeometry(...size);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(...pos);
        wall.receiveShadow = true;
        wall.castShadow = true;
        labScene.add(wall);
    });
}

/**
 * 创建环境装饰细节
 */
function createEnvironmentalDetails() {
    // 添加天花板日光灯
    createCeilingLights();

    // 添加电源插座
    createPowerOutlets();

    // 添加实验室家具和设备
    createLabFurniture();

    // 添加实验室安全设备
    createLabSafety();

    // 添加实验室装饰细节
    createLabDecorations();
}

/**
 * 创建实验室家具和设备
 */
function createLabFurniture() {
    // 创建实验室储物柜
    createLabCabinets();

    // 创建实验室工作台
    createWorkbenches();

    // 创建实验室椅子
    createLabChairs();

    // 创建仪器架
    createEquipmentRacks();
}

/**
 * 创建实验室储物柜 - 更加精确的设计（修复着地问题）
 */
function createLabCabinets() {
    const FLOOR_Y = -0.8; // 地面高度
    // 只保留后方的储物柜，删除下方混乱的储物柜
    const cabinetConfigs = [
        { pos: [-6.5, FLOOR_Y + 1, -6.5], size: [1.8, 2, 0.6], color: 0xecf0f1, label: "化学试剂" },
        { pos: [6.5, FLOOR_Y + 1, -6.5], size: [1.8, 2, 0.6], color: 0xecf0f1, label: "实验器材" }
        // 删除了左下和右下的储物柜: [-6.5, FLOOR_Y + 1, 6.5] 和 [6.5, FLOOR_Y + 1, 6.5]
    ];

    cabinetConfigs.forEach(({ pos, size, color, label }) => {
        const cabinetGroup = new THREE.Group();

        // 柜体 - 使用更真实的材质
        const cabinetGeometry = new THREE.BoxGeometry(...size);
        const cabinetMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 60,
            transparent: false
        });
        const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
        cabinet.position.set(0, 0, 0);
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        cabinetGroup.add(cabinet);

        // 柜门 - 更精细的设计
        const doorWidth = size[0] * 0.47;
        const doorHeight = size[1] * 0.85;
        const doorThickness = 0.04;

        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
        const doorMaterial = new THREE.MeshPhongMaterial({
            color: 0xbdc3c7,
            shininess: 80
        });

        // 左门
        const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
        leftDoor.position.set(-size[0] * 0.24, 0, size[2] / 2 + doorThickness / 2);
        leftDoor.castShadow = true;
        cabinetGroup.add(leftDoor);

        // 右门
        const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
        rightDoor.position.set(size[0] * 0.24, 0, size[2] / 2 + doorThickness / 2);
        rightDoor.castShadow = true;
        cabinetGroup.add(rightDoor);

        // 门把手 - 更真实的金属把手
        const handleGeometry = new THREE.BoxGeometry(0.08, 0.02, 0.02);
        const handleMaterial = new THREE.MeshPhongMaterial({
            color: 0x34495e,
            shininess: 100
        });

        const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        leftHandle.position.set(-size[0] * 0.15, 0.1, size[2] / 2 + doorThickness + 0.01);
        cabinetGroup.add(leftHandle);

        const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        rightHandle.position.set(size[0] * 0.15, 0.1, size[2] / 2 + doorThickness + 0.01);
        cabinetGroup.add(rightHandle);

        // 添加柜子标签
        const labelGeometry = new THREE.BoxGeometry(size[0] * 0.8, 0.15, 0.01);
        const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x3498db });
        const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
        labelMesh.position.set(0, size[1] / 2 - 0.1, size[2] / 2 + 0.005);
        cabinetGroup.add(labelMesh);

        // 锁孔
        const lockGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.02);
        const lockMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });

        const leftLock = new THREE.Mesh(lockGeometry, lockMaterial);
        leftLock.position.set(-size[0] * 0.15, -0.1, size[2] / 2 + doorThickness + 0.005);
        leftLock.rotation.x = Math.PI / 2;
        cabinetGroup.add(leftLock);

        const rightLock = new THREE.Mesh(lockGeometry, lockMaterial);
        rightLock.position.set(size[0] * 0.15, -0.1, size[2] / 2 + doorThickness + 0.005);
        rightLock.rotation.x = Math.PI / 2;
        cabinetGroup.add(rightLock);

        cabinetGroup.position.set(...pos);
        labScene.add(cabinetGroup);
    });
}

/**
 * 创建实验室工作台 - 专业实验台设计（修复着地问题）
 */
function createWorkbenches() {
    const FLOOR_Y = -0.8; // 地面高度
    const workbenchConfigs = [
        { pos: [-3.5, FLOOR_Y + 0.45, -5.5], size: [2.5, 0.08, 1.2], color: 0x2c3e50, label: "光学实验台" },
        { pos: [3.5, FLOOR_Y + 0.45, -5.5], size: [2.5, 0.08, 1.2], color: 0x2c3e50, label: "精密测量台" }
    ];

    workbenchConfigs.forEach(({ pos, size, color, label }) => {
        const benchGroup = new THREE.Group();

        // 工作台面 - 黑色实验台面
        const benchGeometry = new THREE.BoxGeometry(...size);
        const benchMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 100
        });
        const bench = new THREE.Mesh(benchGeometry, benchMaterial);
        bench.position.set(0, 0, 0);
        bench.castShadow = true;
        bench.receiveShadow = true;
        benchGroup.add(bench);

        // 添加台面纹理线
        const lineGeometry = new THREE.BoxGeometry(size[0] * 0.95, 0.002, 0.005);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x34495e });

        for (let i = -2; i <= 2; i++) {
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(0, size[1] / 2 + 0.001, i * 0.2);
            benchGroup.add(line);
        }

        // 工作台腿 - 金属支撑结构（修复着地位置）
        const legHeight = 0.9;
        const legRadius = 0.04;
        const legGeometry = new THREE.CylinderGeometry(legRadius, legRadius, legHeight);
        const legMaterial = new THREE.MeshPhongMaterial({
            color: 0x7f8c8d,
            shininess: 50
        });

        // 计算桌腿位置，让它们真正着地
        const legPositions = [
            [-size[0] / 2 + 0.15, -legHeight / 2 - size[1] / 2, -size[2] / 2 + 0.15],
            [size[0] / 2 - 0.15, -legHeight / 2 - size[1] / 2, -size[2] / 2 + 0.15],
            [-size[0] / 2 + 0.15, -legHeight / 2 - size[1] / 2, size[2] / 2 - 0.15],
            [size[0] / 2 - 0.15, -legHeight / 2 - size[1] / 2, size[2] / 2 - 0.15]
        ];

        legPositions.forEach(legPos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...legPos);
            leg.castShadow = true;
            benchGroup.add(leg);
        });

        // 添加横向支撑杆
        const supportGeometry = new THREE.BoxGeometry(size[0] - 0.3, 0.03, 0.03);
        const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x95a5a6 });

        const frontSupport = new THREE.Mesh(supportGeometry, supportMaterial);
        frontSupport.position.set(0, -legHeight / 2 + 0.2, -size[2] / 2 + 0.15);
        benchGroup.add(frontSupport);

        const backSupport = new THREE.Mesh(supportGeometry, supportMaterial);
        backSupport.position.set(0, -legHeight / 2 + 0.2, size[2] / 2 - 0.15);
        benchGroup.add(backSupport);

        // 工作台标签
        const labelGeometry = new THREE.BoxGeometry(size[0] * 0.6, 0.08, 0.01);
        const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
        labelMesh.position.set(0, -size[1] / 2 - 0.05, size[2] / 2 + 0.005);
        benchGroup.add(labelMesh);

        // 删除了黄色水平仪泡，简化实验台设计

        benchGroup.position.set(...pos);
        labScene.add(benchGroup);
    });
}

/**
 * 创建实验室椅子 - 专业实验室椅子设计（修复着地问题）
 */
function createLabChairs() {
    const FLOOR_Y = -0.8; // 地面高度
    // 只保留实验台前的椅子，删除下方混乱的办公椅
    const chairPositions = [
        { pos: [-3.5, FLOOR_Y + 0.3, -4.8], rot: 0, type: "lab" },
        { pos: [3.5, FLOOR_Y + 0.3, -4.8], rot: 0, type: "lab" }
        // 删除了下方的办公椅: [-5.5, FLOOR_Y + 0.3, 3] 和 [5.5, FLOOR_Y + 0.3, 3]
    ];

    chairPositions.forEach(({ pos, rot, type }) => {
        const chairGroup = new THREE.Group();

        if (type === "lab") {
            // 实验室高脚椅
            // 椅座 - 黑色塑料座面
            const seatGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.04);
            const seatMaterial = new THREE.MeshPhongMaterial({
                color: 0x2c3e50,
                shininess: 80
            });
            const seat = new THREE.Mesh(seatGeometry, seatMaterial);
            seat.position.y = 0.65;
            chairGroup.add(seat);

            // 座面边缘
            const seatEdgeGeometry = new THREE.TorusGeometry(0.35, 0.02, 8, 16);
            const seatEdge = new THREE.Mesh(seatEdgeGeometry, seatMaterial);
            seatEdge.position.y = 0.65;
            seatEdge.rotation.x = Math.PI / 2;
            chairGroup.add(seatEdge);

            // 中央支撑柱 - 气动升降柱
            const centralPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6);
            const poleMaterial = new THREE.MeshPhongMaterial({
                color: 0x7f8c8d,
                shininess: 80
            });
            const centralPole = new THREE.Mesh(centralPoleGeometry, poleMaterial);
            centralPole.position.y = 0.35;
            chairGroup.add(centralPole);

            // 气动缸体
            const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2);
            const cylinder = new THREE.Mesh(cylinderGeometry, poleMaterial);
            cylinder.position.y = 0.15;
            chairGroup.add(cylinder);

            // 星形底座 - 5父轮子（修复着地位置）
            const baseGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);

            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const baseLeg = new THREE.Mesh(baseGeometry, poleMaterial);
                baseLeg.position.x = Math.cos(angle) * 0.35;
                baseLeg.position.z = Math.sin(angle) * 0.35;
                baseLeg.position.y = 0.02; // 调整位置使其着地
                baseLeg.rotation.z = Math.cos(angle) * 0.1;
                baseLeg.rotation.x = Math.sin(angle) * 0.1;
                chairGroup.add(baseLeg);

                // 轮子 - 确保轮子接触地面
                const wheelGeometry = new THREE.SphereGeometry(0.04);
                const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x34495e });
                const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                wheel.position.x = Math.cos(angle) * 0.35;
                wheel.position.z = Math.sin(angle) * 0.35;
                wheel.position.y = -0.18; // 调整位置使轮子接触地面
                chairGroup.add(wheel);
            }

            // 靠背 - 可调节靠背
            const backGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.05);
            const backMaterial = new THREE.MeshPhongMaterial({
                color: 0x34495e,
                shininess: 60
            });
            const back = new THREE.Mesh(backGeometry, backMaterial);
            back.position.y = 0.85;
            back.position.z = -0.28;
            chairGroup.add(back);

            // 靠背支撑杆
            const backSupportGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25);
            const backSupport = new THREE.Mesh(backSupportGeometry, poleMaterial);
            backSupport.position.y = 0.75;
            backSupport.position.z = -0.28;
            chairGroup.add(backSupport);

        }
        // 完全删除粉色/紫色办公椅代码，消除实验桌两侧的粉色物块
        // 原有的粉色办公椅代码已被移除以解决用户反馈的粉色物体问题

        chairGroup.position.set(...pos);
        chairGroup.rotation.y = rot;
        chairGroup.castShadow = true;
        labScene.add(chairGroup);
    });
}

/**
 * 创建仪器架 - 简化设计，只保留必要设备架
 */
function createEquipmentRacks() {
    // 暂时注释掉所有设备架，简化实验室环境
    // const FLOOR_Y = -0.8;
    // const rackPositions = [...];
    // 删除了左右两侧的设备架以减少视觉混乱
}


/**
 * 创建天花板日光灯
 */
function createCeilingLights() {
    const lightPositions = [
        { x: -3, y: 7.8, z: 0 },
        { x: 3, y: 7.8, z: 0 },
        { x: 0, y: 7.8, z: -3 },
        { x: 0, y: 7.8, z: 3 }
    ];

    lightPositions.forEach(pos => {
        // 灯具外壳
        const lightGeometry = new THREE.BoxGeometry(2, 0.1, 0.6);
        const lightMaterial = new THREE.MeshBasicMaterial({
            color: 0xe0e0e0
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(pos.x, pos.y, pos.z);
        labScene.add(light);

        // 发光面板
        const panelGeometry = new THREE.PlaneGeometry(1.8, 0.5);
        const panelMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(pos.x, pos.y - 0.06, pos.z);
        panel.rotation.x = -Math.PI / 2;
        labScene.add(panel);
    });
}

/**
 * 创建电源插座
 */
function createPowerOutlets() {
    const outletPositions = [
        { x: 6, y: -0.3, z: 6, rot: [0, -Math.PI / 4, 0] },
        { x: -6, y: -0.3, z: 6, rot: [0, Math.PI / 4, 0] },
        { x: 6, y: -0.3, z: -6, rot: [0, -3 * Math.PI / 4, 0] },
        { x: -6, y: -0.3, z: -6, rot: [0, 3 * Math.PI / 4, 0] }
    ];

    outletPositions.forEach(({ x, y, z, rot }) => {
        const outletGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.03);
        const outletMaterial = new THREE.MeshPhongMaterial({
            color: 0xf0f0f0
        });
        const outlet = new THREE.Mesh(outletGeometry, outletMaterial);
        outlet.position.set(x, y, z);
        outlet.rotation.set(...rot);
        labScene.add(outlet);
    });
}

/**
 * 创建实验室安全设备 - 更加精确的设计（修复着地问题）
 */
function createLabSafety() {
    const FLOOR_Y = -0.8; // 地面高度

    // 灭火器 - 标准红色干粉灭火器（修复着地位置）
    const extinguisherPositions = [
        { pos: [-7.2, FLOOR_Y + 0.4, 0], rot: Math.PI / 2 },
        { pos: [7.2, FLOOR_Y + 0.4, 0], rot: -Math.PI / 2 }
    ];

    extinguisherPositions.forEach(({ pos, rot }) => {
        const extinguisherGroup = new THREE.Group();

        // 灭火器主体 - 红色钢瓶
        const bodyGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.7);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xc0392b,
            shininess: 80
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        extinguisherGroup.add(body);

        // 顶部阈门
        const topGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.12);
        const topMaterial = new THREE.MeshPhongMaterial({
            color: 0x2c3e50,
            shininess: 80
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 0.41;
        extinguisherGroup.add(top);

        // 删除了黄色压力表和安全销，简化灭火器设计

        // 喷嘴软管
        const hoseGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.3);
        const hoseMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        const hose = new THREE.Mesh(hoseGeometry, hoseMaterial);
        hose.position.set(0.08, 0.1, 0);
        hose.rotation.z = Math.PI / 6;
        extinguisherGroup.add(hose);

        // 喷嘴
        const nozzleGeometry = new THREE.ConeGeometry(0.02, 0.06);
        const nozzle = new THREE.Mesh(nozzleGeometry, topMaterial);
        nozzle.position.set(0.15, -0.05, 0);
        nozzle.rotation.z = Math.PI / 6;
        extinguisherGroup.add(nozzle);

        // 灭火器挂架
        const bracketGeometry = new THREE.BoxGeometry(0.2, 0.05, 0.1);
        const bracketMaterial = new THREE.MeshPhongMaterial({ color: 0x95a5a6 });
        const bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
        bracket.position.set(0, -0.4, -0.05);
        extinguisherGroup.add(bracket);

        // 标识牌
        const signGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.01);
        const signMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 0.6, 0.09);
        extinguisherGroup.add(sign);

        // “灭火器”文字区域
        const textGeometry = new THREE.BoxGeometry(0.12, 0.03, 0.001);
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 0.6, 0.095);
        extinguisherGroup.add(textMesh);

        extinguisherGroup.position.set(...pos);
        extinguisherGroup.rotation.z = rot;
        extinguisherGroup.castShadow = true;
        labScene.add(extinguisherGroup);
    });

    // 急救箱 - 标准医疗急救箱（修复着地位置）
    const firstAidPositions = [
        { pos: [-6.8, FLOOR_Y + 1.6, -6.8] },
        { pos: [6.8, FLOOR_Y + 1.6, 6.8] }
    ];

    firstAidPositions.forEach(({ pos }) => {
        const aidGroup = new THREE.Group();

        // 急救箱主体 - 白色塑料箱
        const kitGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.12);
        const kitMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 60
        });
        const kit = new THREE.Mesh(kitGeometry, kitMaterial);
        aidGroup.add(kit);

        // 箱盖边缘
        const lidGeometry = new THREE.BoxGeometry(0.36, 0.26, 0.02);
        const lidMaterial = new THREE.MeshPhongMaterial({
            color: 0xecf0f1,
            shininess: 80
        });
        const lid = new THREE.Mesh(lidGeometry, lidMaterial);
        lid.position.z = 0.07;
        aidGroup.add(lid);

        // 红十字标志 - 更加精确的设计
        const crossVGeometry = new THREE.BoxGeometry(0.03, 0.15, 0.001);
        const crossHGeometry = new THREE.BoxGeometry(0.15, 0.03, 0.001);
        const crossMaterial = new THREE.MeshBasicMaterial({ color: 0xe74c3c });

        const crossV = new THREE.Mesh(crossVGeometry, crossMaterial);
        crossV.position.set(0, 0, 0.08);
        aidGroup.add(crossV);

        const crossH = new THREE.Mesh(crossHGeometry, crossMaterial);
        crossH.position.set(0, 0, 0.08);
        aidGroup.add(crossH);

        // 手提把手
        const handleGeometry = new THREE.TorusGeometry(0.02, 0.008, 6, 12);
        const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(0, 0.15, 0);
        handle.rotation.x = Math.PI / 2;
        aidGroup.add(handle);

        // 锁扣
        const latchGeometry = new THREE.BoxGeometry(0.04, 0.02, 0.015);
        const latchMaterial = new THREE.MeshPhongMaterial({ color: 0x34495e });
        const latch = new THREE.Mesh(latchGeometry, latchMaterial);
        latch.position.set(0, -0.1, 0.065);
        aidGroup.add(latch);

        // “FIRST AID”标签
        const labelGeometry = new THREE.BoxGeometry(0.25, 0.04, 0.001);
        const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x27ae60 });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(0, -0.08, 0.08);
        aidGroup.add(label);

        aidGroup.position.set(...pos);
        aidGroup.castShadow = true;
        labScene.add(aidGroup);
    });

    // 安全标识牌 - 更加专业的设计（修复着地位置）
    const signConfigs = [
        { pos: [0, FLOOR_Y + 2, -7.4], text: "实验室安全规范", color: 0x3498db, icon: "info" },
        { pos: [-7.4, FLOOR_Y + 2, 0], text: "禁止吸烟", color: 0xe74c3c, icon: "warning" },
        { pos: [7.4, FLOOR_Y + 2, 0], text: "注意安全", color: 0xf39c12, icon: "caution" }
    ];

    signConfigs.forEach(({ pos, text, color, icon }) => {
        const signGroup = new THREE.Group();

        // 标识牌背景
        const signGeometry = new THREE.BoxGeometry(1.4, 0.7, 0.05);
        const signMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 30
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        signGroup.add(sign);

        // 彩色边框
        const frameGeometry = new THREE.BoxGeometry(1.45, 0.75, 0.02);
        const frameMaterial = new THREE.MeshPhongMaterial({ color: color });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = 0.035;
        signGroup.add(frame);

        // 图标区域
        let iconGeometry;
        if (icon === "warning") {
            iconGeometry = new THREE.ConeGeometry(0.08, 0.15, 3);
        } else if (icon === "info") {
            iconGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05);
        } else {
            iconGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.01);
        }

        const iconMaterial = new THREE.MeshBasicMaterial({ color: color });
        const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
        iconMesh.position.set(-0.4, 0.1, 0.03);
        if (icon === "warning") iconMesh.rotation.z = Math.PI;
        signGroup.add(iconMesh);

        // 文字区域背景
        const textBgGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.001);
        const textBgMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f9fa });
        const textBg = new THREE.Mesh(textBgGeometry, textBgMaterial);
        textBg.position.set(0.2, -0.1, 0.026);
        signGroup.add(textBg);

        signGroup.position.set(...pos);
        signGroup.castShadow = true;
        labScene.add(signGroup);
    });
}

/**
 * 创建实验室装饰细节（修复着地问题）
 */
function createLabDecorations() {
    const FLOOR_Y = -0.8; // 地面高度

    // 墙上时钟
    const clockPos = [0, FLOOR_Y + 2.5, 7.4];
    const clockGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.05);
    const clockMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const clock = new THREE.Mesh(clockGeometry, clockMaterial);
    clock.position.set(...clockPos);
    clock.rotation.x = Math.PI / 2;
    clock.castShadow = true;
    labScene.add(clock);

    // 时针
    const hourHandGeometry = new THREE.BoxGeometry(0.01, 0.15, 0.001);
    const handMaterial = new THREE.MeshBasicMaterial({ color: 0x2c3e50 });
    const hourHand = new THREE.Mesh(hourHandGeometry, handMaterial);
    hourHand.position.set(clockPos[0], clockPos[1], clockPos[2] + 0.03);
    hourHand.rotation.z = Math.PI / 6;
    labScene.add(hourHand);

    const minuteHand = new THREE.Mesh(hourHandGeometry, handMaterial);
    minuteHand.position.set(clockPos[0], clockPos[1], clockPos[2] + 0.03);
    minuteHand.rotation.z = Math.PI / 3;
    labScene.add(minuteHand);

    // 温湿度计
    const thermPos = [6.8, FLOOR_Y + 1.8, 0];
    const thermGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.05);
    const thermMaterial = new THREE.MeshPhongMaterial({ color: 0xf8f9fa });
    const therm = new THREE.Mesh(thermGeometry, thermMaterial);
    therm.position.set(...thermPos);
    therm.castShadow = true;
    labScene.add(therm);

    // 显示屏
    const screenGeometry = new THREE.BoxGeometry(0.12, 0.08, 0.001);
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x2c3e50 });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(thermPos[0], thermPos[1] + 0.05, thermPos[2] + 0.026);
    labScene.add(screen);

    // 实验室海报
    const posterConfigs = [
        { pos: [-3, FLOOR_Y + 2, -7.4], size: [1.2, 0.8], color: 0xe8f4fd },
        { pos: [3, FLOOR_Y + 2, -7.4], size: [1.2, 0.8], color: 0xfef9e7 },
        { pos: [-7.4, FLOOR_Y + 2, -3], size: [0.8, 1.2], color: 0xf0fff4 }
    ];

    posterConfigs.forEach(({ pos, size, color }) => {
        const posterGeometry = new THREE.BoxGeometry(size[0], size[1], 0.02);
        const posterMaterial = new THREE.MeshPhongMaterial({ color: color });
        const poster = new THREE.Mesh(posterGeometry, posterMaterial);
        poster.position.set(...pos);
        poster.castShadow = true;
        labScene.add(poster);
    });

    // 植物 - 只保留左上角一盆，删除右下角混乱的植物
    const plantPositions = [
        { pos: [-6.5, FLOOR_Y + 0.2, -6.5] }
        // 删除了右下角的植物: [6.5, FLOOR_Y + 0.2, 6.5]
    ];

    plantPositions.forEach(({ pos }) => {
        // 花盆 - 确保着地
        const potGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.2);
        const potMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
        const pot = new THREE.Mesh(potGeometry, potMaterial);
        pot.position.set(...pos);
        pot.castShadow = true;
        labScene.add(pot);

        // 植物
        const plantGeometry = new THREE.ConeGeometry(0.1, 0.4, 8);
        const plantMaterial = new THREE.MeshPhongMaterial({ color: 0x228b22 });
        const plant = new THREE.Mesh(plantGeometry, plantMaterial);
        plant.position.set(pos[0], pos[1] + 0.3, pos[2]);
        plant.castShadow = true;
        labScene.add(plant);
    });

    // 计算机 - 确保放在工作台上
    const computerPositions = [
        { pos: [-3.5, FLOOR_Y + 0.55, -5.7] },
        { pos: [3.5, FLOOR_Y + 0.55, -5.7] }
    ];

    computerPositions.forEach(({ pos }) => {
        // 显示器
        const monitorGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.05);
        const monitorMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        const monitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
        monitor.position.set(pos[0], pos[1] + 0.2, pos[2]);
        monitor.castShadow = true;
        labScene.add(monitor);

        // 屏幕
        const compScreenGeometry = new THREE.BoxGeometry(0.55, 0.35, 0.001);
        const compScreenMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const compScreen = new THREE.Mesh(compScreenGeometry, compScreenMaterial);
        compScreen.position.set(pos[0], pos[1] + 0.2, pos[2] + 0.026);
        labScene.add(compScreen);

        // 键盘 - 确保放在工作台上
        const keyboardGeometry = new THREE.BoxGeometry(0.4, 0.02, 0.15);
        const keyboardMaterial = new THREE.MeshPhongMaterial({ color: 0x34495e });
        const keyboard = new THREE.Mesh(keyboardGeometry, keyboardMaterial);
        keyboard.position.set(pos[0], pos[1], pos[2] + 0.3);
        keyboard.castShadow = true;
        labScene.add(keyboard);

        // 鼠标 - 确保放在工作台上
        const mouseGeometry = new THREE.BoxGeometry(0.06, 0.02, 0.1);
        const mouse = new THREE.Mesh(mouseGeometry, keyboardMaterial);
        mouse.position.set(pos[0] + 0.3, pos[1], pos[2] + 0.2);
        mouse.castShadow = true;
        labScene.add(mouse);
    });

    // 垃圾桶 - 只保留一个，删除下方混乱的多个垃圾桶
    const binPositions = [
        { pos: [-5, FLOOR_Y + 0.15, -6.5], color: 0x2ecc71 }
        // 删除了下方的垃圾桶: [5, FLOOR_Y + 0.15, -6.5] 和 [0, FLOOR_Y + 0.15, 6.5]
    ];

    binPositions.forEach(({ pos, color }) => {
        const binGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.3);
        const binMaterial = new THREE.MeshPhongMaterial({ color: color });
        const bin = new THREE.Mesh(binGeometry, binMaterial);
        bin.position.set(...pos);
        bin.castShadow = true;
        labScene.add(bin);

        // 垃圾桶盖
        const lidGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.02);
        const lid = new THREE.Mesh(lidGeometry, binMaterial);
        lid.position.set(pos[0], pos[1] + 0.16, pos[2]);
        lid.castShadow = true;
        labScene.add(lid);
    });
}

/**
 * 创建实验桌
 */
function createExperimentTable() {
    const tableGroup = new THREE.Group();

    // 桌面
    const tableGeometry = new THREE.BoxGeometry(
        labConfig.tableWidth,
        labConfig.tableHeight,
        labConfig.tableDepth
    );
    const tableMaterial = new THREE.MeshPhongMaterial({
        color: labConfig.tableColor,
        shininess: 30
    });
    const tableTop = new THREE.Mesh(tableGeometry, tableMaterial);
    tableTop.position.y = 0;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    // 桌腿 - 优化比例和位置，更加稳固合理
    const legHeight = 1.4; // 调整桌腿高度使比例更合理
    const legRadius = 0.08; // 适当增加桌腿粗度提供更好支撑
    const legGeometry = new THREE.CylinderGeometry(legRadius, legRadius, legHeight);
    const legMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a5a5a, // 使用更深的金属色
        shininess: 60
    });

    const legPositions = [
        { x: labConfig.tableWidth / 2 - 0.25, z: labConfig.tableDepth / 2 - 0.25 },
        { x: -labConfig.tableWidth / 2 + 0.25, z: labConfig.tableDepth / 2 - 0.25 },
        { x: labConfig.tableWidth / 2 - 0.25, z: -labConfig.tableDepth / 2 + 0.25 },
        { x: -labConfig.tableWidth / 2 + 0.25, z: -labConfig.tableDepth / 2 + 0.25 }
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        // 精确计算桌腿位置，确保着地且支撑稳固
        leg.position.set(pos.x, -legHeight / 2 - labConfig.tableHeight / 2, pos.z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        tableGroup.add(leg);
    });

    // 添加桌腿间的横向支撑，增加稳定性
    const supportMaterial = new THREE.MeshPhongMaterial({
        color: 0x6a6a6a,
        shininess: 40
    });

    // 前后支撑杆
    const frontSupportGeometry = new THREE.BoxGeometry(labConfig.tableWidth - 0.5, 0.04, 0.04);
    const frontSupport = new THREE.Mesh(frontSupportGeometry, supportMaterial);
    frontSupport.position.set(0, -legHeight + 0.3, labConfig.tableDepth / 2 - 0.25);
    tableGroup.add(frontSupport);

    const backSupport = new THREE.Mesh(frontSupportGeometry, supportMaterial);
    backSupport.position.set(0, -legHeight + 0.3, -labConfig.tableDepth / 2 + 0.25);
    tableGroup.add(backSupport);

    // 移除左右支撑杆，消除实验桌两侧的不明物块
    // const sideSupportGeometry = new THREE.BoxGeometry(0.04, 0.04, labConfig.tableDepth - 0.5);
    // const leftSupport = new THREE.Mesh(sideSupportGeometry, supportMaterial);
    // leftSupport.position.set(-labConfig.tableWidth/2 + 0.25, -legHeight + 0.3, 0);
    // tableGroup.add(leftSupport);

    // const rightSupport = new THREE.Mesh(sideSupportGeometry, supportMaterial);
    // rightSupport.position.set(labConfig.tableWidth/2 - 0.25, -legHeight + 0.3, 0);
    // tableGroup.add(rightSupport);

    experimentTable = tableGroup;
    labScene.add(experimentTable);
}

/**
 * 创建现象显示器
 */
async function createMonitorDisplay() {
    const monitorGroup = new THREE.Group();

    // 显示器外壳
    const monitorGeometry = new THREE.BoxGeometry(
        labConfig.monitorWidth,
        labConfig.monitorHeight,
        labConfig.monitorDepth
    );
    const monitorMaterial = new THREE.MeshPhongMaterial({
        color: 0x2a2a2a,
        shininess: 100
    });
    const monitorFrame = new THREE.Mesh(monitorGeometry, monitorMaterial);
    monitorFrame.castShadow = true;
    monitorGroup.add(monitorFrame);

    // 创建Canvas和纹理
    try {
        monitorCanvas = document.createElement('canvas');
        monitorCanvas.width = 1600; // 提高Canvas分辨率以匹配更大的显示器
        monitorCanvas.height = 1200; // 提高Canvas分辨率以确保牛顿环现象的清晰度

        // 获取2D渲染上下文
        monitorContext = monitorCanvas.getContext('2d');
        if (!monitorContext) {
            throw new Error('无法创建Canvas 2D上下文');
        }

        // 创建纹理
        monitorTexture = new THREE.CanvasTexture(monitorCanvas);
        monitorTexture.minFilter = THREE.LinearFilter;
        monitorTexture.magFilter = THREE.LinearFilter;

    } catch (error) {
        console.error('创建Canvas纹理失败:', error);
        // 使用黑色材质作为降级方案
        monitorTexture = null;
    }

    // 屏幕
    const screenGeometry = new THREE.PlaneGeometry(labConfig.screenWidth, labConfig.screenHeight);
    let screenMaterial;

    if (monitorTexture) {
        screenMaterial = new THREE.MeshBasicMaterial({
            map: monitorTexture,
            transparent: true
        });
    } else {
        screenMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    }

    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = labConfig.monitorDepth / 2 + 0.01;
    monitorGroup.add(screen);

    // 显示器支架系统 - 完整的底座+立柱+连接块
    const standMaterial = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 100 });
    const baseHeight = 0.08;
    const postHeight = 0.4;

    // 1. 底座
    const baseGeometry = new THREE.CylinderGeometry(0.35, 0.35, baseHeight);
    const base = new THREE.Mesh(baseGeometry, standMaterial);
    // 将底座放在显示器下方
    base.position.y = -labConfig.monitorHeight / 2 - postHeight - (baseHeight / 2);
    base.castShadow = true;
    base.receiveShadow = true;
    monitorGroup.add(base);

    // 2. 立柱
    const postGeometry = new THREE.CylinderGeometry(0.06, 0.06, postHeight);
    const post = new THREE.Mesh(postGeometry, standMaterial);
    post.position.y = -labConfig.monitorHeight / 2 - (postHeight / 2);
    post.castShadow = true;
    monitorGroup.add(post);

    // 3. 连接块 (连接立柱和显示器)
    const connectorGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const connector = new THREE.Mesh(connectorGeometry, standMaterial);
    connector.position.y = -labConfig.monitorHeight / 2;
    connector.position.z = -labConfig.monitorDepth / 2 - 0.05;
    monitorGroup.add(connector);

    // 设置显示器位置 - 精确计算，确保底座稳固放置在桌面上
    const tableTopY = labConfig.tableHeight / 2; // 桌面上表面Y坐标
    // 显示器组原点到底座底部的距离
    const standBottomOffset = Math.abs(-labConfig.monitorHeight / 2 - postHeight - baseHeight);
    const finalMonitorY = tableTopY + standBottomOffset + 0.02; // 添加小间隙防止z-fighting

    monitorGroup.position.set(
        labConfig.monitorPosition.x,
        finalMonitorY, // 使用计算后的Y值
        labConfig.monitorPosition.z
    );

    monitorDisplay = monitorGroup;
    labScene.add(monitorDisplay);
}

/**
 * 加载牛顿环仪模型
 */
async function loadNewtonApparatus() {
    return new Promise((resolve, reject) => {
        // 检查GLTFLoader是否可用
        if (typeof THREE.GLTFLoader === 'undefined') {
            reject(new Error('GLTFLoader未加载，无法加载GLB模型'));
            return;
        }

        const loader = new THREE.GLTFLoader();

        // 尝试多个可能的路径（优先ASCII文件名，避免中文编码问题）
        const modelPaths = [
            './newton-apparatus.glb',
            'newton-apparatus.glb',
            './牛顿环仪.glb',
            '牛顿环仪.glb',
            '/牛顿环仪.glb',
            // URL 编码版本（处理中文文件名）
            './%E7%89%9B%E9%A1%BF%E7%8E%AF%E4%BB%AA.glb',
            '%E7%89%9B%E9%A1%BF%E7%8E%AF%E4%BB%AA.glb',
            '/%E7%89%9B%E9%A1%BF%E7%8E%AF%E4%BB%AA.glb'
        ];

        let currentPathIndex = 0;

        function tryLoadModel() {
            if (currentPathIndex >= modelPaths.length) {
                reject(new Error('所有GLB模型路径都无法加载'));
                return;
            }

            const currentPath = modelPaths[currentPathIndex];
            console.log(`尝试加载GLB模型路径: ${currentPath}`);

            loader.load(
                encodeURI(currentPath),
                (gltf) => {
                    console.log('牛顿环仪模型加载成功，路径:', currentPath);

                    newtonApparatus = gltf.scene;

                    if (!newtonApparatus) {
                        reject(new Error('GLB文件中没有找到场景数据'));
                        return;
                    }

                    console.log('模型场景对象:', newtonApparatus);
                    console.log('模型边界盒计算中...');

                    // 计算模型边界盒
                    const box = new THREE.Box3().setFromObject(newtonApparatus);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    console.log('模型原始尺寸:', size);
                    console.log('模型原始中心:', center);

                    // 调整模型大小和位置，确保正确放置在实验桌上
                    // 根据模型实际大小调整缩放
                    const targetSize = 1.2; // 调大模型目标最大边长到 1.2
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    const scaleFactor = maxDimension > 0 ? targetSize / maxDimension : 1;

                    newtonApparatus.scale.set(scaleFactor, scaleFactor, scaleFactor);

                    // 调整位置：将模型底部贴在实验桌面上并居中
                    newtonApparatus.position.set(
                        labConfig.apparatusPosition.x,
                        0, // 先设为0，之后按包围盒精确对齐到桌面
                        labConfig.apparatusPosition.z
                    );
                    newtonApparatus.updateMatrixWorld(true);
                    const boxAfterScale = new THREE.Box3().setFromObject(newtonApparatus);
                    const modelBottomY = boxAfterScale.min.y;
                    const tableTopY = labConfig.tableHeight / 2; // 桌面上表面Y
                    const epsilon = 0.005;
                    const lift = (tableTopY + epsilon) - modelBottomY;
                    newtonApparatus.position.y += lift;
                    newtonApparatus.updateMatrixWorld(true);

                    console.log('调整后的缩放:', scaleFactor);
                    console.log('调整后的位置:', newtonApparatus.position);

                    // 安全地遍历模型，增强材质可见性
                    if (newtonApparatus.traverse && typeof newtonApparatus.traverse === 'function') {
                        newtonApparatus.traverse((child) => {
                            if (child && child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;

                                // 安全地调整材质，增强可见性
                                if (child.material) {
                                    try {
                                        // 如果是PBR材质
                                        if (child.material.metalness !== undefined) {
                                            child.material.metalness = 0.1;
                                        }
                                        if (child.material.roughness !== undefined) {
                                            child.material.roughness = 0.8;
                                        }
                                        // 增强颜色对比度
                                        if (child.material.color) {
                                            child.material.color.multiplyScalar(1.2);
                                        }
                                        // 确保材质可见
                                        if (child.material.visible !== undefined) {
                                            child.material.visible = true;
                                        }
                                        // 添加环境光影响
                                        if (child.material.envMapIntensity !== undefined) {
                                            child.material.envMapIntensity = 0.3;
                                        }
                                    } catch (materialError) {
                                        console.warn('调整材质属性时出错:', materialError);
                                    }
                                }
                            }
                        });
                    }

                    labScene.add(newtonApparatus);
                    console.log('牛顿环仪模型已添加到场景');
                    resolve();
                },
                (progress) => {
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total * 100).toFixed(1);
                        console.log(`牛顿环仪模型加载进度 (${currentPath}): ${percent}%`);
                    }
                },
                (error) => {
                    console.error(`模型加载失败 (${currentPath}):`, error);
                    currentPathIndex++;
                    tryLoadModel(); // 尝试下一个路径
                }
            );
        }

        tryLoadModel();
    });
}

/**
 * 创建占位符牛顿环仪（当GLB加载失败时使用）
 */
function createPlaceholderApparatus() {
    console.log('创建牛顿环仪占位符...');
    const apparatusGroup = new THREE.Group();

    // 创建底座（金属色）
    const baseGeometry = new THREE.CylinderGeometry(1.2, 1.5, 0.3);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x404040,
        shininess: 100
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.15;
    base.castShadow = true;
    base.receiveShadow = true;
    apparatusGroup.add(base);

    // 创建主支撑柱
    const pillarGeometry = new THREE.CylinderGeometry(0.12, 0.15, 1.8);
    const pillarMaterial = new THREE.MeshPhongMaterial({
        color: 0x606060,
        shininess: 80
    });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.y = 1.2;
    pillar.castShadow = true;
    apparatusGroup.add(pillar);

    // 创建上方透镜固定装置
    const upperFixtureGeometry = new THREE.CylinderGeometry(0.6, 0.4, 0.2);
    const upperFixtureMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        shininess: 60
    });
    const upperFixture = new THREE.Mesh(upperFixtureGeometry, upperFixtureMaterial);
    upperFixture.position.y = 2.2;
    upperFixture.castShadow = true;
    apparatusGroup.add(upperFixture);

    // 创建下方平凸透镜（玻璃材质）
    const lowerLensGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05);
    const lowerLensMaterial = new THREE.MeshPhongMaterial({
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.3,
        shininess: 100,
        reflectivity: 0.9
    });
    const lowerLens = new THREE.Mesh(lowerLensGeometry, lowerLensMaterial);
    lowerLens.position.y = 0.35;
    apparatusGroup.add(lowerLens);

    // 创建上方平凸透镜（可调节的）
    const upperLensGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05);
    const upperLensMaterial = new THREE.MeshPhongMaterial({
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.3,
        shininess: 100,
        reflectivity: 0.9
    });
    const upperLens = new THREE.Mesh(upperLensGeometry, upperLensMaterial);
    upperLens.position.y = 2.0;
    apparatusGroup.add(upperLens);

    // 创建调节螺丝（3个）
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        const screwGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4);
        const screwMaterial = new THREE.MeshPhongMaterial({ color: 0x404040 });
        const screw = new THREE.Mesh(screwGeometry, screwMaterial);

        screw.position.x = Math.cos(angle) * 0.8;
        screw.position.z = Math.sin(angle) * 0.8;
        screw.position.y = 1.2;
        screw.castShadow = true;
        apparatusGroup.add(screw);
    }

    // 添加标识牌（更小更专业）
    const labelGeometry = new THREE.PlaneGeometry(2.0, 0.6);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 400;
    labelCanvas.height = 120;
    const labelCtx = labelCanvas.getContext('2d');

    // 绘制专业标识
    labelCtx.fillStyle = '#f0f0f0';
    labelCtx.fillRect(0, 0, 400, 120);
    labelCtx.strokeStyle = '#333333';
    labelCtx.lineWidth = 3;
    labelCtx.strokeRect(3, 3, 394, 114);

    labelCtx.fillStyle = '#333333';
    labelCtx.font = 'bold 36px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText('牛顿环实验仪', 200, 50);

    labelCtx.font = '24px Arial';
    labelCtx.fillStyle = '#666666';
    labelCtx.fillText('Newton Ring Apparatus', 200, 85);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 2.8;
    label.position.z = 0.5;
    apparatusGroup.add(label);

    // 设置位置到实验桌中央
    apparatusGroup.position.set(0, 0, 0);

    newtonApparatus = apparatusGroup;
    labScene.add(newtonApparatus);

    console.log('专业牛顿环仪占位符已创建！');
}

/**
 * 初始化显示器屏幕内容
 */
function initMonitorScreen() {
    try {
        // 尝试创建Monitor3DIntegration实例
        console.log('正在检查Monitor3DIntegration类可用性...');
        console.log('typeof Monitor3DIntegration:', typeof Monitor3DIntegration);
        console.log('monitorCanvas:', monitorCanvas);
        console.log('monitorTexture:', monitorTexture);

        if (typeof Monitor3DIntegration !== 'undefined' && monitorCanvas && monitorTexture) {
            try {
                console.log('正在创建Monitor3DIntegration实例...');
                monitorDemo = new Monitor3DIntegration(monitorCanvas, monitorTexture);
                console.log('Monitor3DIntegration实例创建成功:', monitorDemo);
                console.log('可用方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(monitorDemo)));
            } catch (demoError) {
                console.warn('创建Monitor3DIntegration实例失败:', demoError);
                console.warn('错误堆栈:', demoError.stack);
                monitorDemo = null;
                // 显示待机画面作为降级方案
                showMonitorStandby();
            }
        } else {
            console.log('Monitor3DIntegration类不可用或Canvas未创建，将使用静态显示');
            console.log('Monitor3DIntegration类是否存在:', typeof Monitor3DIntegration !== 'undefined');
            console.log('Canvas是否存在:', !!monitorCanvas);
            console.log('Texture是否存在:', !!monitorTexture);
            monitorDemo = null;
            // 显示待机画面
            showMonitorStandby();
        }

    } catch (error) {
        console.error('初始化显示器屏幕内容时出错:', error);
        // 显示待机画面作为降级方案
        showMonitorStandby();
    }
}

/**
 * 显示器待机画面
 */
function showMonitorStandby() {
    if (!monitorCanvas) {
        console.warn('Canvas不可用，跳过显示器内容更新');
        return;
    }

    try {
        // 直接获取2D上下文
        const ctx = monitorCanvas.getContext('2d');
        if (!ctx) {
            console.warn('无法获取Canvas 2D上下文，跳过显示器内容更新');
            return;
        }

        // 清空画布
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, monitorCanvas.width, monitorCanvas.height);

        // 绘制待机文字
        ctx.fillStyle = '#00ff00';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            '牛顿环实验演示系统',
            monitorCanvas.width / 2,
            monitorCanvas.height / 2 - 50
        );

        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Arial';
        ctx.fillText(
            '点击\"调整牛顿环仪\"开始观察',
            monitorCanvas.width / 2,
            monitorCanvas.height / 2 + 20
        );
        ctx.fillText(
            '点击\"调节光源\"查看光学演示',
            monitorCanvas.width / 2,
            monitorCanvas.height / 2 + 60
        );

        // 更新纹理
        if (monitorTexture) {
            monitorTexture.needsUpdate = true;
        }

    } catch (canvasError) {
        console.error('更新显示器内容时出错:', canvasError);
    }
}

/**
 * 绑定控制事件
 */
function bindControlEvents() {
    // 安全地获取按钮元素
    const buttons = {
        start: document.getElementById('start-experiment'),
        adjust: document.getElementById('adjust-apparatus'),
        light: document.getElementById('adjust-light'),
        reset: document.getElementById('reset-experiment'),
        end: document.getElementById('end-experiment')
    };

    // 绑定事件监听器
    if (buttons.start) {
        buttons.start.addEventListener('click', startExperiment);
    } else {
        console.warn('未找到\"开始实验\"按钮');
    }

    if (buttons.adjust) {
        buttons.adjust.addEventListener('click', adjustApparatus);
    } else {
        console.warn('未找到\"调整牛顿环仪\"按钮');
    }

    if (buttons.light) {
        buttons.light.addEventListener('click', adjustLight);
    } else {
        console.warn('未找到\"调节光源\"按钮');
    }

    if (buttons.reset) {
        buttons.reset.addEventListener('click', resetExperiment);
    } else {
        console.warn('未找到\"重置实验\"按钮');
    }

    if (buttons.end) {
        buttons.end.addEventListener('click', endExperiment);
    } else {
        console.warn('未找到\"结束实验\"按钮');
    }

    // 初始化按钮状态
    updateControlButtons();
}

/**
 * 开始实验
 */
function startExperiment() {
    console.log('开始实验...');

    try {
        // 进入全屏模式
        enterFullscreen();

        // 调整相机视角到牛顿环仪
        focusOnApparatus();

        isExperimentRunning = true;
        updateControlButtons();

    } catch (error) {
        console.error('开始实验时出错:', error);
        alert('开始实验失败: ' + error.message);
    }
}

/**
 * 调整牛顿环仪
 */
function adjustApparatus() {
    if (!isExperimentRunning) {
        alert('请先点击\"开始实验\"');
        return;
    }

    console.log('显示牛顿环仪调节面板...');
    try {
        // 首先切换视角到正对显示器
        focusOnMonitor();

        // 隐藏另一个面板
        const lightPanel = document.getElementById('light-adjustment-panel');
        if (lightPanel) lightPanel.style.display = 'none';

        // 显示调节面板
        const apparatusPanel = document.getElementById('apparatus-adjustment-panel');
        if (apparatusPanel) {
            apparatusPanel.style.display = 'block';

            // 绑定事件
            if (!apparatusPanel.hasAttribute('data-events-bound')) {
                bindApparatusPanelEvents();
                apparatusPanel.setAttribute('data-events-bound', 'true');
            }
        }

        // 延迟一点时间开始手动模式，让相机先移动到位
        setTimeout(() => {
            if (monitorDemo && typeof monitorDemo.startManualMode === 'function') {
                monitorDemo.startManualMode();

                // 初始化状态
                const pressureSlider = document.getElementById('pressure-slider');
                const positionSlider = document.getElementById('position-slider');
                if (pressureSlider && positionSlider) {
                    monitorDemo.updateManualState(parseInt(pressureSlider.value), parseInt(positionSlider.value));
                }
            } else {
                console.warn('显示器3D集成实例不可用，或不支持手动模式');
                showInterferencePattern();
            }
        }, 1000);
    } catch (error) {
        console.error('调整牛顿环仪时出错:', error);
        showInterferencePattern();
    }
}

/**
 * 隐藏牛顿环仪调节面板
 */
function hideApparatusAdjustmentPanel() {
    const panel = document.getElementById('apparatus-adjustment-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * 绑定牛顿环仪调节面板事件
 */
function bindApparatusPanelEvents() {
    const closeBtn = document.getElementById('close-apparatus-panel');
    const pressureSlider = document.getElementById('pressure-slider');
    const pressureValue = document.getElementById('pressure-value');
    const positionSlider = document.getElementById('position-slider');
    const crosshairMm = document.getElementById('crosshair-mm');

    // 关闭按钮
    if (closeBtn) {
        closeBtn.addEventListener('click', hideApparatusAdjustmentPanel);
    }

    const updateManualState = () => {
        if (monitorDemo && typeof monitorDemo.updateManualState === 'function') {
            const pressure = parseInt(pressureSlider.value);
            const position = -parseInt(positionSlider.value); // 反转X移动方向以符合符合常理的平移效果
            monitorDemo.updateManualState(pressure, position);
        }
    };

    // 压力滑块
    if (pressureSlider && pressureValue) {
        pressureSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (val === 0) {
                pressureValue.textContent = '未接触 (0%)';
            } else if (val < 20) {
                pressureValue.textContent = `轻微接触 (${val}%)`;
            } else if (val < 60) {
                pressureValue.textContent = `中等压力 (${val}%)`;
            } else {
                pressureValue.textContent = `完全压紧 (${val}%)`;
            }
            updateManualState();
        });
    }

    // 位移滑块
    if (positionSlider && crosshairMm) {
        positionSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            // 将 -50~50 映射到 -5.000 ~ 5.000 mm
            const mmValue = (val * 0.1).toFixed(3);
            crosshairMm.textContent = mmValue;
            updateManualState();
        });
    }
}

/**
 * 调节光源
 */
function adjustLight() {
    if (!isExperimentRunning) {
        alert('请先点击\"开始实验\"');
        return;
    }

    console.log('调节光源...');

    try {
        // 首先切换视角到正对显示器
        focusOnMonitor();

        // 显示光源调节面板
        showLightAdjustmentPanel();

        // 不自动启动演示，让用户通过面板控制
        console.log('光源调节面板已打开，请使用面板调节波长');

        // 确保显示器有内容可以调节
        setTimeout(() => {
            if (monitorDemo) {
                // 如果演示没有运行，显示静态的牛顿环以便调节
                if (!monitorDemo.isDemoPlaying) {
                    console.log('显示静态牛顿环以便进行波长调节');
                    // 不启动完整演示，只渲染一帧静态内容
                    if (typeof monitorDemo.render === 'function') {
                        monitorDemo.render();
                    }
                }
            } else {
                // 降级到静态显示
                showInterferencePattern();
            }
        }, 300);
    } catch (error) {
        console.error('调节光源时出错:', error);
        showLightDemo(); // 降级到静态显示
    }
}

/**
 * 重置实验
 */
function resetExperiment() {
    console.log('重置实验...');

    try {
        // 关闭光源调节面板
        hideLightAdjustmentPanel();

        // 重置实验运行状态
        isExperimentRunning = false;

        // 强制停止并重置显示器演示
        if (monitorDemo) {
            // 停止演示
            if (typeof monitorDemo.pauseDemo === 'function') {
                monitorDemo.pauseDemo();
            }
            // 重置演示
            if (typeof monitorDemo.resetDemo === 'function') {
                monitorDemo.resetDemo();
            }
        }

        // 强制清除显示器内容
        forceClearMonitorDisplay();

        // 延迟确保清除完成后再显示待机画面
        setTimeout(() => {
            showMonitorStandby();
            // 更新纹理
            if (monitorTexture) {
                monitorTexture.needsUpdate = true;
            }
        }, 200);

        // 重置相机视角到初始位置
        resetCameraView();

        // 退出全屏模式
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.warn('退出全屏失败:', err);
            });
        }

        // 重置波长到默认值
        resetWavelengthToDefault();

        // 更新按钮状态
        updateControlButtons();

        console.log('实验重置完成');

    } catch (error) {
        console.error('重置实验时出错:', error);
        // 即使出错也要尝试显示待机画面
        showMonitorStandby();
    }
}

/**
 * 重置波长到默认值
 */
function resetWavelengthToDefault() {
    const defaultWavelength = 589; // 黄光

    // 重置滑块值
    const wavelengthSlider = document.getElementById('wavelength-slider');
    if (wavelengthSlider) {
        wavelengthSlider.value = defaultWavelength;
    }

    // 重置显示值
    const wavelengthValue = document.getElementById('wavelength-value');
    if (wavelengthValue) {
        wavelengthValue.textContent = defaultWavelength + ' nm';
    }

    // 更新显示器波长
    updateMonitorWavelength(defaultWavelength);
}

/**
 * 强制清除显示器内容
 */
function forceClearMonitorDisplay() {
    if (!monitorCanvas) {
        return;
    }

    try {
        // 停止3D渲染循环
        if (monitorDemo && monitorDemo.animationId) {
            cancelAnimationFrame(monitorDemo.animationId);
            monitorDemo.animationId = null;
        }

        // 强制设置演示状态为停止
        if (monitorDemo) {
            monitorDemo.isDemoPlaying = false;
            monitorDemo.demoStep = 0;
        }

        // 清除canvas内容
        const ctx = monitorCanvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, monitorCanvas.width, monitorCanvas.height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, monitorCanvas.width, monitorCanvas.height);
        }

        // 显示待机画面
        showMonitorStandby();

        console.log('显示器内容已强制清除并重置');

    } catch (error) {
        console.error('强制清除显示器内容时出错:', error);
    }
}

/**
 * 重置相机视角到初始位置
 */
function resetCameraView() {
    if (!labCamera || !labControls) {
        console.warn('无法重置相机视角：缺少必要对象');
        return;
    }

    try {
        // 重置到初始位置和视角
        const initialPosition = {
            x: labConfig.cameraPosition.x,
            y: labConfig.cameraPosition.y,
            z: labConfig.cameraPosition.z
        };

        const initialTarget = {
            x: labConfig.cameraTarget.x,
            y: labConfig.cameraTarget.y,
            z: labConfig.cameraTarget.z
        };

        // 平滑重置相机
        animateCamera(
            new THREE.Vector3(initialPosition.x, initialPosition.y, initialPosition.z),
            new THREE.Vector3(initialTarget.x, initialTarget.y, initialTarget.z)
        );

    } catch (error) {
        console.error('重置相机视角时出错:', error);
    }
}
function endExperiment() {
    console.log('结束实验...');

    try {
        // 退出全屏模式
        exitFullscreen();

        // 重置相机视角
        resetCameraView();

        isExperimentRunning = false;

        // 重置演示
        if (monitorDemo && typeof monitorDemo.resetDemo === 'function') {
            monitorDemo.resetDemo();
        } else {
            showMonitorStandby();
        }

        updateControlButtons();

    } catch (error) {
        console.error('结束实验时出错:', error);
    }
}

/**
 * 显示干涉图样
 */
function showInterferencePattern() {
    if (!monitorCanvas) {
        return;
    }

    try {
        const ctx = monitorCanvas.getContext('2d');
        if (!ctx) {
            console.warn('无法获取Canvas 2D上下文，无法显示干涉图样');
            return;
        }

        // 清空画布
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, monitorCanvas.width, monitorCanvas.height);

        // 绘制牛顿环干涉图样
        const centerX = monitorCanvas.width / 2;
        const centerY = monitorCanvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.8;

        // 绘制同心圆环
        for (let i = 1; i <= 10; i++) {
            const radius = (i / 10) * maxRadius;
            const intensity = 1 - (i / 15);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 添加说明文字
        ctx.fillStyle = '#00ff00';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('牛顿环干涉图样', centerX, 50);

        // 更新纹理
        if (monitorTexture) {
            monitorTexture.needsUpdate = true;
        }

    } catch (error) {
        console.error('显示干涉图样时出错:', error);
    }
}

/**
 * 显示光学演示
 */
function showLightDemo() {
    if (!monitorCanvas) {
        return;
    }

    try {
        const ctx = monitorCanvas.getContext('2d');
        if (!ctx) {
            console.warn('无法获取Canvas 2D上下文，无法显示光学演示');
            return;
        }

        // 清空画布
        ctx.fillStyle = '#000020';
        ctx.fillRect(0, 0, monitorCanvas.width, monitorCanvas.height);

        const centerX = monitorCanvas.width / 2;
        const centerY = monitorCanvas.height / 2;

        // 绘制透镜
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 3;

        // 上方透镜
        ctx.beginPath();
        ctx.arc(centerX, centerY - 100, 80, 0, Math.PI, false);
        ctx.stroke();

        // 下方透镜
        ctx.beginPath();
        ctx.arc(centerX, centerY + 100, 80, Math.PI, 2 * Math.PI, false);
        ctx.stroke();

        // 光线
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const x = centerX - 150 + i * 75;
            ctx.beginPath();
            ctx.moveTo(x, centerY - 200);
            ctx.lineTo(x + 20, centerY + 200);
            ctx.stroke();
        }

        // 说明文字
        ctx.fillStyle = '#00ff00';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('光学演示', centerX, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Arial';
        ctx.fillText('光源调节演示', centerX, monitorCanvas.height - 50);

        // 更新纹理
        if (monitorTexture) {
            monitorTexture.needsUpdate = true;
        }

    } catch (error) {
        console.error('显示光学演示时出错:', error);
    }
}

/**
 * 全屏相关函数
 */
function enterFullscreen() {
    try {
        const container = document.querySelector('.virtual-lab-container');
        if (!container) {
            console.warn('未找到虚拟实验室容器，无法进入全屏');
            return;
        }

        const requestFullscreen = container.requestFullscreen ||
            container.mozRequestFullScreen ||
            container.webkitRequestFullscreen ||
            container.msRequestFullscreen;

        if (requestFullscreen) {
            requestFullscreen.call(container).catch(error => {
                console.warn('全屏请求被拒绝:', error);
            });
        } else {
            console.warn('浏览器不支持全屏API');
        }

        isFullscreen = true;
        container.classList.add('fullscreen-mode');

    } catch (error) {
        console.error('进入全屏时出错:', error);
    }
}

function exitFullscreen() {
    try {
        const exitFullscreen = document.exitFullscreen ||
            document.mozCancelFullScreen ||
            document.webkitExitFullscreen ||
            document.msExitFullscreen;

        if (exitFullscreen) {
            exitFullscreen.call(document).catch(error => {
                console.warn('退出全屏失败:', error);
            });
        }

        isFullscreen = false;
        const container = document.querySelector('.virtual-lab-container');
        if (container) {
            container.classList.remove('fullscreen-mode');
        }

    } catch (error) {
        console.error('退出全屏时出错:', error);
    }
}

/**
 * 相机控制函数
 */
function focusOnApparatus() {
    if (!newtonApparatus || !labCamera || !labControls) {
        console.warn('无法聚焦到牛顿环仪：缺少必要对象');
        return;
    }
    try {
        // 基于包围盒自动取景，确保完整可见
        const box = new THREE.Box3().setFromObject(newtonApparatus);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = size.length() / 2; // 近似包围球半径

        // 按相机视场角计算需要的距离，留出边距
        const fov = THREE.MathUtils.degToRad(labCamera.fov);
        const distance = (radius / Math.sin(fov / 2)) * 1.08; // 更小安全边距，让画面更近

        // 从右前上方俯视方向看向中心
        const viewDir = new THREE.Vector3(1, 0.8, 1).normalize();
        const targetPosition = center.clone().add(viewDir.multiplyScalar(distance));

        // 观察点略高于中心，避免被桌面遮挡
        const lookAtTarget = center.clone().add(new THREE.Vector3(0, size.y * 0.1, 0));

        // 平滑移动相机
        animateCamera(targetPosition, lookAtTarget);
    } catch (error) {
        console.error('聚焦到牛顿环仪时出错:', error);
    }
}

/**
 * 聚焦到显示器 - 视角切换到正对显示器
 */
function focusOnMonitor() {
    if (!monitorDisplay || !labCamera || !labControls) {
        console.warn('无法聚焦到显示器：缺少必要对象');
        return;
    }

    try {
        // 获取显示器位置
        const monitorPos = monitorDisplay.position;

        // 计算正对显示器的相机位置
        // 显示器在 z: -4.0，相机需要在其前方一定距离，正对观看
        const cameraDistance = 3.5; // 距离显示器的距离
        const targetCameraPosition = new THREE.Vector3(
            monitorPos.x,     // x轴与显示器对齐
            monitorPos.y,     // y轴与显示器对齐 
            monitorPos.z + cameraDistance  // z轴在显示器前方
        );

        // 观察目标就是显示器中心
        const targetLookAt = new THREE.Vector3(
            monitorPos.x,
            monitorPos.y,
            monitorPos.z
        );

        console.log('切换视角到正对显示器位置:', targetCameraPosition);
        console.log('观察目标:', targetLookAt);

        // 平滑移动相机到正对显示器的位置
        animateCamera(targetCameraPosition, targetLookAt);

    } catch (error) {
        console.error('聚焦到显示器时出错:', error);
    }
}

function resetCameraView() {
    if (!labCamera || !labControls) {
        return;
    }

    try {
        const defaultPosition = new THREE.Vector3(
            labConfig.cameraPosition.x,
            labConfig.cameraPosition.y,
            labConfig.cameraPosition.z
        );
        const defaultTarget = new THREE.Vector3(
            labConfig.cameraTarget.x,
            labConfig.cameraTarget.y,
            labConfig.cameraTarget.z
        );

        animateCamera(defaultPosition, defaultTarget);
    } catch (error) {
        console.error('重置相机视角时出错:', error);
    }
}

function animateCamera(targetPosition, targetLookAt) {
    if (!labCamera || !labControls) {
        return;
    }

    try {
        const startPosition = labCamera.position.clone();
        const startLookAt = labControls.target.clone();

        let progress = 0;
        const duration = 2000;
        const startTime = Date.now();

        function updateCamera() {
            try {
                const elapsed = Date.now() - startTime;
                progress = Math.min(elapsed / duration, 1);

                const easedProgress = 1 - Math.pow(1 - progress, 3);

                labCamera.position.lerpVectors(startPosition, targetPosition, easedProgress);
                labControls.target.lerpVectors(startLookAt, targetLookAt, easedProgress);

                labControls.update();

                if (progress < 1) {
                    requestAnimationFrame(updateCamera);
                }
            } catch (error) {
                console.error('相机动画更新时出错:', error);
            }
        }

        updateCamera();
    } catch (error) {
        console.error('相机动画初始化时出错:', error);
    }
}

/**
 * 更新控制按钮状态
 */
function updateControlButtons() {
    try {
        const buttons = {
            start: document.getElementById('start-experiment'),
            adjust: document.getElementById('adjust-apparatus'),
            light: document.getElementById('adjust-light'),
            reset: document.getElementById('reset-experiment'),
            end: document.getElementById('end-experiment')
        };

        if (isExperimentRunning) {
            if (buttons.start) {
                buttons.start.disabled = true;
                buttons.start.style.opacity = '0.6';
            }
            if (buttons.adjust) {
                buttons.adjust.disabled = false;
                buttons.adjust.style.opacity = '1';
            }
            if (buttons.light) {
                buttons.light.disabled = false;
                buttons.light.style.opacity = '1';
            }
            if (buttons.reset) {
                buttons.reset.disabled = false;
                buttons.reset.style.opacity = '1';
            }
            if (buttons.end) {
                buttons.end.disabled = false;
                buttons.end.style.opacity = '1';
            }
        } else {
            if (buttons.start) {
                buttons.start.disabled = false;
                buttons.start.style.opacity = '1';
            }
            if (buttons.adjust) {
                buttons.adjust.disabled = true;
                buttons.adjust.style.opacity = '0.6';
            }
            if (buttons.light) {
                buttons.light.disabled = true;
                buttons.light.style.opacity = '0.6';
            }
            if (buttons.reset) {
                buttons.reset.disabled = false;
                buttons.reset.style.opacity = '1';
            }
            if (buttons.end) {
                buttons.end.disabled = true;
                buttons.end.style.opacity = '0.6';
            }
        }
    } catch (error) {
        console.error('更新按钮状态时出错:', error);
    }
}

/**
 * 窗口大小变化处理
 */
function onWindowResize() {
    try {
        const container = document.getElementById('lab-scene-container');
        if (!container || !labCamera || !labRenderer) {
            return;
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        labCamera.aspect = width / height;
        labCamera.updateProjectionMatrix();

        labRenderer.setSize(width, height);

        if (monitorDemo && typeof monitorDemo.setSize === 'function') {
            monitorDemo.setSize(monitorCanvas.width, monitorCanvas.height);
        }
    } catch (error) {
        console.error('窗口大小变化处理时出错:', error);
    }
}

/**
 * 渲染循环
 */
function animate() {
    requestAnimationFrame(animate);

    try {
        if (labControls && typeof labControls.update === 'function') {
            labControls.update();
        }

        if (labRenderer && labScene && labCamera) {
            labRenderer.render(labScene, labCamera);
        }
    } catch (error) {
        console.error('渲染循环出错:', error);
    }
}

/**
 * UI辅助函数
 */
function hideLoadingOverlay() {
    try {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    } catch (error) {
        console.error('隐藏加载提示时出错:', error);
    }
}

function showErrorMessage(message) {
    try {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="color: #ff4444; font-size: 24px; margin-bottom: 20px;">⚠️</div>
                    <div style="color: #333; font-size: 18px;">${message}</div>
                    <div style="margin-top: 20px;">
                        <button onclick="location.reload()" style="padding: 10px 20px; font-size: 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">刷新页面</button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('显示错误信息时出错:', error);
    }
}

// 监听全屏状态变化
document.addEventListener('fullscreenchange', function () {
    try {
        if (!document.fullscreenElement) {
            isFullscreen = false;
            const container = document.querySelector('.virtual-lab-container');
            if (container) {
                container.classList.remove('fullscreen-mode');
            }
        }
    } catch (error) {
        console.error('全屏状态变化处理时出错:', error);
    }
});

/**
 * 显示光源调节面板
 */
function showLightAdjustmentPanel() {
    const panel = document.getElementById('light-adjustment-panel');
    if (panel) {
        panel.style.display = 'block';

        const apparatusPanel = document.getElementById('apparatus-adjustment-panel');
        if (apparatusPanel) apparatusPanel.style.display = 'none';

        // 绑定事件监听器（如果还没有绑定）
        if (!panel.hasAttribute('data-events-bound')) {
            bindLightPanelEvents();
            panel.setAttribute('data-events-bound', 'true');
        }
    }
}

/**
 * 隐藏光源调节面板
 */
function hideLightAdjustmentPanel() {
    const panel = document.getElementById('light-adjustment-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * 绑定光源调节面板事件
 */
function bindLightPanelEvents() {
    const closeBtn = document.getElementById('close-light-panel');
    const wavelengthSlider = document.getElementById('wavelength-slider');
    const wavelengthValue = document.getElementById('wavelength-value');
    const presetBtns = document.querySelectorAll('.preset-btn');

    // 关闭按钮
    if (closeBtn) {
        closeBtn.addEventListener('click', hideLightAdjustmentPanel);
    }

    // 波长滑块
    if (wavelengthSlider && wavelengthValue) {
        wavelengthSlider.addEventListener('input', (e) => {
            const wavelength = parseInt(e.target.value);
            wavelengthValue.textContent = wavelength + ' nm';
            updateMonitorWavelength(wavelength);
        });
    }

    // 预设波长按钮
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const wavelength = parseInt(btn.dataset.wavelength);
            if (wavelengthSlider) {
                wavelengthSlider.value = wavelength;
            }
            if (wavelengthValue) {
                wavelengthValue.textContent = wavelength + ' nm';
            }
            updateMonitorWavelength(wavelength);
        });
    });
}

/**
 * 更新显示器波长
 */
function updateMonitorWavelength(wavelength) {
    console.log('更新显示器波长到:', wavelength, 'nm');

    if (monitorDemo && monitorDemo.config) {
        monitorDemo.config.wavelength = wavelength;

        // 如果有updateWavelength方法，调用它
        if (typeof monitorDemo.updateWavelength === 'function') {
            monitorDemo.updateWavelength();
        }
    }
}

// DOM加载完成后执行初始化
document.addEventListener('DOMContentLoaded', function () {
    try {
        console.log('DOM加载完成，准备初始化按钮状态...');
        updateControlButtons();
    } catch (error) {
        console.error('DOM初始化时出错:', error);
    }
});