/**
 * 3D牛顿环实验演示模块
 * 使用Three.js实现交互式3D演示，高真实度物理模拟
 */

// 全局变量
let scene, camera, renderer, controls;
let convexLens, planoConvexLens, rings, lightSource, lightRay, lightBeams;
let demoAnimationId;
let isDemoPlaying = false;
let demoStep = 0;
let isPressing = false;
let lensDistance = 0.4; // 增加两个透镜之间的初始距离

let isTopView = false;

// 光线路径相关
let rayGroup;
let interferencePoints = [];

// 配置参数
const config = {
    // 平凸透镜参数（上方，平面朝下）
    planoConvexRadius: 2.5,     // 平凸透镜半径
    planoConvexCurvature: 6,    // 平凸透镜曲率
    planoConvexHeight: 0.5,     // 平凸透镜高度
    planoConvexColor: 0xadd8e6, // 平凸透镜颜色 - 淡蓝色
    planoConvexOpacity: 0.7,    // 平凸透镜透明度 - 增加不透明度
    
    // 双凸透镜参数（下方，大型双凸透镜）
    convexRadius: 3.5,          // 双凸透镜半径
    convexCurvature: 8,         // 双凸透镜曲率 
    convexHeight: 0.7,          // 双凸透镜高度
    convexColor: 0xadd8e6,      // 双凸透镜颜色 - 淡蓝色
    convexOpacity: 0.7,         // 双凸透镜透明度 - 增加不透明度
    
    lightColor: 0xffffff,       // 光源颜色
    ringsColor: 0xffffff,       // 干涉环颜色
    animationSpeed: 0.01,       // 动画速度
    maxRings: 12,               // 最大环数
    lightPositionY: 6,          // 光源Y位置
    lightPositionX: 0,          // 光源X位置
    lightPositionZ: 0,          // 光源Z位置
    wavelength: 589,            // 波长(nm) - 黄光
    
    pressSpeed: 0.02,           // 按压速度
    maxPressDistance: 0.8,      // 增加最大按压距离
    minLensDistance: 0.001,     // 最小透镜间距
    
    // 动画控制
    demoSteps: 400,             // 演示总步数
    lightMovementX: 2,          // 光源X方向移动距离
    lightMovementZ: 2,          // 光源Z方向移动距离
    minPressDistance: 0.001     // 最小按压距离
};

// 确保在页面加载完成后初始化
window.addEventListener('load', function() {
    console.log('3D演示脚本已加载');
    
    // 如果当前标签页是3D演示，则立即初始化
    if (document.getElementById('3d-demo').classList.contains('active')) {
        console.log('正在初始化3D演示...');
        setTimeout(init3DScene, 500); // 稍微延迟确保DOM完全加载
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // 绑定演示控制按钮
    document.getElementById('start-demo').addEventListener('click', startDemo);
    document.getElementById('pause-demo').addEventListener('click', pauseDemo);
    document.getElementById('reset-demo').addEventListener('click', resetDemo);
    document.getElementById('light-position').addEventListener('click', toggleLightPositionControls);
    document.getElementById('camera-top').addEventListener('click', setCameraTop);
    document.getElementById('camera-side').addEventListener('click', setCameraSide);
    
    // 当切换到3D标签时，初始化3D场景
    const demo3dTab = document.querySelector('.tab-btn[data-tab="3d-demo"]');
    if (demo3dTab) {
        demo3dTab.addEventListener('click', function() {
            if (!scene) {
                init3DScene();
            }
        });
    }
});

/**
 * 初始化3D场景
 */
function init3DScene() {
    console.log('开始初始化3D场景...');
    
    // 尝试获取容器元素
    const container = document.getElementById('3d-scene-container');
    
    if (!container) {
        console.error('找不到3D场景容器元素!');
        
        // 如果没有找到容器，可能是因为元素还没有加载完成
        // 尝试查找demo-container并在其中创建场景容器
        const demoContainer = document.querySelector('.demo-container');
        if (demoContainer) {
            console.log('找到了demo-container，正在创建场景容器...');
            
            // 清除旧内容
            demoContainer.innerHTML = '';
            
            // 创建新的场景容器
            const newContainer = document.createElement('div');
            newContainer.id = '3d-scene-container';
            demoContainer.appendChild(newContainer);
            
            console.log('已创建新的场景容器，继续初始化...');
            
            // 递归调用以使用新创建的容器
            setTimeout(init3DScene, 100);
            return;
        } else {
            console.error('找不到demo-container元素!');
            return;
        }
    }
    
    // 清除可能的旧场景
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    console.log('正在设置场景...');
    
    // 创建场景
    scene = new THREE.Scene();
    
    // 创建一个径向渐变背景
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, '#e0eafc'); // 中心颜色
    gradient.addColorStop(1, '#cfdef3'); // 外部颜色
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const backgroundTexture = new THREE.CanvasTexture(canvas);
    scene.background = backgroundTexture;

    // 使用RGBELoader加载HDRI环境贴图，但仅用于环境光照，不作为背景
    new THREE.RGBELoader()
        .setPath('images/') // 假设HDRI在images文件夹
        .load('venice_sunset_1k.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            // scene.background = texture; // 不再将HDRI用作背景
            scene.environment = texture;
            console.log('HDRI环境贴图加载并应用成功。');
        }, undefined, function (err) {
            console.error('HDRI环境贴图加载失败:', err);
        });
    
    // 添加环境光和定向光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 增强环境光强度
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // 添加点光源，增强透镜材质表现
    const pointLight = new THREE.PointLight(0xffffee, 0.5);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);
    
    // 设置相机
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    
    // 添加轨道控制
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    
    // 创建实验装置
    createExperimentSetup();
    
    // 创建光源位置控制器
    createLightControls();
    
    // 处理窗口调整大小
    window.addEventListener('resize', onWindowResize);
    
    // 开始渲染
    animate();
    
    // 初始化完成后设置初始状态
    setTimeout(() => {
        // 设置初始透镜位置 - 保持一定距离，不显示牛顿环
        lensDistance = config.maxPressDistance;
        planoConvexLens.position.y = lensDistance + config.convexHeight/2 + config.planoConvexHeight;
        
        // 确保透镜清晰可见
        if (planoConvexLens) {
            planoConvexLens.children.forEach(part => {
                if (part.material) {
                    part.material.transparent = true;
                    part.material.opacity = 0.7;
                    part.material.depthWrite = true;
                }
            });
        }
        
        if (convexLens && convexLens.material) {
            convexLens.material.transparent = true;
            convexLens.material.opacity = 0.6;
            convexLens.material.depthWrite = true;
        }
        
        // 清除可能存在的牛顿环
        cleanupRings();
        
        // 设置侧视图以便观察透镜接触过程
        setCameraSide();
        
        // 确保渲染场景
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
        
        console.log('场景初始化完成，点击"开始演示"以观察牛顿环');
    }, 300);
}

