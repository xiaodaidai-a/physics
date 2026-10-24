/**
 * 显示器3D集成模块
 * 将3D牛顿环演示直接集成到仿真世界的显示器上
 */

class Monitor3DIntegration {
    constructor(monitorCanvas, monitorTexture) {
        this.monitorCanvas = monitorCanvas;
        this.monitorTexture = monitorTexture;
        this.monitorContext = monitorCanvas.getContext('2d');
        
        // 3D场景相关
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 3D对象
        this.convexLens = null;
        this.planoConvexLens = null;
        this.rings = null;
        this.lightSource = null;
        this.lightBeams = null;
        
        // 动画控制
        this.animationId = null;
        this.isDemoPlaying = false;
        this.demoStep = 0;
        this.lensDistance = 0.4;
        this.isTopView = false;
        
        // 配置参数
        this.config = {
            planoConvexRadius: 2.5,
            planoConvexCurvature: 6,
            planoConvexHeight: 0.5,
            planoConvexColor: 0xadd8e6,
            planoConvexOpacity: 0.7,
            
            convexRadius: 3.5,
            convexCurvature: 8,
            convexHeight: 0.7,
            convexColor: 0xadd8e6,
            convexOpacity: 0.7,
            
            lightColor: 0xffffff,
            ringsColor: 0xffffff,
            animationSpeed: 0.01,
            maxRings: 16,
            lightPositionY: 6,
            lightPositionX: 0,
            lightPositionZ: 0,
            wavelength: 589,
            
            pressSpeed: 0.02,
            maxPressDistance: 0.8,
            minLensDistance: 0.001,
            
            demoSteps: 400,
            lightMovementX: 2,
            lightMovementZ: 2,
            minPressDistance: 0.001
        };
        
        this.init();
    }
    
    init() {
        console.log('初始化显示器3D集成...');
        this.createOffscreenRenderer();
        this.createExperimentSetup();
        this.startRenderLoop();
    }
    
    /**
     * 创建离屏渲染器
     */
    createOffscreenRenderer() {
        // 创建场景
        this.scene = new THREE.Scene();
        
        // 创建径向渐变背景
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, '#e0eafc');
        gradient.addColorStop(1, '#cfdef3');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        const backgroundTexture = new THREE.CanvasTexture(canvas);
        this.scene.background = backgroundTexture;
        