/**
 * 创建实验装置
 */
function createExperimentSetup() {
    // 创建双凸透镜（下方的大型双凸透镜）
    const convexGeometry = new THREE.SphereGeometry(
        config.convexCurvature, 64, 64, 0, Math.PI * 2, 0, Math.PI
    );
    const convexMaterial = new THREE.MeshPhysicalMaterial({
        color: config.convexColor,
        transparent: true,
        opacity: config.convexOpacity,
        metalness: 0.0,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        ior: 1.52, // 玻璃的折射率
        transmission: 0.98, // 更高的透射率
        specularIntensity: 1.0,
        specularColor: 0xffffff,
        envMapIntensity: 1.0,
        reflectivity: 0.2
    });
    
    convexLens = new THREE.Mesh(convexGeometry, convexMaterial);
    convexLens.position.y = -config.convexHeight / 2;
    convexLens.scale.set(
        config.convexRadius/config.convexCurvature, 
        config.convexHeight/config.convexCurvature,
        config.convexRadius/config.convexCurvature
    );
    convexLens.castShadow = true;
    convexLens.receiveShadow = true;
    scene.add(convexLens);
    
    // 创建平凸透镜（上方，平面朝下）
    // 首先创建半球体
    const planoConvexTopGeometry = new THREE.SphereGeometry(
        config.planoConvexCurvature, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2
    );
    const planoConvexBottomGeometry = new THREE.CylinderGeometry(
        config.planoConvexRadius, config.planoConvexRadius, 0.05, 64
    );
    
    const planoConvexMaterial = new THREE.MeshPhysicalMaterial({
        color: config.planoConvexColor,
        transparent: true,
        opacity: config.planoConvexOpacity,
        metalness: 0.0,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        ior: 1.52, // 玻璃的折射率
        transmission: 0.98, // 更高的透射率
        specularIntensity: 1.0,
        specularColor: 0xffffff,
        envMapIntensity: 1.0,
        reflectivity: 0.2
    });
    
    // 创建半球体部分（顶部）
    const planoConvexTop = new THREE.Mesh(planoConvexTopGeometry, planoConvexMaterial);
    planoConvexTop.scale.set(
        config.planoConvexRadius/config.planoConvexCurvature, 
        config.planoConvexHeight/config.planoConvexCurvature,
        config.planoConvexRadius/config.planoConvexCurvature
    );
    
    // 创建平面部分（底部）
    const planoConvexBottom = new THREE.Mesh(planoConvexBottomGeometry, planoConvexMaterial);
    planoConvexBottom.position.y = -config.planoConvexHeight/2 - 0.025;
    
    // 创建平凸透镜组
    planoConvexLens = new THREE.Group();
    planoConvexLens.add(planoConvexTop);
    planoConvexLens.add(planoConvexBottom);
    
    // 定位平凸透镜（平面朝下）
    planoConvexLens.position.y = lensDistance + config.convexHeight/2 + config.planoConvexHeight;
    planoConvexLens.rotation.x = Math.PI; // 平面朝下
    planoConvexLens.castShadow = true;
    planoConvexLens.receiveShadow = true;
    scene.add(planoConvexLens);
    
    // 添加光源（用于演示光线照射）
    const lightGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const lightMaterial = new THREE.MeshBasicMaterial({
        color: config.lightColor,
        emissive: config.lightColor
    });
    
    lightSource = new THREE.Mesh(lightGeometry, lightMaterial);
    lightSource.position.set(
        config.lightPositionX, 
        config.lightPositionY, 
        config.lightPositionZ
    );
    scene.add(lightSource);
    
    // 添加光源的光晕效果
    const lightHaloGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const lightHaloMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
    });
    const lightHalo = new THREE.Mesh(lightHaloGeometry, lightHaloMaterial);
    lightSource.add(lightHalo);
    
    // 创建光束组
    lightBeams = new THREE.Group();
    scene.add(lightBeams);
    
    // 创建光线（模拟入射光）
    createLightRays();
    
    // 创建干涉点组
    interferencePoints = [];
    
    // 创建牛顿环（初始隐藏）
    rings = new THREE.Group();
    scene.add(rings);
    
    // 添加透镜尺寸标注
    createLensMeasurements();

    // 添加空间坐标系
    const axesHelper = new THREE.AxesHelper(5); // 增加坐标轴长度
    axesHelper.position.set(0, -config.convexHeight/2 - 0.5, 0);
    // 设置坐标轴颜色，使其更加明显
    axesHelper.setColors(
        new THREE.Color(0xff0000), // X轴 - 红色
        new THREE.Color(0x00ff00), // Y轴 - 绿色
        new THREE.Color(0x0000ff)  // Z轴 - 蓝色
    );
    scene.add(axesHelper);
    
    // 添加辅助网格 - 使用更多的分割和更明显的颜色
    const gridHelper = new THREE.GridHelper(10, 20, 0x666666, 0x999999);
    gridHelper.position.y = -config.convexHeight/2 - 0.5;
    // 增加网格的可见性
    gridHelper.material.opacity = 0.8;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
    
    // 添加坐标标签
    addCoordinateLabels(axesHelper.position);
}