        // 添加光照
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xffffee, 0.5);
        pointLight.position.set(3, 3, 3);
        this.scene.add(pointLight);
        
        // 设置相机
        const aspect = this.monitorCanvas.width / this.monitorCanvas.height;
        this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
        this.camera.position.set(0, 0.3, 6);
        this.camera.lookAt(0, 1, 0);
        
        // 创建离屏渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true
        });
        this.renderer.setSize(this.monitorCanvas.width, this.monitorCanvas.height);
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        // 创建轨道控制
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 30;
        this.controls.target.set(0, 1, 0);
    }
    
    /**
     * 创建实验装置
     */
    createExperimentSetup() {
        // 创建双凸透镜（下方）
        const convexGeometry = new THREE.SphereGeometry(
            this.config.convexCurvature, 64, 64, 0, Math.PI * 2, 0, Math.PI
        );
        const convexMaterial = new THREE.MeshPhysicalMaterial({
            color: this.config.convexColor,
            transparent: true,
            opacity: this.config.convexOpacity,
            metalness: 0.0,
            roughness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            ior: 1.52,
            transmission: 0.98,
            specularIntensity: 1.0,
            specularColor: 0xffffff,
            envMapIntensity: 1.0,
            reflectivity: 0.2
        });
        
        this.convexLens = new THREE.Mesh(convexGeometry, convexMaterial);
        this.convexLens.position.y = -this.config.convexHeight / 2;
        this.convexLens.scale.set(
            this.config.convexRadius/this.config.convexCurvature, 
            this.config.convexHeight/this.config.convexCurvature,
            this.config.convexRadius/this.config.convexCurvature
        );
        this.convexLens.castShadow = true;
        this.convexLens.receiveShadow = true;
        this.scene.add(this.convexLens);
        
        // 创建平凸透镜（上方）
        const planoConvexTopGeometry = new THREE.SphereGeometry(
            this.config.planoConvexCurvature, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2
        );
        const planoConvexBottomGeometry = new THREE.CylinderGeometry(
            this.config.planoConvexRadius, this.config.planoConvexRadius, 0.05, 64
        );
        
        const planoConvexMaterial = new THREE.MeshPhysicalMaterial({
            color: this.config.planoConvexColor,
            transparent: true,
            opacity: this.config.planoConvexOpacity,
            metalness: 0.0,
            roughness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            ior: 1.52,
            transmission: 0.98,
            specularIntensity: 1.0,
            specularColor: 0xffffff,
            envMapIntensity: 1.0,
            reflectivity: 0.2
        });
        
        const planoConvexTop = new THREE.Mesh(planoConvexTopGeometry, planoConvexMaterial);
        planoConvexTop.scale.set(
            this.config.planoConvexRadius/this.config.planoConvexCurvature, 
            this.config.planoConvexHeight/this.config.planoConvexCurvature,
            this.config.planoConvexRadius/this.config.planoConvexCurvature
        );
        
        const planoConvexBottom = new THREE.Mesh(planoConvexBottomGeometry, planoConvexMaterial);
        planoConvexBottom.position.y = -this.config.planoConvexHeight/2 - 0.025;
        
        this.planoConvexLens = new THREE.Group();
        this.planoConvexLens.add(planoConvexTop);
        this.planoConvexLens.add(planoConvexBottom);
        
        this.planoConvexLens.position.y = this.lensDistance + this.config.convexHeight/2 + this.config.planoConvexHeight;
        this.planoConvexLens.rotation.x = Math.PI;
        this.planoConvexLens.castShadow = true;
        this.planoConvexLens.receiveShadow = true;
        this.scene.add(this.planoConvexLens);
        
        // 添加光源
        const lightGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const lightMaterial = new THREE.MeshBasicMaterial({
            color: this.config.lightColor,
            emissive: this.config.lightColor
        });
        
        this.lightSource = new THREE.Mesh(lightGeometry, lightMaterial);
        this.lightSource.position.set(
            this.config.lightPositionX, 
            this.config.lightPositionY, 
            this.config.lightPositionZ
        );
        this.scene.add(this.lightSource);
        
        // 添加光源光晕
        const lightHaloGeometry = new THREE.SphereGeometry(0.6, 32, 32);
        const lightHaloMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        const lightHalo = new THREE.Mesh(lightHaloGeometry, lightHaloMaterial);
        this.lightSource.add(lightHalo);
        
        // 创建光束组
        this.lightBeams = new THREE.Group();
        this.scene.add(this.lightBeams);
        
        // 创建牛顿环组
        this.rings = new THREE.Group();
        this.scene.add(this.rings);
        
        // 创建光线
        this.createLightRays();
        
        // 添加坐标系
        const axesHelper = new THREE.AxesHelper(5);
        axesHelper.position.set(0, -this.config.convexHeight/2 - 0.5, 0);
        this.scene.add(axesHelper);
        
        // 添加网格
        const gridHelper = new THREE.GridHelper(10, 20, 0x666666, 0x999999);
        gridHelper.position.y = -this.config.convexHeight/2 - 0.5;
        gridHelper.material.opacity = 0.8;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        
        // 设置初始状态
        this.resetToInitialState();
    }
    
    /**
     * 创建光线
     */
    createLightRays() {
        // 清除旧光线
        if (this.lightBeams) {
            while (this.lightBeams.children.length > 0) {
                this.lightBeams.remove(this.lightBeams.children[0]);
            }
        }
        
        const lightPos = new THREE.Vector3(
            this.config.lightPositionX,
            this.config.lightPositionY,
            this.config.lightPositionZ
        );
        
        const rayMaterial = new THREE.MeshBasicMaterial({
            color: this.wavelengthToRGB(this.config.wavelength),
            transparent: true,
            opacity: 0.6
        });
        
        // 创建主光线
        const rayLength = lightPos.y;
        const rayGeometry = new THREE.CylinderGeometry(0.02, 0.02, rayLength, 8);
        const ray = new THREE.Mesh(rayGeometry, rayMaterial);
        
        ray.position.set(lightPos.x, lightPos.y - rayLength/2, lightPos.z);
        this.lightBeams.add(ray);
        
        // 创建多束光线
        const rayCount = 8;
        const radius = 0.5;
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const rayGeometry = new THREE.CylinderGeometry(0.01, 0.01, rayLength, 8);
            const ray = new THREE.Mesh(rayGeometry, rayMaterial.clone());
            ray.material.opacity = 0.3;
            
            ray.position.set(
                lightPos.x + x, 
                lightPos.y - rayLength/2, 
                lightPos.z + z
            );
            
            ray.lookAt(new THREE.Vector3(x, 0, z));
            ray.rotateX(Math.PI/2);
            
            this.lightBeams.add(ray);
        }
    }
    
    /**
     * 波长转RGB颜色
     */
    wavelengthToRGB(wavelength) {
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
        
        const hex = (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
        return hex;
    }
    
    /**
     * 重置到初始状态
     */
    resetToInitialState() {
        this.lensDistance = this.config.maxPressDistance;
        this.planoConvexLens.position.y = this.lensDistance + this.config.convexHeight/2 + this.config.planoConvexHeight;
        
        // 清除牛顿环
        this.cleanupRings();
        
        // 设置相机
        this.isTopView = false;
        this.camera.position.set(0, 0.3, 6);
        this.camera.lookAt(0, 1, 0);
        this.controls.target.set(0, 1, 0);
        this.controls.update();
    }
    
    /**
     * 清除牛顿环
     */
    cleanupRings() {
        if (this.rings) {
            while (this.rings.children.length > 0) {
                const object = this.rings.children[0];
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
                this.rings.remove(object);
            }
        }
    }
    
    /**
     * 开始演示
     */
    startDemo() {
        console.log('开始牛顿环实验演示...');
        this.isDemoPlaying = true;
        this.demoStep = 0;
        
        // 重置光源位置
        this.lightSource.position.set(
            this.config.lightPositionX, 
            this.config.lightPositionY, 
            this.config.lightPositionZ
        );
    }
    
    /**
     * 开始手动实验模式
     */
    startManualMode() {
        console.log('进入手动调节牛顿环仪模式...');
        this.isDemoPlaying = false; // 关闭自动演示
        this.setCameraTop(); // 直接进入显微镜俯视图
    }
    
    /**
     * 暂停演示
     */
    pauseDemo() {
        console.log('暂停牛顿环实验演示...');
        this.isDemoPlaying = false;
    }
    
    /**
     * 重置演示
     */
    resetDemo() {
        console.log('重置牛顿环实验演示...');
        this.isDemoPlaying = false;
        this.demoStep = 0;
        this.resetToInitialState();
    }
    
    /**
     * 更新手动调节状态
     * @param {number} pressure 压力百分比 0-100
     * @param {number} position 测微目镜位置 -50 到 50
     */
    updateManualState(pressure, position) {
        // 关闭自动演示
        this.isDemoPlaying = false;
        
        // 1. 更新压力 (影响透镜距离)
        // pressure = 0 表示未接触
        // pressure > 0 开始接触，产生干涉环，值越大环越明显
        const threshold = this.config.maxPressDistance * 0.3;
        if (pressure <= 0) {
            this.lensDistance = threshold + 0.1; // 未接触
        } else {
            // 将 1-100 映射到 threshold 到 minLensDistance
            const progress = pressure / 100;
            const distanceRange = threshold - this.config.minLensDistance;
            this.lensDistance = threshold - (progress * distanceRange);
        }
        
        // 确保透镜位置正确更新
        if (this.planoConvexLens) {
            this.planoConvexLens.position.y = this.lensDistance + this.config.convexHeight/2 + this.config.planoConvexHeight;
        }
        
        // 2. 更新位置 (影响相机位置)
        if (this.isTopView && this.camera instanceof THREE.OrthographicCamera) {
            // 将 -50~50 映射到 -2.5~2.5 的3D坐标移动
            const moveX = (position / 50) * 2.5;
            this.camera.position.x = moveX;
            if (this.controls) {
                this.controls.target.x = moveX;
            }
        }
        
        // 3. 重新渲染牛顿环
        if (this.isTopView) {
            const intensity = this.calculateRingIntensity();
            this.updateNewtonRings3D(intensity, true);
        }
    }
    
    /**
     * 更新波长设置
     */
    updateWavelength() {
        console.log('更新波长到:', this.config.wavelength, 'nm');

        const color = this.wavelengthToRGB(this.config.wavelength);

        if (this.lightSource && this.lightSource.material) {
            this.lightSource.material.color.setHex(color);
            if (this.lightSource.material.emissive) {
                this.lightSource.material.emissive.setHex(color);
            }
        }

        this.createLightRays();

        const hasVisibleRings = this.rings && this.rings.children.length > 0;
        const shouldRedrawRings = hasVisibleRings || this.isTopView || this.isDemoPlaying;

        if (shouldRedrawRings) {
            let intensity = this.calculateRingIntensity();
            if (intensity <= 0.01 && (this.isTopView || hasVisibleRings)) {
                intensity = 1.0;
            }
            if (intensity > 0.01) {
                this.updateNewtonRings3D(intensity, this.isTopView);
            }
        }
    }
    
    /**
     * 波长转颜色
     */
    wavelengthToColor(wavelength) {
        let r, g, b;
        
        if (wavelength >= 380 && wavelength < 440) {
            r = -(wavelength - 440) / (440 - 380);
            g = 0.0;
            b = 1.0;
        } else if (wavelength >= 440 && wavelength < 490) {
            r = 0.0;
            g = (wavelength - 440) / (490 - 440);
            b = 1.0;
        } else if (wavelength >= 490 && wavelength < 510) {
            r = 0.0;
            g = 1.0;
            b = -(wavelength - 510) / (510 - 490);
        } else if (wavelength >= 510 && wavelength < 580) {
            r = (wavelength - 510) / (580 - 510);
            g = 1.0;
            b = 0.0;
        } else if (wavelength >= 580 && wavelength < 645) {
            r = 1.0;
            g = -(wavelength - 645) / (645 - 580);
            b = 0.0;
        } else if (wavelength >= 645 && wavelength <= 750) {
            r = 1.0;
            g = 0.0;
            b = 0.0;
        } else {
            r = 0.0;
            g = 0.0;
            b = 0.0;
        }
        
        // 强度调整
        let factor;
        if (wavelength >= 380 && wavelength < 420) {
            factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
        } else if (wavelength >= 420 && wavelength < 701) {
            factor = 1.0;
        } else if (wavelength >= 701 && wavelength <= 750) {
            factor = 0.3 + 0.7 * (750 - wavelength) / (750 - 701);
        } else {
            factor = 0.0;
        }
        
        r = Math.pow(r * factor, 0.8);
        g = Math.pow(g * factor, 0.8);
        b = Math.pow(b * factor, 0.8);
        
        return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    }
    
    /**
     * 更新演示动画
     */
    updateDemoAnimation() {
        if (!this.isDemoPlaying) return;
        
        const totalSteps = this.config.demoSteps || 400;
        const lightMoveSteps = totalSteps * 0.25;
        const pressSteps = totalSteps * 0.35;
        const switchSteps = totalSteps * 0.1;
        const holdSteps = totalSteps * 0.3;
        
        // 阶段1：移动光源
        if (this.demoStep < lightMoveSteps) {
            const progress = this.demoStep / lightMoveSteps;
            this.lightSource.position.x = this.config.lightPositionX + progress * this.config.lightMovementX;
            this.lightSource.position.z = this.config.lightPositionZ + progress * this.config.lightMovementZ;
            this.createLightRays();
            this.cleanupRings();
        } 
        // 阶段2：压下透镜
        else if (this.demoStep < lightMoveSteps + pressSteps) {
            const progress = (this.demoStep - lightMoveSteps) / pressSteps;
            const lensMove = progress * (this.config.maxPressDistance - this.config.minLensDistance);
            this.lensDistance = this.config.maxPressDistance - lensMove;
            this.planoConvexLens.position.y = this.lensDistance + this.config.convexHeight/2 + this.config.planoConvexHeight;
            
            const contactThreshold = this.config.maxPressDistance * 0.3;
            
            if (this.lensDistance < contactThreshold) {
                const normalizedDistance = (this.lensDistance - this.config.minLensDistance) / (contactThreshold - this.config.minLensDistance);
                const ringIntensity = 1 - normalizedDistance;
                
                if (ringIntensity > 0) {
                    this.updateNewtonRings3D(ringIntensity, false);
                } else {
                    this.cleanupRings();
                }
            } else {
                this.cleanupRings();
            }
            
            this.createLightRays();
        } 
        // 阶段3：切换到俯视图
        else if (this.demoStep < lightMoveSteps + pressSteps + switchSteps) {
            this.lensDistance = this.config.minLensDistance;
            this.planoConvexLens.position.y = this.lensDistance + this.config.convexHeight/2 + this.config.planoConvexHeight;
            
            this.updateNewtonRings3D(1.0, false);
            
            if (this.demoStep === lightMoveSteps + pressSteps + 1) {
                console.log('牛顿环形成，自动切换到俯视图观察...');
                this.setCameraTop();
            }
        }
        // 阶段4：维持俯视状态
        else if (this.demoStep < totalSteps) {
            this.lensDistance = this.config.minLensDistance;
            this.updateNewtonRings3D(1.0, true);
        } else {
            this.pauseDemo();
            this.enhanceRingsVisibility();
            return;
        }
        
        this.demoStep += 1;
    }
    
    /**
     * 设置俯视图相机
     */
    setCameraTop() {
        this.isTopView = true;
        
        const intensity = this.calculateRingIntensity();
        this.updateNewtonRings3D(intensity, true);
        
        // 切换为正交相机
        const aspect = this.monitorCanvas.width / this.monitorCanvas.height;
        const orthoSize = 5;
        this.camera = new THREE.OrthographicCamera(
            -orthoSize * aspect, orthoSize * aspect, 
            orthoSize, -orthoSize, 0.1, 100
        );
        
        this.camera.position.set(0, 6, 0);
        this.camera.lookAt(0, 1, 0);
        
        // 隐藏无关元素
        if (this.planoConvexLens) this.planoConvexLens.visible = false;
        if (this.lightSource) this.lightSource.visible = false;
        if (this.lightBeams) this.lightBeams.visible = false;
        
        // 恢复相机的原点X坐标
        this.camera.position.set(0, 6, 0);
        this.camera.lookAt(0, 1, 0);
        
        // 调整下方透镜材质
        if (this.convexLens && this.convexLens.material) {
            this.convexLens.material.opacity = 0.2;
            this.convexLens.material.depthWrite = false;
        }
        
        this.controls.object = this.camera;
        this.controls.target.set(0, 1, 0);
        this.controls.update();
    }
    
    /**
     * 计算干涉环强度
     */
    calculateRingIntensity() {
        const contactThreshold = this.config.maxPressDistance * 0.3;
        if (this.lensDistance < contactThreshold) {
            const normalizedDistance = (this.lensDistance - this.config.minLensDistance) / (contactThreshold - this.config.minLensDistance);
            return Math.max(0, 1 - normalizedDistance);
        }
        return 0;
    }
    
    /**
     * 更新3D牛顿环显示
     */
    updateNewtonRings3D(intensity, forceTop = false) {
        this.cleanupRings();
        
        if (intensity <= 0.01) {
            return;
        }
        
        // 确保透镜可见
        if (this.planoConvexLens) {
            this.planoConvexLens.children.forEach(part => {
                if (part.material) {
                    part.material.transparent = true;
                    part.material.opacity = 0.7;
                    part.material.depthWrite = true;
                }
            });
        }
        
        if (this.convexLens && this.convexLens.material) {
            this.convexLens.material.transparent = true;
            this.convexLens.material.opacity = 0.6;
            this.convexLens.material.depthWrite = true;
        }
        
        // 创建干涉纹理
        const baseRadius = 3.5;
        const ringRadius = baseRadius;
        
        const texture = this.createInterferenceTexture(2048, 1.0, this.config.wavelength, intensity);
        
        // 创建环的几何体和材质
        const geometry = new THREE.CircleGeometry(ringRadius, 256);
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
        
        const yPosition = this.lensDistance + this.config.convexHeight/2;
        ring.position.set(0, yPosition + 0.015, 0);
        ring.rotation.x = -Math.PI / 2;
        ring.rotation.y = 0;
        ring.rotation.z = 0;
        ring.scale.set(1, 1, 1);
        
        this.rings.add(ring);
        
        // 添加光线到环中心
        const rayGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
        rayGeometry.rotateX(Math.PI / 2);
        
        const rayMaterial = new THREE.MeshBasicMaterial({
            color: this.wavelengthToRGB(this.config.wavelength),
            transparent: true,
            opacity: 0.7
        });
        
        const ray = new THREE.Mesh(rayGeometry, rayMaterial);
        
        const source = new THREE.Vector3(
            this.lightSource.position.x,
            this.lightSource.position.y,
            this.lightSource.position.z
        );
        const target = new THREE.Vector3(0, yPosition, 0);
        const direction = new THREE.Vector3().subVectors(target, source).normalize();
        const distance = target.distanceTo(source);
        
        ray.position.copy(source.clone().add(direction.clone().multiplyScalar(distance / 2)));
        ray.scale.y = distance;
        ray.lookAt(target);
        
        this.lightBeams.add(ray);
        
        // 添加中心光点
        const centerPointGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const centerPointMaterial = new THREE.MeshBasicMaterial({
            color: this.wavelengthToRGB(this.config.wavelength),
            transparent: true,
            opacity: 0.9
        });
        const centerPoint = new THREE.Mesh(centerPointGeometry, centerPointMaterial);
        centerPoint.position.copy(target);
        centerPoint.position.y += 0.02;
        centerPoint.renderOrder = 1001;
        this.lightBeams.add(centerPoint);
    }
    
    /**
     * 创建干涉纹理
     */
    createInterferenceTexture(size, radius, wavelength, intensity) {
        const canvasSize = Math.pow(2, Math.ceil(Math.log2(size)));
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        
        const center = canvasSize / 2;
        const maxPixelRadius = center * radius * 0.98;
        
        const lightRGB = this.wavelengthToRGB(wavelength);
        const r = (lightRGB >> 16) & 0xff;
        const g = (lightRGB >> 8) & 0xff;
        const b = lightRGB & 0xff;
        
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        const wavelengthFactor = wavelength / 589.0; 
        const maxOrder = 25 / wavelengthFactor;
        
        const imageData = ctx.createImageData(canvasSize, canvasSize);
        const data = imageData.data;
        
        for (let y = 0; y < canvasSize; y++) {
            for (let x = 0; x < canvasSize; x++) {
                const dx = x - center;
                const dy = y - center;
                const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
                
                if (distanceToCenter <= maxPixelRadius) {
                    const normalizedRadius = distanceToCenter / maxPixelRadius;
                    const ringOrder = normalizedRadius * normalizedRadius * maxOrder;
                    
                    const interferencePhase = Math.PI * ringOrder;
                    const brightness = 0.5 + 0.5 * Math.cos(interferencePhase);
                    
                    const pixelIndex = (y * canvasSize + x) * 4;
            
                    const finalIntensity = brightness * intensity;
                    data[pixelIndex] = Math.round(r * finalIntensity);
                    data[pixelIndex + 1] = Math.round(g * finalIntensity);
                    data[pixelIndex + 2] = Math.round(b * finalIntensity);
                    data[pixelIndex + 3] = Math.round(255 * (finalIntensity > 0.05 ? 0.8 : 0));
                } else {
                    const pixelIndex = (y * canvasSize + x) * 4;
                    data[pixelIndex + 3] = 0;
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const firstRingRadius = Math.sqrt(1 / maxOrder) * maxPixelRadius;
        ctx.beginPath();
        ctx.arc(center, center, firstRingRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * intensity})`;
        ctx.fill();
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    /**
     * 增强牛顿环可见性
     */
    enhanceRingsVisibility() {
        if (this.planoConvexLens) {
            this.planoConvexLens.children.forEach(part => {
                if (part.material) {
                    part.material.transparent = true;
                    part.material.opacity = 0.5;
                    part.material.depthWrite = true;
                    part.material.side = THREE.DoubleSide;
                }
            });
        }
        
        if (this.convexLens && this.convexLens.material) {
            this.convexLens.material.transparent = true;
            this.convexLens.material.opacity = 0.4;
            this.convexLens.material.depthWrite = true;
        }
        
        if (this.rings.children.length === 0) {
            this.updateNewtonRings3D(1.0, this.isTopView);
        } else {
            this.rings.children.forEach(ring => {
                if (ring.material) {
                    if (ring.material.map) {
                        ring.material.transparent = true;
                        ring.material.needsUpdate = true;
                    } else {
                        ring.material.transparent = true;
                        ring.material.opacity = 0.9;
                    }
                    ring.renderOrder = 1000;
                }
            });
        }
    }
    
    /**
     * 渲染循环
     */
    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.isDemoPlaying) {
                this.updateDemoAnimation();
            }
            
            // 渲染3D场景到离屏canvas
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
                
                // 将渲染结果复制到显示器canvas
                this.copyToMonitorCanvas();
            }
        };
        
        animate();
    }
    
    /**
     * 将3D渲染结果复制到显示器canvas
     */
    copyToMonitorCanvas() {
        if (!this.monitorContext || !this.renderer) return;
        
        try {
            // 获取WebGL渲染器的canvas
            const rendererCanvas = this.renderer.domElement;
            
            // 清除显示器canvas
            this.monitorContext.clearRect(0, 0, this.monitorCanvas.width, this.monitorCanvas.height);
            
            // 将3D渲染结果绘制到显示器canvas
            this.monitorContext.drawImage(
                rendererCanvas, 
                0, 0, rendererCanvas.width, rendererCanvas.height,
                0, 0, this.monitorCanvas.width, this.monitorCanvas.height
            );
            
            // 如果是在顶部观察（即显微镜视图），绘制十字叉丝
            if (this.isTopView) {
                const cx = this.monitorCanvas.width / 2;
                const cy = this.monitorCanvas.height / 2;
                const lineLength = Math.min(cx, cy) * 0.8;
                
                // 绘制细致的黑色十字
                this.monitorContext.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                this.monitorContext.lineWidth = 1;
                this.monitorContext.beginPath();
                this.monitorContext.moveTo(cx, cy - lineLength);
                this.monitorContext.lineTo(cx, cy + lineLength);
                this.monitorContext.moveTo(cx - lineLength, cy);
                this.monitorContext.lineTo(cx + lineLength, cy);
                this.monitorContext.stroke();
                
                // 绘制刻度线 (十字丝的分划板)
                this.monitorContext.beginPath();
                for (let i = -10; i <= 10; i++) {
                    if (i === 0) continue;
                    const spacing = lineLength / 12;
                    const offset = i * spacing;
                    const tickLength = i % 5 === 0 ? 8 : 4;
                    // 水平线上的垂直刻度
                    this.monitorContext.moveTo(cx + offset, cy - tickLength);
                    this.monitorContext.lineTo(cx + offset, cy + tickLength);
                    // 垂直线上的水平刻度
                    this.monitorContext.moveTo(cx - tickLength, cy + offset);
                    this.monitorContext.lineTo(cx + tickLength, cy + offset);
                }
                this.monitorContext.stroke();
            }
            
            // 更新纹理
            if (this.monitorTexture) {
                this.monitorTexture.needsUpdate = true;
            }
        } catch (error) {
            console.warn('复制3D渲染结果到显示器canvas失败:', error);
        }
    }
    
    /**
     * 销毁资源
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        this.cleanupRings();
    }
}

// 导出类
window.Monitor3DIntegration = Monitor3DIntegration;