/**
 * 添加坐标轴标签
 */
function addCoordinateLabels(position) {
    // 不添加任何坐标轴标签文字，保持界面简洁
    // XYZ坐标轴依靠颜色区分：红色(X)、绿色(Y)、蓝色(Z)
}

/**
 * 添加透镜尺寸标注
 */
function createLensMeasurements() {
    // 移除所有文本标签，增强视觉沉浸感
    // 不添加任何标注文字
}

/**
 * 创建文本精灵
 */
function makeTextSprite(message, parameters) {
    if (parameters === undefined) parameters = {};
    
    const fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
    const fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 18;
    const borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 4;
    const borderColor = parameters.hasOwnProperty("borderColor") ? parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
    const backgroundColor = parameters.hasOwnProperty("backgroundColor") ? parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };
    const textColor = parameters.hasOwnProperty("textColor") ? parameters["textColor"] : { r:0, g:0, b:0, a:1.0 };
    const position = parameters.hasOwnProperty("position") ? parameters["position"] : { x:0, y:0, z:0 };
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold " + fontsize + "px " + fontface;
    
    // 获取文本宽度
    const textWidth = context.measureText(message).width;
    
    // 计算canvas尺寸，考虑多行文本
    const lines = message.split('\n');
    const lineHeight = fontsize * 1.4;
    const canvasWidth = Math.max(textWidth, 256);
    const canvasHeight = Math.max(lines.length * lineHeight + borderThickness * 2, 128);
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 绘制背景和边框
    context.font = "Bold " + fontsize + "px " + fontface;
    context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
    context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";
    context.lineWidth = borderThickness;
    
    // 绘制圆角矩形
    roundRect(context, borderThickness/2, borderThickness/2, canvasWidth - borderThickness, canvasHeight - borderThickness, 6);
    
    // 绘制文本
    context.fillStyle = "rgba(" + textColor.r + "," + textColor.g + "," + textColor.b + "," + textColor.a + ")";
    context.textAlign = "center";
    
    // 绘制多行文本
    let yPos = (canvasHeight / 2) - ((lines.length - 1) * lineHeight / 2);
    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], canvasWidth / 2, yPos);
        yPos += lineHeight;
    }
    
    // 创建纹理
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // 创建精灵材质
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // 设置精灵尺寸和位置
    sprite.scale.set(canvasWidth / 50, canvasHeight / 50, 1);
    sprite.position.set(position.x, position.y, position.z);
    
    return sprite;
}

/**
 * 辅助函数：绘制圆角矩形
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * 创建光线控制器
 */
function createLightControls() {
    // 创建控制面板，添加文字说明
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'light-position-controls';
    controlsDiv.style.display = 'none';
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.top = '70px';
    controlsDiv.style.right = '10px';
    controlsDiv.style.background = 'rgba(30, 30, 30, 0.7)';
    controlsDiv.style.padding = '10px';
    controlsDiv.style.borderRadius = '5px';
    controlsDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
    controlsDiv.style.zIndex = '100';
    controlsDiv.style.color = '#ffffff';
    controlsDiv.style.fontFamily = 'Arial, sans-serif';
    controlsDiv.style.fontSize = '14px';
    
    // 波长控制
    const wavelengthControl = document.createElement('div');
    wavelengthControl.innerHTML = `
        <label for="light-wavelength" style="display: block; margin: 10px 0 5px 0;">波长 (nm):</label>
        <input type="range" id="light-wavelength" min="400" max="700" step="1" value="589" style="width: 100%;">
        <span id="light-wavelength-value" style="display: block; text-align: center; margin-top: 2px;">589 nm</span>
    `;
    controlsDiv.appendChild(wavelengthControl);
    
    // 添加到容器
    const container = document.getElementById('3d-scene-container');
    if (container) {
        container.appendChild(controlsDiv);
        
        // 绑定事件
        document.getElementById('light-wavelength').addEventListener('input', updateWavelength);
    }
}

/**
 * 切换光源位置控制器显示
 */
function toggleLightPositionControls() {
    const controls = document.querySelector('.light-position-controls');
    if (controls) {
        controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * 更新波长
 */
function updateWavelength() {
    const wavelength = parseInt(document.getElementById('light-wavelength').value);
    config.wavelength = wavelength;
    
    // 更新显示的数值
    document.getElementById('light-wavelength-value').textContent = wavelength + ' nm';
    
    // 根据波长设置光线颜色
    const lightColor = wavelengthToRGB(wavelength);
    
    // 更新光源颜色
    if (lightSource) {
        lightSource.material.color.set(lightColor);
        
        // 更新光源的发光材质
        if (lightSource.children.length > 0 && lightSource.children[0].material) {
            lightSource.children[0].material.color.set(lightColor);
        }
    }
    
    // 更新光线颜色
    updateLightRayColor(lightColor);
    
    // 检查是否有牛顿环显示
    const hasRings = rings && rings.children.length > 0;
    
    // 只有当前有牛顿环显示时才更新牛顿环
    if (hasRings) {
        // 计算当前环的强度
        let intensity = 1.0;
        
        if (isDemoPlaying) {
            // 如果演示正在进行，需要基于当前演示阶段计算强度
            const totalSteps = config.demoSteps || 400;
            const lightMoveSteps = totalSteps * 0.3;
            const pressSteps = totalSteps * 0.3;
            
            if (demoStep < lightMoveSteps) {
                // 光源移动阶段，不显示环
                intensity = 0;
            } else if (demoStep < lightMoveSteps + pressSteps) {
                // 压下阶段，计算当前强度
                const progress = (demoStep - lightMoveSteps) / pressSteps;
                const lensMove = progress * (config.maxPressDistance - config.minLensDistance);
                const currentDistance = config.maxPressDistance - lensMove;
                
                // 定义接触阈值
                const contactThreshold = config.maxPressDistance * 0.3;
                
                if (currentDistance < contactThreshold) {
                    const normalizedDistance = (currentDistance - config.minLensDistance) / 
                                              (contactThreshold - config.minLensDistance);
                    intensity = 1 - normalizedDistance;
                } else {
                    intensity = 0;
                }
            }
        }
        
        // 如果有足够强度，重新创建牛顿环
        if (intensity > 0) {
            cleanupRings(); // 清除现有环
            updateNewtonRings3D(intensity, isTopView); // 用新波长创建新环
        }
    }
    
    // 立即渲染场景
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * 波长转RGB颜色
 * @param {number} wavelength - 波长(nm)
 * @returns {number} RGB颜色值
 */
function wavelengthToRGB(wavelength) {
    let r, g, b;
    
    if (wavelength >= 380 && wavelength < 440) {
        r = (440 - wavelength) / (440 - 380);
        g = 0;
        b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
        r = 0;
        g = (wavelength - 440) / (490 - 440);
        b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
        r = 0;
        g = 1;
        b = (510 - wavelength) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        r = (wavelength - 510) / (580 - 510);
        g = 1;
        b = 0;
    } else if (wavelength >= 580 && wavelength < 645) {
        r = 1;
        g = (645 - wavelength) / (645 - 580);
        b = 0;
    } else if (wavelength >= 645 && wavelength <= 780) {
        r = 1;
        g = 0;
        b = 0;
    } else {
        r = 1;
        g = 1;
        b = 1;
    }
    
    // 将rgb转换为十六进制颜色
    const hex = (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
    return hex;
}

/**
 * 更新光线颜色
 * @param {number} color - RGB颜色值
 */
function updateLightRayColor(color) {
    if (lightBeams) {
        lightBeams.children.forEach(beam => {
            if (beam.material) {
                beam.material.color.set(color);
            }
        });
    }
}

/**
 * 创建光线
 */
function createLightRays() {
    // 清除旧光线
    if (lightBeams) {
        while (lightBeams.children.length > 0) {
            lightBeams.remove(lightBeams.children[0]);
        }
    }
    
    // 获取光源位置
    const lightPos = new THREE.Vector3(
        config.lightPositionX,
        config.lightPositionY,
        config.lightPositionZ
    );
    
    // 创建主光线
    const rayMaterial = new THREE.MeshBasicMaterial({
        color: wavelengthToRGB(config.wavelength),
        transparent: true,
        opacity: 0.6
    });
    
    // 创建垂直入射的光线
    const rayLength = lightPos.y;
    const rayGeometry = new THREE.CylinderGeometry(0.02, 0.02, rayLength, 8);
    const ray = new THREE.Mesh(rayGeometry, rayMaterial);
    
    // 设置光线位置和朝向
    ray.position.set(lightPos.x, lightPos.y - rayLength/2, lightPos.z);
    
    lightBeams.add(ray);
    
    // 创建多束光线以增强视觉效果
    const rayCount = 8; // 光线数量
    const radius = 0.5; // 光线散布半径
    
    for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // 创建从光源到透镜的光线
        const rayGeometry = new THREE.CylinderGeometry(0.01, 0.01, rayLength, 8);
        const ray = new THREE.Mesh(rayGeometry, rayMaterial.clone());
        ray.material.opacity = 0.3;
        
        // 设置位置
        ray.position.set(
            lightPos.x + x, 
            lightPos.y - rayLength/2, 
            lightPos.z + z
        );
        
        // 设置旋转以指向透镜
        ray.lookAt(new THREE.Vector3(x, 0, z));
        ray.rotateX(Math.PI/2);
        
        lightBeams.add(ray);
    }
}

/**
 * 更新光线
 */
function updateLightRays() {
    // 重新创建光线
    createLightRays();
}

/**
 * 处理窗口大小变化
 */
function onWindowResize() {
    const container = document.getElementById('3d-scene-container');
    if (!container || !camera || !renderer) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // 根据相机类型更新参数
    if (camera instanceof THREE.PerspectiveCamera) {
        // 透视相机
    camera.aspect = width / height;
    } else if (camera instanceof THREE.OrthographicCamera) {
        // 正交相机
        const aspect = width / height;
        const orthoSize = 5;
        camera.left = -orthoSize * aspect;
        camera.right = orthoSize * aspect;
        camera.top = orthoSize;
        camera.bottom = -orthoSize;
    }
    
    // 更新相机投影矩阵
    camera.updateProjectionMatrix();
    
    // 更新渲染器尺寸
    renderer.setSize(width, height);
    
    // 立即重新渲染场景
    renderer.render(scene, camera);
}

/**
 * 动画循环
 */
function animate() {
    demoAnimationId = requestAnimationFrame(animate);
    
    if (controls) {
        controls.update();
    }
    
    if (isDemoPlaying) {
        updateDemoAnimation();
    }
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * 更新演示动画
 */
function updateDemoAnimation() {
    if (!isDemoPlaying) return;
    
    // 动画分三个阶段：
    // 1. 光源移动
    // 2. 压下透镜
    // 3. 维持压下状态（演示结束不抬起透镜）
    
    const totalSteps = config.demoSteps || 400;
    const lightMoveSteps = totalSteps * 0.3; // 30%的时间用于移动光源
    const pressSteps = totalSteps * 0.3;     // 30%的时间用于压下透镜
    const holdSteps = totalSteps * 0.4;      // 40%的时间维持压下状态
    
    // 计算当前阶段
    let lensMove = 0;
    
    // 阶段1：移动光源
    if (demoStep < lightMoveSteps) {
        const progress = demoStep / lightMoveSteps;
        lightSource.position.x = config.lightPositionX + progress * config.lightMovementX;
        lightSource.position.z = config.lightPositionZ + progress * config.lightMovementZ;
        updateLightRays();
        
        // 清除可能存在的牛顿环
        cleanupRings();
    } 
    // 阶段2：压下透镜
    else if (demoStep < lightMoveSteps + pressSteps) {
        const progress = (demoStep - lightMoveSteps) / pressSteps;
        lensMove = progress * (config.maxPressDistance - config.minLensDistance);
        lensDistance = config.maxPressDistance - lensMove;
        planoConvexLens.position.y = lensDistance + config.convexHeight/2 + config.planoConvexHeight;
        
        // 只有当透镜距离小于阈值时才显示牛顿环
        const contactThreshold = config.maxPressDistance * 0.3; // 定义接触阈值
        
        if (lensDistance < contactThreshold) {
            // 计算环强度 - 距离越小，环越明显
            // 映射到0-1的范围，考虑接触阈值
            const normalizedDistance = (lensDistance - config.minLensDistance) / (contactThreshold - config.minLensDistance);
            const ringIntensity = 1 - normalizedDistance;
            
            // 只有有强度时才更新牛顿环
            if (ringIntensity > 0) {
                updateNewtonRings3D(ringIntensity, isTopView);
            } else {
                // 清除可能存在的牛顿环
                cleanupRings();
            }
        } else {
            // 透镜未接触，清除可能存在的牛顿环
            cleanupRings();
        }
        
        updateLightRays();
    } 
    // 阶段3：维持压下状态
    else if (demoStep < totalSteps) {
        // 保持透镜在压下状态
        lensDistance = config.minLensDistance;
        
        // 展示完全形成的牛顿环
        updateNewtonRings3D(1.0, isTopView);
    } else {
        // 演示结束后暂停，但保持透镜压下状态
        pauseDemo();
        
        // 确保牛顿环在俯视图模式下仍然可见
        enhanceRingsVisibility();
        return;
    }
    
    // 增加步骤
    demoStep += 1;
}

/**
 * 增强牛顿环可见性，确保在不同视角下都能看到
 */
function enhanceRingsVisibility() {
    // 设置透镜为正常可见状态
    if (planoConvexLens) {
        planoConvexLens.children.forEach(part => {
            if (part.material) {
                part.material.transparent = true;
                part.material.opacity = 0.5; // 半透明，可以看到透镜
                part.material.depthWrite = true; // 启用深度写入
                part.material.side = THREE.DoubleSide; // 确保能从两面看到
            }
        });
    }
    
    // 设置下透镜为半透明
    if (convexLens && convexLens.material) {
        convexLens.material.transparent = true;
        convexLens.material.opacity = 0.4; // 半透明
        convexLens.material.depthWrite = true; // 启用深度写入
    }
    
    // 处理环的可见性
    if (rings.children.length === 0) {
        // 如果没有环，创建环
        updateNewtonRings3D(1.0, isTopView);
    } else {
        // 调整现有环的参数
        rings.children.forEach(ring => {
            if (ring.material) {
                if (ring.material.map) {
                    // 如果是带纹理的环
                    ring.material.transparent = true;
                    ring.material.needsUpdate = true;
                } else {
                    // 其他材质
                    ring.material.transparent = true;
                    ring.material.opacity = 0.9;
                }
                
                // 设置适当的渲染优先级
                ring.renderOrder = 1000;
            }
        });
    }
    
    // 清理多余的光束，只保留一条主光束
    while (lightBeams.children.length > 1) {
        const beam = lightBeams.children[0];
        lightBeams.remove(beam);
    }
    
    // 如果没有光束，添加一条主光束
    if (lightBeams.children.length === 0) {
        const rayGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
        rayGeometry.rotateX(Math.PI / 2);
        
        const rayMaterial = new THREE.MeshBasicMaterial({
            color: wavelengthToRGB(config.wavelength),
            transparent: true,
            opacity: 0.7
        });
        
        const ray = new THREE.Mesh(rayGeometry, rayMaterial);
        
        // 从光源到牛顿环中心
        const contactPoint = new THREE.Vector3(0, lensDistance + config.convexHeight/2 + 0.01, 0);
        const lightPos = new THREE.Vector3(
            lightSource.position.x,
            lightSource.position.y,
            lightSource.position.z
        );
        
        const direction = new THREE.Vector3().subVectors(contactPoint, lightPos).normalize();
        const distance = contactPoint.distanceTo(lightPos);
        
        ray.position.copy(lightPos.clone().add(direction.clone().multiplyScalar(distance / 2)));
        ray.scale.y = distance;
        ray.lookAt(contactPoint);
        
        lightBeams.add(ray);
    }
    
    // 立即渲染场景
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * 更新3D牛顿环显示
 * @param {number} intensity - 干涉环强度 (0-1)
 * @param {boolean} forceTop - 是否强制在顶部渲染
 */
function updateNewtonRings3D(intensity, forceTop = false) {
    // 清除旧的环
    cleanupRings();
    
    if (intensity <= 0.01) { // 强度太低则不显示
        return;
    }
    
    // 确保透镜可见
    if (planoConvexLens) {
        planoConvexLens.children.forEach(part => {
            if (part.material) {
                part.material.transparent = true;
                part.material.opacity = 0.7;
                part.material.depthWrite = true;
            }
        });
    }
    
    if (convexLens && convexLens.material) {
        convexLens.material.transparent = true;
        convexLens.material.opacity = 0.6;
        convexLens.material.depthWrite = true;
    }
    
    // 牛顿环基础参数 - 顶视图时使用相同的半径系数
    const baseRadius = 2.0;
    const ringRadius = baseRadius; // 移除对isTopView的条件缩放，保持圆形
    
    // 创建干涉纹理 - 确保纹理始终是正圆形
    const texture = createInterferenceTexture(2048, 1.0, config.wavelength, intensity);
    
    // 创建环的几何体和材质 - 使用更高的分段数确保圆形边缘平滑
    const geometry = new THREE.CircleGeometry(ringRadius, 256); // 增加分段数以获得更平滑的圆形
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: !forceTop,
        renderOrder: forceTop ? 1000 : 0
    });
    
    // 创建牛顿环网格
    const ring = new THREE.Mesh(geometry, material);
    
    // 定位环 - 在透镜接触处上方一点
    const yPosition = lensDistance + config.convexHeight/2;
    ring.position.set(0, yPosition + 0.015, 0);
    ring.rotation.x = -Math.PI / 2; // 水平放置，确保完全平行于XZ平面
    
    // 确保没有任何旋转或缩放变形
    ring.rotation.y = 0;
    ring.rotation.z = 0;
    ring.scale.set(1, 1, 1);
    
    // 添加到环组
    rings.add(ring);
    
    // 添加从光源到环中心的光线
    const rayGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
    rayGeometry.rotateX(Math.PI / 2);
    
    const rayMaterial = new THREE.MeshBasicMaterial({
        color: wavelengthToRGB(config.wavelength),
        transparent: true,
        opacity: 0.7
    });
    
    const ray = new THREE.Mesh(rayGeometry, rayMaterial);
    
    // 设置光线位置和方向
    const source = new THREE.Vector3(
        lightSource.position.x,
        lightSource.position.y,
        lightSource.position.z
    );
    const target = new THREE.Vector3(0, yPosition, 0);
    const direction = new THREE.Vector3().subVectors(target, source).normalize();
    const distance = target.distanceTo(source);
    
    ray.position.copy(source.clone().add(direction.clone().multiplyScalar(distance / 2)));
    ray.scale.y = distance;
    ray.lookAt(target);
    
    lightBeams.add(ray);
    
    // 添加中心光点
    const centerPointGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const centerPointMaterial = new THREE.MeshBasicMaterial({
        color: wavelengthToRGB(config.wavelength),
        transparent: true,
        opacity: 0.9
    });
    const centerPoint = new THREE.Mesh(centerPointGeometry, centerPointMaterial);
    centerPoint.position.copy(target);
    centerPoint.position.y += 0.02;
    centerPoint.renderOrder = 1001;
    lightBeams.add(centerPoint);
    
    // 立即渲染场景
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * 清除牛顿环
 */
function cleanupRings() {
    if (rings) {
        while (rings.children.length > 0) {
            const object = rings.children[0];
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
            rings.remove(object);
        }
    }
}

/**
 * 创建基于物理模型的干涉纹理
 * @param {number} size - 纹理尺寸
 * @param {number} radius - 环在纹理中占的半径比例
 * @param {number} wavelength - 波长(nm)
 * @param {number} intensity - 干涉强度(0-1)
 * @returns {THREE.Texture} 干涉纹理
 */
function createInterferenceTexture(size, radius, wavelength, intensity) {
    // 创建画布 - 确保尺寸是2的幂，以优化渲染性能
    const canvasSize = Math.pow(2, Math.ceil(Math.log2(size)));
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    // 计算中心点和最大像素半径 - 确保是完美的圆形
    const center = canvasSize / 2;
    const maxPixelRadius = center * radius * 0.98; // 留出一些边缘
    
    // 获取波长对应的RGB颜色
    const lightRGB = wavelengthToRGB(wavelength);
    const r = (lightRGB >> 16) & 0xff;
    const g = (lightRGB >> 8) & 0xff;
    const b = lightRGB & 0xff;
    
    // 清除之前的内容并填充透明背景
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // 物理模型: r_m^2 = m * lambda * R.  我们关心的是环的相对间距。
    // 这意味着环半径 r_m 与 sqrt(m) 成正比。
    
    // 波长越长，环越稀疏。我们用一个缩放因子来模拟这个效果。
    // 以589nm(黄光)为基准，假设此时在最大半径处可以看到20级条纹。
    const wavelengthFactor = wavelength / 589.0; 
    const maxOrder = 25 / wavelengthFactor; // 波长越长，maxOrder越小，环越稀疏

    // 使用像素级精确绘制，确保牛顿环是完美的圆形
    // 创建ImageData对象直接操作像素数据
    const imageData = ctx.createImageData(canvasSize, canvasSize);
    const data = imageData.data;
    
    // 遍历每个像素，计算其到中心的距离，然后确定其颜色
    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            // 计算到中心的距离（以像素为单位）
            const dx = x - center;
            const dy = y - center;
            const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
            
            // 如果在最大半径范围内
            if (distanceToCenter <= maxPixelRadius) {
                // 计算对应的环级数（不一定是整数）
                const normalizedRadius = distanceToCenter / maxPixelRadius;
                const ringOrder = normalizedRadius * normalizedRadius * maxOrder;
                
                // 计算干涉条纹的强度（明暗交替）
                // 使用余弦函数可以得到平滑的过渡
                const interferencePhase = Math.PI * ringOrder;
                const brightness = 0.5 + 0.5 * Math.cos(interferencePhase);
                
                // 计算像素索引
                const pixelIndex = (y * canvasSize + x) * 4;
        
                // 设置像素颜色 - 使用波长对应的颜色和干涉强度
                const finalIntensity = brightness * intensity;
                data[pixelIndex] = Math.round(r * finalIntensity);     // R
                data[pixelIndex + 1] = Math.round(g * finalIntensity); // G
                data[pixelIndex + 2] = Math.round(b * finalIntensity); // B
                data[pixelIndex + 3] = Math.round(255 * (finalIntensity > 0.05 ? 0.8 : 0)); // A (透明度)
            } else {
                // 在最大半径范围外的像素设为完全透明
                const pixelIndex = (y * canvasSize + x) * 4;
                data[pixelIndex + 3] = 0; // 完全透明
            }
        }
    }
    
    // 将像素数据绘制到画布上
    ctx.putImageData(imageData, 0, 0);
    
    // 确保中心是暗斑（反射干涉中心是暗斑）
    const firstRingRadius = Math.sqrt(1 / maxOrder) * maxPixelRadius;
    ctx.beginPath();
    ctx.arc(center, center, firstRingRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * intensity})`;
    ctx.fill();
    
    // 创建并返回纹理
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    return texture;
}

/**
 * 更新光线与牛顿环的交互
 */
function updateLightInteraction(contactPoint, radius, intensity, wavelength) {
    // 清除旧的光线
    while (lightBeams.children.length > 0) {
        const beam = lightBeams.children[0];
        if (beam.geometry) beam.geometry.dispose();
        if (beam.material) beam.material.dispose();
        lightBeams.remove(beam);
    }
    
    // 获取波长对应的颜色
    const lightRGB = wavelengthToRGB(wavelength);
    
    // 创建入射光束 - 从光源指向接触点
    const lightRayGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
    lightRayGeometry.rotateX(Math.PI / 2);
    
    const lightRayMaterial = new THREE.MeshBasicMaterial({ 
        color: lightRGB,
        transparent: true,
        opacity: 0.8
    });
    
    const lightRay = new THREE.Mesh(lightRayGeometry, lightRayMaterial);
    
    // 计算起点和方向
    const startPoint = new THREE.Vector3(
        lightSource.position.x,
        lightSource.position.y,
        lightSource.position.z
    );
    
    const direction = new THREE.Vector3().subVectors(contactPoint, startPoint).normalize();
    const distance = contactPoint.distanceTo(startPoint);
    
    // 定位光线
    lightRay.position.copy(startPoint.clone().add(direction.clone().multiplyScalar(distance / 2)));
    lightRay.scale.y = distance;
    
    // 使光线朝向接触点
    lightRay.lookAt(contactPoint);
    
    // 添加到光束组
    lightBeams.add(lightRay);
    
    // 添加中心光点，替代复杂的闪烁效果
    if (intensity > 0.3) {
        const centerPointGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const centerPointMaterial = new THREE.MeshBasicMaterial({
            color: lightRGB,
            transparent: true,
            opacity: 0.9 * intensity
        });
        const centerPoint = new THREE.Mesh(centerPointGeometry, centerPointMaterial);
        centerPoint.position.copy(contactPoint);
        centerPoint.position.y += 0.02; // 稍微抬高，确保可见
        centerPoint.renderOrder = 1002; // 高渲染优先级
        lightBeams.add(centerPoint);
    }
}

/**
 * 设置顶视图相机位置
 */
function setCameraTop() {
    isTopView = true;
    if (!camera || !controls) return;

    // 1. 基于当前透镜距离，计算并生成干涉环
    const intensity = calculateRingIntensity();
    updateNewtonRings3D(intensity, true);

    // 2. 设置相机 - 使用完全垂直的位置，并将z设为0而不是0.01以避免任何倾斜
    const distance = Math.max(camera.position.distanceTo(new THREE.Vector3(0, 0, 0)), 8);
    
    // 2.1 保存当前相机类型
    const isPerspective = camera instanceof THREE.PerspectiveCamera;
    const container = document.getElementById('3d-scene-container');
    
    // 2.2 如果当前是透视相机，切换为正交相机以消除透视变形
    if (isPerspective) {
        // 保存原相机引用
        window.originalCamera = camera;
        
        // 创建正交相机
        const aspect = container.clientWidth / container.clientHeight;
        const orthoSize = 5;
        camera = new THREE.OrthographicCamera(
            -orthoSize * aspect, orthoSize * aspect, 
            orthoSize, -orthoSize, 0.1, 100
        );
        
        // 更新控制器
        controls.object = camera;
    }
    
    // 2.3 设置相机位置，完全垂直于牛顿环平面
    camera.position.set(0, distance, 0);
        camera.lookAt(0, 0, 0);
        
    // 3. 隐藏无关元素
    if (planoConvexLens) planoConvexLens.visible = false;
    if (lightSource) lightSource.visible = false;
    if (lightBeams) lightBeams.visible = false;

    // 4. 调整下方透镜材质，使其更透明
        if (convexLens && convexLens.material) {
        convexLens.material.opacity = 0.2;
            convexLens.material.depthWrite = false;
        }
        
        controls.update();
}

/**
 * 设置侧视图相机位置
 */
function setCameraSide() {
    isTopView = false;
    if (!camera || !controls) return;
    
    // 如果之前切换为了正交相机，恢复原透视相机
    if (window.originalCamera) {
        camera = window.originalCamera;
        controls.object = camera;
        window.originalCamera = null;
    }

    // 1. 恢复所有元素的可见性
    if (planoConvexLens) planoConvexLens.visible = true;
    if (lightSource) lightSource.visible = true;
    if (lightBeams) lightBeams.visible = true;

    // 2. 设置相机位置
    const distance = Math.max(camera.position.distanceTo(new THREE.Vector3(0, 0, 0)), 8);
    camera.position.set(distance * 0.8, distance / 2, distance);
        camera.lookAt(0, 0, 0);
        
    // 3. 恢复透镜材质
        if (planoConvexLens) {
            planoConvexLens.children.forEach(part => {
                if (part.material) {
                part.material.opacity = config.planoConvexOpacity;
                part.material.depthWrite = true;
                }
            });
        }
        if (convexLens && convexLens.material) {
        convexLens.material.opacity = config.convexOpacity;
        convexLens.material.depthWrite = true;
        }
        
    // 4. 恢复干涉环的正常渲染
    const intensity = calculateRingIntensity();
    updateNewtonRings3D(intensity, false);

        controls.update();
}

/**
 * 开始演示
 */
function startDemo() {
    console.log('开始牛顿环演示...');
    isDemoPlaying = true;
    
    // 如果是从头开始，则重置动画步骤
    if (demoStep >= config.demoSteps) {
        demoStep = 0;
        // 重置光源位置
        lightSource.position.set(config.lightPositionX, config.lightPositionY, config.lightPositionZ);
    }
    
    // 更新按钮显示状态
    document.getElementById('start-demo').style.display = 'none';
    document.getElementById('pause-demo').style.display = 'inline-block';
}

/**
 * 暂停演示
 */
function pauseDemo() {
    console.log('暂停牛顿环演示...');
    isDemoPlaying = false;
    
    // 更新按钮显示状态
    document.getElementById('start-demo').style.display = 'inline-block';
    document.getElementById('pause-demo').style.display = 'none';
}

/**
 * 重置演示
 */
function resetDemo() {
    console.log('重置牛顿环演示...');
    // 停止动画
    isDemoPlaying = false;
    demoStep = 0;

    // 恢复所有元素可见性并重置相机
    setCameraSide();
    controls.reset();
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // 重置光源位置
    lightSource.position.set(config.lightPositionX, config.lightPositionY, config.lightPositionZ);
    
    // 重置透镜位置
    lensDistance = config.maxPressDistance;
    planoConvexLens.position.y = lensDistance + config.convexHeight/2 + config.planoConvexHeight;
    
    // 清除牛顿环
    cleanupRings();
    
    // 重置光线
    updateLightRays();
    
    // 更新按钮显示状态
    document.getElementById('start-demo').style.display = 'inline-block';
    document.getElementById('pause-demo').style.display = 'none';
}

/**
 * 根据透镜距离计算干涉环强度
 * @returns {number} intensity (0-1)
 */
function calculateRingIntensity() {
    const contactThreshold = config.maxPressDistance * 0.3; // 定义接触阈值
    if (lensDistance < contactThreshold) {
        const normalizedDistance = (lensDistance - config.minLensDistance) / (contactThreshold - config.minLensDistance);
        return Math.max(0, 1 - normalizedDistance);
    }
    return 0;
}

/**
 * 更新所有与波长相关的材质
 * @param {number} wavelength - 波长(nm)
 */
function updateMaterialsForWavelength(wavelength) {
    // 获取波长对应的RGB颜色
    const lightRGB = wavelengthToRGB(wavelength);
    const r = (lightRGB >> 16) & 0xff;
    const g = (lightRGB >> 8) & 0xff;
    const b = lightRGB & 0xff;
    
    // 更新所有环的材质
    if (rings && rings.children.length > 0) {
        rings.children.forEach(ring => {
            if (ring.material) {
                if (ring.material.map) {
                    // 如果有纹理贴图，会通过recreateTexture重新生成
                } else if (ring.material.color) {
                    // 如果只是纯色材质，直接更新颜色
                    ring.material.color.setRGB(r/255, g/255, b/255);
                    ring.material.needsUpdate = true;
                }
            }
        });
    }
    
    // 更新所有光束的颜色
    if (lightBeams && lightBeams.children.length > 0) {
        lightBeams.children.forEach(beam => {
            if (beam.material && beam.material.color) {
                beam.material.color.setRGB(r/255, g/255, b/255);
                beam.material.needsUpdate = true;
            }
        });
    }
} 