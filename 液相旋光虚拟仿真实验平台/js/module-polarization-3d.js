(function() {
    'use strict';

    // ============================================================
    // 第一部分：全局状态与常量
    // ============================================================

    // ===== 实验常量 =====
    var TARGET_CONCENTRATION = 0.10;      // 目标浓度 g/mL
    var VOLUMETRIC_VOLUME = 100;          // 容量瓶体积 mL
    var TUBE_LENGTH = 20;                 // 旋光管长度 cm
    var WAVELENGTH = 589.3;               // 钠光波长 nm
    var SPECIFIC_ROTATION = 66.37;        // 蔗糖比旋光度 [α]_D^20
    var HALF_SHADE_ANGLE = 4.0;           // 半荫片夹角 δ = 4°
    var TEMP_STANDARD = 20.0;             // 标准温度 °C
    var TEMP_COEFFICIENT = -0.00014;      // 温度系数 (°C⁻¹)，蔗糖的温度修正系数

    // ===== 状态机枚举 =====
    var STATE = {
        WEIGHING: 1,        // 称量蔗糖
        DISSOLVING: 2,      // 烧杯溶解
        VOLUMETRIC: 3,      // 定容
        FILLING_TUBE: 4,    // 灌管
        PLACING: 5,         // 擦拭并放入仪器
        MEASURING: 6        // 调等亮读数
    };

    // ===== 实验数据 =====
    var labData = {
        sugarMass: 0,           // 已称量质量 g
        targetMass: 10.0,       // 目标质量 g (0.10g/mL × 100mL)
        waterVolume: 0,         // 加水量 mL
        dissolved: false,       // 是否已溶解
        flaskVolume: 0,         // 容量瓶当前 mL
        tubeFilled: false,      // 是否已灌管
        hasBubbles: false,      // 是否有气泡
        tubeCleaned: false,     // 是否已擦拭
        instrumentOn: false,    // 仪器是否开机
        preheated: false,       // 是否预热完成
        tubePlaced: false,      // 是否已放管
        analyzerAngle: 0,       // 当前检偏角
        readings: [],           // 读数记录 [{concentration, angleA0, angleA, deltaA}]
        currentConcentration: 0,// 当前溶液浓度
        actualRotationAngle: 0  // 实际旋光角（由浓度计算）
    };

    // ===== 环境变量（温度与管长）=====
    var currentTemperature = 20.0;          // 当前环境温度 °C
    var currentTubeLengthDM = 2;            // 当前管长分米数 (1 或 2 dm)

    // ===== Three.js 全局变量 =====
    var scene, camera, renderer, controls;
    var raycaster, mouse;
    var labObjects = {};   // 存储所有可交互3D对象
    var selectedObject = null;
    var isDragging = false;
    var dragOffset = new THREE.Vector3();
    var animationId;

    // ===== 字幕系统变量 =====
    var tooltipOverlay;
    var activeTooltips = [];  // {element, meshRef}

    // ===== 目镜观测变量 =====
    var eyepieceAngle = 0;
    var renderEyepieceField = null;

    // ===== 网格辅助 =====
    var gridHelper = null;

    // ============================================================
    // 第二部分：状态机核心 + 物理计算引擎
    // ============================================================

    /**
     * 温度修正比旋光度
     * [α]_T = [α]_20 + k × (T - 20)
     * 蔗糖: k = -0.00014 °C⁻¹
     */
    function getCorrectedSpecificRotation(temp) {
        var t = temp !== undefined ? temp : currentTemperature;
        return SPECIFIC_ROTATION + TEMP_COEFFICIENT * (t - TEMP_STANDARD);
    }

    /**
     * 计算旋光角（完整物理公式）
     * θ = [α]_T × c × L
     * c: 浓度 (g/mL), L: 管长 (dm)
     */
    function calculateRotationAngle(concentration, temp, lengthDM) {
        var conc = concentration !== undefined ? concentration : labData.currentConcentration;
        var t = temp !== undefined ? temp : currentTemperature;
        var L = lengthDM !== undefined ? lengthDM : currentTubeLengthDM;
        var alphaT = getCorrectedSpecificRotation(t);
        return alphaT * conc * L;
    }

    /** 更新实际旋光角（供目镜渲染使用） */
    function updateActualRotationAngle() {
        labData.actualRotationAngle = calculateRotationAngle();
        return labData.actualRotationAngle;
    }

    var currentState = STATE.WEIGHING;

    // ============================================================
    //  FPS 风格相机控制系统 —— WASD移动 + 右键视角 + 左键交互
    //
    //  控制方案：
    //    WASD      → 前后左右平移（沿相机朝向的水平面投影）
    //    Shift     → 降低高度
    //    Space     → 升高高度
    //    右键拖拽  → 视角旋转（FPS式 yaw/pitch）
    //    左键点击  → 3D器材交互（事件流控v2接管）
    //
    //  替代原 OrbitControls 拖拽旋转模式
    // ============================================================

    /** FPS相机运动参数 */
    var CAM_MOVE_SPEED     = 0.12;       // 基础移动速度（单位/帧）
    var CAM_MOVE_SPEED_FAST = 0.28;        // 加速移动速度（Shift+WASD时）
    var CAM_LOOK_SENSITIVITY = 0.003;     // 右键视角灵敏度（弧度/像素）
    var CAM_YAW             = 0;          // 水平偏航角（弧度）
    var CAM_PITCH           = 0;          // 垂直俯仰角（弧度）
    var CAM_PITCH_LIMIT_UP   = Math.PI / 2 - 0.05;  // 仰角上限（略小于90°防Gimbal Lock）
    var CAM_PITCH_LIMIT_DOWN = -Math.PI / 4;        // 俯角下限（最多向下看45°）

    /** 相机边界限制 */
    var CAM_BOUNDS = {
        xMin: -12, xMax: 12,
        yMin: 0.5, yMax: 15,    // 不低于地面，不高于天花板
        zMin: -10, zMax: 10
    };

    /** 移动按键状态 */
    var _camMoveState = {
        forward: false,    // W
        backward: false,   // S
        left: false,       // A
        right: false,      // D
        up: false,         // Space
        down: false,       // Shift
        fast: false        // Shift（同时加速标志）
    };

    /** 右键视角控制状态（切换模式） */
    var _camRotateMode = false;       // true = 转动视角模式激活
    var _camLastMouseX = 0;
    var _camLastMouseY = 0;

    /**
     * 初始化FPS相机系统：
     *  1. 禁用OrbitControls的鼠标旋转
     *  2. 从当前相机位置计算初始yaw/pitch
     *  3. 绑定WASD+Shift+Space键盘事件
     *  4. 绑定右键视角事件
     */
    function _initFPSCameraSystem() {
        try {
            if (!controls || !camera || !renderer) {
                console.warn('[FPSCam] 初始化跳过：controls/camera/renderer未就绪');
                return;
            }

            // ====== 步骤1：禁用OrbitControls鼠标旋转 ======
            controls.enableRotate = false;   // ★ 核心变更：不再用左键拖拽旋转
            controls.enableZoom = true;      // 保留滚轮缩放
            controls.enablePan = false;      // 禁用右键平移（改为右键视角旋转）

            console.log('[FPSCam] OrbitControls已禁用旋转，FPS模式激活');

            // ====== 步骤2：从当前相机位置计算初始角度 ======
            _syncCameraAnglesFromPosition();

            // ====== 步骤3：绑定WASD键盘事件 ======
            document.addEventListener('keydown', _onFPSKeyDown);
            document.addEventListener('keyup', _onFPSKeyUp);

            // ====== 步骤4：绑定右键视角事件 ======
            var canvas = renderer.domElement;
            if (canvas) {
                canvas.addEventListener('mousedown', _onFPSRightDown);
                document.addEventListener('mouseup', _onFPSRightUp);
                canvas.addEventListener('mousemove', _onFPSMouseMove);
                // 禁止右键菜单（canvas + document 双层拦截）
                canvas.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
                // document 级兜底：防止某些情况下右键菜单仍弹出
                document.addEventListener('contextmenu', function(e) {
                    // 仅在 3D 容器范围内拦截
                    var container = document.getElementById('lab-container');
                    if (container && container.contains(e.target)) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                });
            }

            console.log('[FPSCam] WASD+右键视角系统已初始化');
        } catch(e) {
            console.error('[FPSCam] 初始化失败:', e.message, e.stack);
        }
    }

    /**
     * 从当前camera.position和controls.target反算yaw/pitch
     * 用于初始化和动画后同步
     */
    function _syncCameraAnglesFromPosition() {
        if (!camera || !controls) return;
        var target = controls.target || new THREE.Vector3(0, 0.3, 0);
        var offset = new THREE.Vector3().subVectors(camera.position, target);
        var dist = offset.length();

        if (dist > 0.001) {
            // 水平面上的投影 → yaw（绕Y轴旋转角）
            CAM_YAW = Math.atan2(offset.x, offset.z);
            // 垂直分量 → pitch
            CAM_PITCH = Math.asin(Math.max(-1, Math.min(1, offset.y / dist)));
        }
        console.log('[FPSCam] 初始角度: yaw=' + (CAM_YAW*180/Math.PI).toFixed(1) +
            '° pitch=' + (CAM_PITCH*180/Math.PI).toFixed(1) + '°');
    }

    /**
     * WASD + Shift + Space 键盘按下处理
     */
    function _onFPSKeyDown(event) {
        // 如果焦点在输入框中，不拦截
        var activeEl = document.activeElement;
        var tag = activeEl ? activeEl.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || activeEl.isContentEditable) return;

        switch(event.key.toLowerCase()) {
            case 'w': _camMoveState.forward = true; break;
            case 's': _camMoveState.backward = true; break;
            case 'a': _camMoveState.left = true; break;
            case 'd': _camMoveState.right = true; break;
            case ' ':
                event.preventDefault(); // 防止空格翻页
                _camMoveState.up = true;
                break;
            case 'shift':
                _camMoveState.down = true;
                _camMoveState.fast = true;
                break;
        }
    }

    function _onFPSKeyUp(event) {
        switch(event.key.toLowerCase()) {
            case 'w': _camMoveState.forward = false; break;
            case 's': _camMoveState.backward = false; break;
            case 'a': _camMoveState.left = false; break;
            case 'd': _camMoveState.right = false; break;
            case ' ': _camMoveState.up = false; break;
            case 'shift':
                _camMoveState.down = false;
                _camMoveState.fast = false;
                break;
        }
    }

    /**
     * 右键点击 → 切换转动视角模式（单击进入/退出）
     */
    function _onFPSRightDown(event) {
        if (event.button !== 2) return; // 只响应右键
        // 如果正在操作器材（OP_ACTIVE），不接管右键
        if (_opState === OP_ACTIVE) return;

        event.preventDefault();
        event.stopPropagation();  // 阻止事件冒泡到 OrbitControls

        // 切换模式：开 ↔ 关
        _camRotateMode = !_camRotateMode;

        if (_camRotateMode) {
            // 进入转动视角模式
            _camLastMouseX = event.clientX;
            _camLastMouseY = event.clientY;
            if (renderer) renderer.domElement.style.cursor = 'grab';
            _showRotateModeIndicator(true);
            console.log('[FPSCam] 转动视角模式 ON');
        } else {
            // 退出转动视角模式
            if (renderer) renderer.domElement.style.cursor = (_opState === OP_IDLE) ? 'default' : 'default';
            _showRotateModeIndicator(false);
            console.log('[FPSCam] 转动视角模式 OFF');
        }
    }

    function _onFPSRightUp(event) {
        // 切换模式下，松开不做任何操作
        // 仅阻止默认行为
        if (event.button === 2) event.preventDefault();
    }

    /**
     * 鼠标移动 → 转动视角模式下更新yaw/pitch
     */
    function _onFPSMouseMove(event) {
        if (!_camRotateMode) return;  // 仅在转动模式下响应

        var dx = event.clientX - _camLastMouseX;
        var dy = event.clientY - _camLastMouseY;

        _camLastMouseX = event.clientX;
        _camLastMouseY = event.clientY;

        // Yaw: 水平移动鼠标 → 绕Y轴旋转（鼠标右→视角左转）
        CAM_YAW -= dx * CAM_LOOK_SENSITIVITY;

        // Pitch: 垂直移动鼠标 → 俯仰角（反转：鼠标下→视角下俯）
        CAM_PITCH += dy * CAM_LOOK_SENSITIVITY;
        CAM_PITCH = Math.max(CAM_PITCH_LIMIT_DOWN, Math.min(CAM_PITCH_LIMIT_UP, CAM_PITCH));

        // 立即应用新角度到相机（不等待下一帧）
        _applyCameraRotation();
    }

    /**
     * 将yaw/pitch应用到相机位置（围绕target点旋转）
     */
    function _applyCameraRotation() {
        if (!camera || !controls) return;

        var target = controls.target || new THREE.Vector3(0, 0.3, 0);
        var distance = camera.position.distanceTo(target);

        // 从球坐标计算新的相机位置
        camera.position.x = target.x + distance * Math.sin(CAM_YAW) * Math.cos(CAM_PITCH);
        camera.position.y = target.y + distance * Math.sin(CAM_PITCH);
        camera.position.z = target.z + distance * Math.cos(CAM_YAW) * Math.cos(CAM_PITCH);

        // 让相机始终看向target
        camera.lookAt(target);
    }

    /**
     * 处理WASD移动（每帧调用一次）
     * ★ 屏幕空间固定方向：W始终向屏幕上方移动，A始终向左
     *    不受右键旋转视角影响，保证直线运动
     */
    function _processCameraMovement() {
        if (!camera || !controls) return;

        // 操作器材时不允许移动
        if (_opState === OP_ACTIVE || _opState === OP_FOCUS_LOCKED) return;

        var speed = _camMoveState.fast ? CAM_MOVE_SPEED_FAST : CAM_MOVE_SPEED;
        var moved = false;

        // ====== 屏幕空间方向计算 ======
        // 从相机当前朝向提取前/右向量，投影到水平面(XZ)，消除pitch影响
        // 这样：W = 向屏幕深处走（不管yaw怎么转，W始终是"屏幕上方"）
        var camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);  // 相机-Z轴方向（看向的方向）
        // 投影到水平面
        camForward.y = 0;
        if (camForward.lengthSq() > 0.0001) {
            camForward.normalize();
        } else {
            camForward.set(0, 0, -1); // 俯视90°时fallback
        }

        // 右向量 = 世界Y轴 × 前向量（叉积得到垂直于两者的右方向）
        var camRight = new THREE.Vector3().crossVectors(
            new THREE.Vector3(0, 1, 0),
            camForward
        ).normalize();

        // WASD 平移（屏幕空间固定）
        if (_camMoveState.forward) {
            camera.position.x += camForward.x * speed;
            camera.position.z += camForward.z * speed;
            controls.target.x += camForward.x * speed;   // 目标点同步跟随
            controls.target.z += camForward.z * speed;
            moved = true;
        }
        if (_camMoveState.backward) {
            camera.position.x -= camForward.x * speed;
            camera.position.z -= camForward.z * speed;
            controls.target.x -= camForward.x * speed;
            controls.target.z -= camForward.z * speed;
            moved = true;
        }
        if (_camMoveState.left) {
            camera.position.x += camRight.x * speed;
            camera.position.z += camRight.z * speed;
            controls.target.x += camRight.x * speed;
            controls.target.z += camRight.z * speed;
            moved = true;
        }
        if (_camMoveState.right) {
            camera.position.x -= camRight.x * speed;
            camera.position.z -= camRight.z * speed;
            controls.target.x -= camRight.x * speed;
            controls.target.z -= camRight.z * speed;
            moved = true;
        }

        // Space升高 / Shift降低
        if (_camMoveState.up) {
            camera.position.y += speed * 0.8;
            controls.target.y += speed * 0.8;  // 目标点跟随上升
            moved = true;
        }
        if (_camMoveState.down) {
            camera.position.y -= speed * 0.8;
            controls.target.y = Math.max(0, controls.target.y - speed * 0.8); // 不低于地面
            moved = true;
        }

        // 边界限制
        if (moved) {
            camera.position.x = Math.max(CAM_BOUNDS.xMin, Math.min(CAM_BOUNDS.xMax, camera.position.x));
            camera.position.y = Math.max(CAM_BOUNDS.yMin, Math.min(CAM_BOUNDS.yMax, camera.position.y));
            camera.position.z = Math.max(CAM_BOUNDS.zMin, Math.min(CAM_BOUNDS.zMax, camera.position.z));
        }
    }

    /**
     * 显示操作提示HUD（首次进入时显示WASD提示）
     */
    function _showCamControlHint() {
        var hint = document.createElement('div');
        hint.id = 'cam-control-hint';
        hint.innerHTML =
            '<div style="padding:12px 18px; border-radius:12px;' +
            'background:linear-gradient(135deg,rgba(10,16,29,0.95),rgba(20,30,50,0.9));' +
            'border:1px solid rgba(0,243,255,0.25); color:#e0e6ed; font-size:12px;' +
            'position:fixed; top:70px; left:50%; transform:translateX(-50%);' +
            'z-index:9999; backdrop-filter:blur(16px);' +
            'animation:hintFadeIn 0.5s ease-out forwards;">' +
            '<div style="color:#00F3FF; font-weight:700; margin-bottom:8px;">&#127760; \u89c6\u89d2\u63a7\u5236\u65b9\u5f0f</div>' +
            '<div style="line-height:1.8;">' +
            '<span class="kbd-hint">W</span><span class="kbd-hint">A</span><span class="kbd-hint">S</span><span class="kbd-hint">D</span> \u79fb\u52a8 &nbsp;|&nbsp; ' +
            '<span class="kbd-hint">Space</span> \u5347\u9ad8 &nbsp;|&nbsp; <span class="kbd-hint">Shift</span> \u964d\u4f4e<br>' +
            '<span class="kbd-hint" style="border-color:#FF6B6B;">\u53f3\u952e\u62d6\u62fd</span> \u65cb\u8f6c\u89c6\u89d2 &nbsp;|&nbsp; ' +
            '<span class="kbd-hint" style="border-color:#2ED573;">\u5de6\u952e</span> \u64cd\u4f5c\u5668\u6750' +
            '</div></div>' +
            '<style>.kbd-hint{display:inline-block;padding:2px 8px;border-radius:4px;' +
            'border:1px solid rgba(0,243,255,0.35);background:rgba(0,243,255,0.08);' +
            'color:#00F3FF;font-size:11px;font-family:\'Consolas\',monospace;font-weight:700;margin:0 1px;}' +
            '@keyframes hintFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}</style>';
        document.body.appendChild(hint);

        // 6秒后自动淡出
        setTimeout(function() {
            if (hint.parentNode) {
                hint.style.transition = 'opacity 1s ease-out';
                hint.style.opacity = '0';
                setTimeout(function() { if (hint.parentNode) hint.remove(); }, 1000);
            }
        }, 6000);
    }

    // ============================================================
    //  事件流控 v2.0 —— 左键交互状态机（与FPS相机系统并行）
    // ============================================================

    /** 操作状态枚举 */
    var OP_IDLE = 'idle';           // 空闲
    var OP_HOVER = 'hover';          // 悬停（未按下）
    var OP_ACTIVE = 'active';        // 已在器材上按下鼠标，正在操作
    var OP_FOCUS_LOCKED = 'focus';   // Focus Mode自动锁定状态

    var _opState = OP_IDLE;          // 当前操作状态
    var _mouseDownPos = { x: 0, y: 0 };
    var _hitObject = null;           // 当前命中的3D对象
    var DRAG_THRESHOLD = 5;          // 像素阈值

    /**
     * 射线检测：返回命中的可交互对象（null表示空白区域）
     * 同时更新 _hitObject 缓存
     */
    function _raycastAt(clientX, clientY) {
        if (!renderer || !camera || !raycaster) return null;
        var rect = renderer.domElement.getBoundingClientRect();
        var mx = ((clientX - rect.left) / rect.width) * 2 - 1;
        var my = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

        var clickables = [];
        scene.traverse(function(obj) {
            if (obj.userData && obj.userData.clickable) clickables.push(obj);
            obj.traverse && obj.traverse(function(child) {
                if (child.userData && child.userData.clickable) clickables.push(child);
            });
        });

        var hits = raycaster.intersectObjects(clickables, true);
        if (hits.length > 0) {
            var hit = hits[0].object;
            while (hit && !hit.userData.clickable && hit.parent) {
                hit = hit.parent;
            }
            _hitObject = (hit && hit.userData.clickable) ? hit : null;
            return _hitObject;
        }
        _hitObject = null;
        return null;
    }

    /**
     * 完全锁定相机控制（FPS模式：锁定WASD移动 + 右键视角）
     * 用于左键操作器材时防止误触发
     */
    function _lockControls() {
        // FPS模式下：_opState = OP_ACTIVE 时 _processCameraMovement() 自动跳过
        // 同时退出转动视角模式
        _camRotateMode = false;
        _showRotateModeIndicator(false);
        if (renderer) renderer.domElement.style.cursor = 'pointer';
    }

    /**
     * 恢复相机控制
     */
    function _unlockControls() {
        if (_opState === OP_IDLE && renderer) {
            renderer.domElement.style.cursor = 'default';
        }
    }

    /**
     * 仅锁定视角旋转（FPS模式下=禁止右键拖拽），保留WASD移动
     * 用于Focus Mode微操场景（定容/灌管）
     */
    function _lockRotationOnly() {
        _camRotateMode = false;
        _showRotateModeIndicator(false);
        // WASD移动仍然可用，只是不能转动视角
    }

    /**
     * 显示/隐藏 转动视角模式 指示器
     * @param {boolean} show - true=显示, false=隐藏
     */
    function _showRotateModeIndicator(show) {
        var el = document.getElementById('rotate-mode-indicator');
        if (show) {
            if (el) { el.style.display = 'flex'; return; }
            el = document.createElement('div');
            el.id = 'rotate-mode-indicator';
            el.innerHTML =
                '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3B82F6;margin-right:7px;animation:rotateIndPulse 1s ease-in-out infinite;box-shadow:0 0 6px rgba(59,130,246,0.5);"></span>' +
                '<span style="font-size:12px;font-weight:700;color:#1E293B;letter-spacing:0.5px;">转动视角模式</span>' +
                '<span style="font-size:11px;color:#94A3B8;margin-left:8px;font-weight:500;">再次右键退出</span>';
            el.style.cssText =
                'position:absolute;top:14px;left:50%;transform:translateX(-50%);' +
                'z-index:25;display:flex;align-items:center;padding:7px 18px;' +
                'background:rgba(255,255,255,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
                'border:1px solid rgba(59,130,246,0.25);border-radius:20px;' +
                'box-shadow:0 4px 16px rgba(59,130,246,0.12),0 1px 3px rgba(0,0,0,0.05);' +
                'font-family:"Segoe UI","Microsoft YaHei",sans-serif;' +
                'pointer-events:none;opacity:0;transition:opacity 0.25s ease;';
            var container = document.getElementById('lab-container');
            if (container) {
                container.appendChild(el);
                requestAnimationFrame(function() { el.style.opacity = '1'; });
            }
            if (!document.getElementById('rotate-ind-keyframes')) {
                var style = document.createElement('style');
                style.id = 'rotate-ind-keyframes';
                style.textContent = '@keyframes rotateIndPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.75);}}';
                document.head.appendChild(style);
            }
        } else {
            if (!el) return;
            el.style.opacity = '0';
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
        }
    }

    /**
     * 显示操作状态指示器（UI边缘浮动条）
     */
    function _showOpIndicator(text, type) {
        _hideOpIndicator(); // 先清除旧的
        var el = document.createElement('div');
        el.id = 'operation-indicator';
        el.style.cssText =
            'position:fixed; bottom:70px; left:50%; transform:translateX(-50%);' +
            'z-index:9999; pointer-events:auto;' +
            'display:flex; align-items:center; gap:12px;' +
            'padding:10px 20px; border-radius:30px;' +
            'background:' + (type === 'focus'
                ? 'linear-gradient(135deg,rgba(157,0,255,0.25),rgba(0,243,255,0.15))'
                : 'linear-gradient(135deg,rgba(0,243,255,0.2),rgba(0,180,216,0.1))') + ';' +
            'border:1px solid ' + (type === 'focus' ? 'rgba(157,0,255,0.4)' : 'rgba(0,243,255,0.35)') + ';' +
            'backdrop-filter:blur(16px);' +
            'animation:indicatorSlideIn 0.3s ease-out forwards;';
        el.innerHTML =
            '<span style="font-size:14px;">' + (type === 'focus' ? '&#128300;' : '&#9889;') + '</span>' +
            '<span style="color:#e0e6ed; font-size:12px; font-weight:600; white-space:nowrap;">' + text + '</span>' +
            '<button id="btn-exit-op" style="' +
                'padding:4px 14px; border-radius:20px; border:1px solid rgba(0,243,255,0.4);' +
                'background:transparent; color:#00F3FF; font-size:11px; cursor:pointer;' +
                'font-weight:700; transition:all 0.2s;"' +
                ' onmouseover="this.style.background=\'rgba(0,243,255,0.15)\'"' +
                ' onmouseout="this.style.background=\'transparent\'">' +
                '&#8634; \u8131\u79bb\u64cd\u4f5c</button>';
        document.body.appendChild(el);
        document.getElementById('btn-exit-op').addEventListener('click', function() {
            _exitOperationMode();
        });
    }

    function _hideOpIndicator() {
        var el = document.getElementById('operation-indicator');
        if (el) el.remove();
    }

    /** 退出操作模式（恢复视角控制+隐藏指示器） */
    window._exitOperationMode = function() {
        _opState = OP_IDLE;
        _unlockControls();
        _hideOpIndicator();
        removeHighlightOutline();
        if (renderer) renderer.domElement.style.cursor = 'grab';
        console.log('[EventFlow] 用户主动退出操作模式');
    };

    function transitionTo(newState) {
        if (newState <= currentState) return; // 不允许回退
        var oldState = currentState;
        currentState = newState;
        updateTaskPanel();
        updateControlPanel();
        updateSpatialTooltips();
        console.log('[3D Lab] 状态切换:', getStateName(oldState), '→', getStateName(newState));

        // ========== Focus Mode 自动锁定 ==========
        // 定容阶段：自动进入微操模式（锁定旋转，仅允许缩放看清刻度线）
        if (newState === STATE.VOLUMETRIC) {
            _enterFocusLock('\u5b9a\u5bb9\u6a21\u5f0f\uff1a\u9501\u5b9a\u65cb\u8f6c\uff0c\u53ef\u4ee5\u7528\u6ed1\u8f6e\u7f29\u653e\u770b\u6e05\u523b\u5ea6\u7ebf');
            // ★★★ 初始化全局键盘系统 + 激活定容微操键盘模式
            _initGlobalKeyboardSystem();
            _setKbdMode('MICRO_OP');
        }
        // 退出定容时恢复
        else if (oldState === STATE.VOLUMETRIC && newState > STATE.VOLUMETRIC) {
            _exitFocusLock();
            _setKbdMode('GLOBAL');
        }
        // 灌管阶段也启用微操模式
        if (newState === STATE.FILLING_TUBE) {
            _enterFocusLock('\u704c\u7ba1\u6a21\u5f0f\uff1a\u9501\u5b9a\u89c6\u89d2\uff0c\u70b9\u51fb\u65cb\u5149\u7ba1\u64cd\u4f5c');
            _setKbdMode('GLOBAL'); // 灌管阶段不需要键盘控制
        }
        else if (oldState === STATE.FILLING_TUBE && newState > STATE.FILLING_TUBE) {
            _exitFocusLock();
        }
    }

    /**
     * 进入Focus Mode微操状态：锁定旋转+平移，保留缩放
     * 显示操作指示器，提示用户可脱离
     */
    function _enterFocusLock(hintText) {
        _opState = OP_FOCUS_LOCKED;
        _lockRotationOnly();
        _showOpIndicator(hintText || '\u5fae\u64cd\u6a21\u5f0f\u5df2\u542f\u52a8', 'focus');
        console.log('[EventFlow] Focus Mode 锁定:', hintText);
    }

    /**
     * 退出Focus Mode，完全恢复视角控制
     */
    function _exitFocusLock() {
        if (_opState === OP_FOCUS_LOCKED || _opState === OP_ACTIVE) {
            _opState = OP_IDLE;
            _unlockControls();
            _hideOpIndicator();
            removeHighlightOutline();
            if (renderer) renderer.domElement.style.cursor = 'grab';
            console.log('[EventFlow] Focus Mode 已退出');
        }
    }

    function getStateName(state) {
        var names = {};
        names[STATE.WEIGHING] = '称量';
        names[STATE.DISSOLVING] = '溶解';
        names[STATE.VOLUMETRIC] = '定容';
        names[STATE.FILLING_TUBE] = '灌管';
        names[STATE.PLACING] = '放置仪器';
        names[STATE.MEASURING] = '测量';
        return names[state] || '未知';
    }

    function canAdvance() {
        switch(currentState) {
            case STATE.WEIGHING:
                return Math.abs(labData.sugarMass - labData.targetMass) < 0.1 && labData.sugarMass > 0.5;
            case STATE.DISSOLVING:
                return labData.dissolved;
            case STATE.VOLUMETRIC:
                return Math.abs(labData.flaskVolume - VOLUMETRIC_VOLUME) < 0.5;
            case STATE.FILLING_TUBE:
                return labData.tubeFilled && !labData.hasBubbles;
            case STATE.PLACING:
                return labData.tubeCleaned && labData.instrumentOn && labData.preheated && labData.tubePlaced;
            default:
                return true;
        }
    }

    // ============================================================
    // 第三部分：Three.js 3D 场景构建
    // ============================================================

    // 【模块二】注入增强CSS样式（动画、粒子效果等）
    function injectEnhancedStyles() {
        if (document.getElementById('enhanced-lab-styles')) return; // 避免重复注入

        var css = `
            /* 粒子爆裂动画 */
            @keyframes particle-fly {
                0% { transform:translate(-50%,-50%) translate(0,0) scale(1); opacity:1; }
                100% { opacity:0; }
            }

            /* 空间字幕呼吸灯增强 */
            .spatial-tooltip {
                animation: tooltip-breathe 2s ease-in-out infinite,
                           tooltip-fadeIn 0.3s ease-out !important;
                font-size: 11px !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                letter-spacing: 0.5px !important;
                text-shadow: 0 0 8px rgba(0,243,255,0.5) !important;
            }
            @keyframes tooltip-breathe {
                0%, 100% { box-shadow: 0 0 10px rgba(0,243,255,0.15); transform: translate(-50%,-100%) scale(1); }
                50% { box-shadow: 0 0 18px rgba(0,243,255,0.35); transform: translate(-50%,-100%) scale(1.03); }
            }
            @keyframes tooltip-fadeIn {
                from { opacity: 0; transform: translate(-50%,-100%) translateY(-5px) scale(0.95); }
                to { opacity: 1; transform: translate(-50%,-100%) translateY(0) scale(1); }
            }

            /* 引导线：从字幕指向器材 */
            .tooltip-guide-line {
                position: absolute;
                width: 1px;
                height: 30px;
                background: linear-gradient(to bottom, rgba(0,243,255,0.5), transparent);
                left: 50%;
                top: 100%;
                pointer-events: none;
            }

            /* 成功类字幕 - 绿色呼吸 */
            .spatial-tooltip.success {
                animation: success-breathe 2s ease-in-out infinite,
                           tooltip-fadeIn 0.3s ease-out !important;
                text-shadow: 0 0 8px rgba(0,255,135,0.5) !important;
            }
            @keyframes success-breathe {
                0%, 100% { box-shadow: 0 0 10px rgba(0,255,135,0.15); transform: translate(-50%,-100%) scale(1); }
                50% { box-shadow: 0 0 18px rgba(0,255,135,0.35); transform: translate(-50%,-100%) scale(1.03); }
            }

            /* 警告类字幕 - 橙色脉冲 */
            .spatial-tooltip.warning {
                animation: warning-pulse 1s ease-in-out infinite,
                           tooltip-fadeIn 0.3s ease-out !important;
                border-color: rgba(255,159,67,0.6) !important;
                color: #FF9F43 !important;
                text-shadow: 0 0 8px rgba(255,159,67,0.4) !important;
            }
            @keyframes warning-pulse {
                0%, 100% { box-shadow: 0 0 8px rgba(255,159,67,0.2); }
                50% { box-shadow: 0 0 16px rgba(255,159,67,0.5); }
            }

            /* 错误类字幕 - 保留抖动 */
            .spatial-tooltip.error {
                animation: error-shake 0.4s ease-in-out,
                           tooltip-fadeIn 0.3s ease-out !important;
            }
            @keyframes error-shake {
                0%, 100% { transform: translate(-50%,-100%) translateX(0); }
                25% { transform: translate(-50%,-100%) translateX(-5px); }
                75% { transform: translate(-50%,-100%) translateX(5px); }
            }

            /* 步骤锁定状态 */
            .step-locked {
                opacity: 0.4 !important;
                background: rgba(80,80,80,0.15) !important;
                color: #555 !important;
                pointer-events: none !important;
            }

            /* 警告气泡虚线边框 */
            .error-bubble.warning {
                border-style: dashed !important;
                animation: warning-bubble-pulse 1.2s ease-in-out infinite !important;
            }
            @keyframes warning-bubble-pulse {
                0%, 100% { border-color: rgba(255,159,67,0.4); }
                50% { border-color: rgba(255,159,67,0.8); }
            }
        `;

        var style = document.createElement('style');
        style.id = 'enhanced-lab-styles';
        style.textContent = css;
        document.head.appendChild(style);
        console.log('[3D Lab] 增强样式已注入');
    }

    function initLabScene() {
        // 【模块二】注入增强样式（CSS动画、粒子效果等）
        injectEnhancedStyles();

        if (typeof THREE === 'undefined') {
            console.error('[3D Lab] Three.js 未加载');
            showErrorBubble('Three.js 库未加载，无法启动 3D 实验室');
            return;
        }

        var container = document.getElementById('lab-canvas');
        if (!container) return;

        // 场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e17);
        scene.fog = new THREE.Fog(0x0a0e17, 15, 40);

        // 相机：45度俯视实验室，距离适中
        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(5, 7, 9);
        camera.lookAt(0, 0.5, 0);

        // 渲染器
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // 控制器
        if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.enableRotate = false;   // ★★★ FPS模式：禁用左键拖拽旋转
            controls.enablePan = false;       // ★★★ 禁用右键平移（改为右键视角）
            // ★ 彻底释放右键：将 OrbitControls 的右键映射到无效值，
            //   防止其内部 mousedown 消费掉右键事件
            controls.mouseButtons = {
                LEFT: THREE.MOUSE.DOLLY,       // 左键=缩放（或保持原逻辑）
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: -1                      // 右键=不处理，完全交给 FPS 系统
            };
            controls.enableZoom = true;       // 保留滚轮缩放
            controls.minDistance = 3;
            controls.maxDistance = 20;
            controls.target.set(0, 0.3, 0);
            // 初始角度：略微俯视桌面
            controls.minPolarAngle = Math.PI / 6;
            controls.maxPolarAngle = Math.PI / 2.1;
            controls.rotateSpeed = 0.8;
            controls.zoomSpeed = 1.2;

            // ★★★ 启动FPS相机系统（WASD + 右键视角）
            _initFPSCameraSystem();
        }

        // 射线检测（用于点击交互）
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // 灯光
        setupLights();

        // 构建场景物体
        createLabTable();
        createPreparationArea();     // 左侧：准备区（天平/烧杯等）
        createInstrumentArea();      // 右侧：仪器区（旋光仪）
        createGridHelper();          // 可选网格

        // 绑定事件
        bindEvents();

        // 启动动画
        animate();

        console.log('[3D Lab] 场景初始化完成');
    }

    function setupLights() {
        // 环境光
        var ambient = new THREE.AmbientLight(0x404060, 0.5);
        scene.add(ambient);

        // 主光源（模拟实验室顶灯）
        var mainLight = new THREE.DirectionalLight(0xffeedd, 0.7);
        mainLight.position.set(5, 12, 8);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far = 30;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 10;
        mainLight.shadow.camera.bottom = -10;
        scene.add(mainLight);

        // 补光
        var fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
        fillLight.position.set(-5, 6, -3);
        scene.add(fillLight);

        // 点光源（钠光灯效果，初始关闭）
        var sodiumLamp = new THREE.PointLight(0xffaa33, 0, 5);
        sodiumLamp.position.set(4, 2.5, 0);
        sodiumLamp.name = 'sodium-lamp';
        scene.add(sodiumLamp);
    }

    // ----- 3.2 创建实验桌 -----

    function createLabTable() {
        // 桌面
        var tableGeom = new THREE.BoxGeometry(14, 0.3, 8);
        var tableMat = new THREE.MeshPhongMaterial({
            color: 0x2a1810, shininess: 30,
            specular: 0x111111
        });
        var table = new THREE.Mesh(tableGeom, tableMat);
        table.position.y = -0.15;
        table.receiveShadow = true;
        table.name = 'table';
        scene.add(table);

        // 桌面反光层
        var topGeom = new THREE.BoxGeometry(14, 0.02, 8);
        var topMat = new THREE.MeshPhongMaterial({
            color: 0x3d2817, shininess: 80,
            transparent: true, opacity: 0.9
        });
        var tabletop = new THREE.Mesh(topGeom, topMat);
        tabletop.position.y = 0.01;
        tabletop.receiveShadow = true;
        scene.add(tabletop);

        // 桌腿（4条）
        var legGeom = new THREE.BoxGeometry(0.15, 2, 0.15);
        var legMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        var legPositions = [[-6.5,-1.15,-3.5], [6.5,-1.15,-3.5], [-6.5,-1.15,3.5], [6.5,-1.15,3.5]];
        for (var i = 0; i < legPositions.length; i++) {
            var leg = new THREE.Mesh(legGeom, legMat);
            leg.position.set(legPositions[i][0], legPositions[i][1], legPositions[i][2]);
            scene.add(leg);
        }
    }

    // ----- 3.3 创建准备区器材（左侧 x=-4 区域）-----

    /**
     * 碰撞体优化：为器材Group添加不可见的扩大点击热区
     * 原理：在器材外层包裹一个比视觉模型大15%的透明BoxGeometry
     * 效果：鼠标不需要精确点中模型网格，只要进入热区范围即可触发交互
     *
     * @param {THREE.Group} group - 器材Group对象
     * @param {Object} size - {w, h, d} 热区尺寸（略大于实际模型）
     */
    function addHitboxTo(group, size) {
        if (!group || !size) return;
        try {
            var boxGeom = new THREE.BoxGeometry(size.w, size.h, size.d);
            var hitboxMat = new THREE.MeshBasicMaterial({
                visible: false,          // 完全不可见
                depthWrite: false        // 不写入深度缓冲（不影响渲染）
            });
            var hitbox = new THREE.Mesh(boxGeom, hitboxMat);
            hitbox.name = 'hitbox-' + (group.name || 'unknown');
            hitbox.userData = { clickable: true, isHitbox: true };
            group.add(hitbox);
        } catch(e) {
            console.warn('[Hitbox] 创建失败:', (group||{}).name, e.message);
        }
    }

    function createPreparationArea() {

        // --- 电子天平 ---
        var balanceGroup = new THREE.Group();
        balanceGroup.name = 'balance';
        balanceGroup.userData = { clickable: true, label: '电子天平', step: STATE.WEIGHING };

        // 天平底座
        var baseGeom = new THREE.BoxGeometry(1.6, 0.15, 1.2);
        var baseMat = new THREE.MeshPhongMaterial({ color: 0x333344, shininess: 50 });
        var base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 0.075;
        balanceGroup.add(base);

        // 天平显示屏
        var displayGeom = new THREE.BoxGeometry(0.8, 0.35, 0.08);
        var displayMat = new THREE.MeshBasicMaterial({ color: 0x001a00 }); // 绿色LCD底
        var display = new THREE.Mesh(displayGeom, displayMat);
        display.position.set(0, 0.32, 0.45);
        display.name = 'balance-display';
        balanceGroup.add(display);

        // 显示屏数字纹理（动态更新）
        updateBalanceDisplay(balanceGroup, 0);

        // 天平台面
        var panGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24);
        var panMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 100 });
        var pan = new THREE.Mesh(panGeom, panMat);
        pan.position.y = 0.22;
        pan.name = 'balance-pan';
        pan.userData = { droppable: true }; // 可以放置物品
        balanceGroup.add(pan);

        balanceGroup.position.set(-4, 0.3, 0);
        scene.add(balanceGroup);
        addHitboxTo(balanceGroup, { w:2.0, h:0.6, d:1.5 });
        labObjects['balance'] = balanceGroup;


        // --- 蔗糖试剂瓶 ---
        var bottleGroup = createSugarBottle();
        bottleGroup.position.set(-5.5, 0.35, -1.5);
        bottleGroup.userData = { clickable: true, label: '蔗糖试剂瓶', step: STATE.WEIGHING };
        scene.add(bottleGroup);
        addHitboxTo(bottleGroup, { w:0.8, h:1.4, d:0.8 });
        labObjects['sugar-bottle'] = bottleGroup;

        // --- 烧杯 ---
        var beakerGroup = createBeaker();
        beakerGroup.position.set(-3, 0.35, -1.5);
        beakerGroup.userData = { clickable: true, label: '烧杯', step: STATE.WEIGHING };
        scene.add(beakerGroup);
        addHitboxTo(beakerGroup, { w:0.9, h:1.0, d:0.9 });
        labObjects['beaker'] = beakerGroup;

        // --- 玻璃棒 ---
        var rodGroup = createGlassRod();
        rodGroup.position.set(-2.5, 0.35, -1.5);
        rodGroup.userData = { clickable: true, label: '玻璃棒', step: STATE.DISSOLVING };
        rodGroup.visible = false; // 初始隐藏，溶解阶段显示
        scene.add(rodGroup);
        addHitboxTo(rodGroup, { w:0.4, h:1.2, d:0.15 });
        labObjects['glass-rod'] = rodGroup;

        // --- 蒸馏水洗瓶 ---
        var washBottleGroup = createWashBottle();
        washBottleGroup.position.set(-3, 0.35, 1);
        washBottleGroup.userData = { clickable: true, label: '蒸馏水洗瓶', step: STATE.DISSOLVING };
        scene.add(washBottleGroup);
        addHitboxTo(washBottleGroup, { w:0.6, h:1.2, d:0.5 });
        labObjects['wash-bottle'] = washBottleGroup;

        // --- 容量瓶 ---
        var flaskGroup = createVolumetricFlask();
        flaskGroup.position.set(-4, 0.35, 2);
        flaskGroup.userData = { clickable: true, label: '容量瓶(100mL)', step: STATE.VOLUMETRIC };
        scene.add(flaskGroup);
        addHitboxTo(flaskGroup, { w:0.7, h:1.8, d:0.7 });
        labObjects['volumetric-flask'] = flaskGroup;

        // --- 药匙 ---
        var spoonGroup = createSpatula();
        spoonGroup.position.set(-5, 0.35, -1.5);
        spoonGroup.userData = { clickable: true, label: '药匙', step: STATE.WEIGHING };
        spoonGroup.visible = false; // 点击试剂瓶后显示
        scene.add(spoonGroup);
        labObjects['spatula'] = spoonGroup;

        // --- 滴管（定容微调时出现）---
        var dropperGroup = createDropper();
        dropperGroup.position.set(-4, 1.5, 2);
        dropperGroup.userData = { clickable: true, label: '胶头滴管', step: STATE.VOLUMETRIC };
        dropperGroup.visible = false;
        scene.add(dropperGroup);
        addHitboxTo(dropperGroup, { w:0.3, h:0.8, d:0.3 });
        labObjects['dropper'] = dropperGroup;

        // --- 旋光管 ---
        var tubeGroup = createPolarimeterTube();
        tubeGroup.position.set(-2, 0.35, 2);
        tubeGroup.userData = { clickable: true, label: '旋光管', step: STATE.FILLING_TUBE };
        tubeGroup.visible = false; // 定容完成后显示
        scene.add(tubeGroup);
        addHitboxTo(tubeGroup, { w:0.5, h:1.6, d:0.5 });
        labObjects['polarimeter-tube'] = tubeGroup;

        // --- 擦镜纸 ---
        var paperGroup = createLensPaper();
        paperGroup.position.set(2, 0.35, 1.5);
        paperGroup.userData = { clickable: true, label: '擦镜纸', step: STATE.PLACING };
        scene.add(paperGroup);
        addHitboxTo(paperGroup, { w:0.4, h:0.15, d:0.4 });
        labObjects['lens-paper'] = paperGroup;
    }

    // ========== 器材创建辅助函数 ==========

    function createSugarBottle() {
        var group = new THREE.Group();
        group.name = 'sugar-bottle';

        // 圆柱瓶身（可点击）
        var bodyGeom = new THREE.CylinderGeometry(0.4, 0.35, 1.0, 16);
        var bodyMat = new THREE.MeshPhongMaterial({
            color: 0xffffff, transparent: true, opacity: 0.85, roughness: 0.1
        });
        var body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.5;
        body.name = 'sugar-body';
        body.userData = { clickable: true };   // ← 关键：Mesh本身也要可点击
        group.add(body);

        // 半球盖（可点击）
        var capGeom = new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        var capMat = new THREE.MeshPhongMaterial({
            color: 0xeeeeee, transparent: true, opacity: 0.7, roughness: 0.1
        });
        var cap = new THREE.Mesh(capGeom, capMat);
        cap.position.y = 1.0;
        cap.name = 'sugar-cap';
        cap.userData = { clickable: true };     // ← 瓶盖也可点击
        group.add(cap);

        // 标签平面贴图 CanvasTexture "蔗糖 分析纯"
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 128;
        labelCanvas.height = 200;
        var lctx = labelCanvas.getContext('2d');
        lctx.fillStyle = '#f0f0e0';
        lctx.fillRect(10, 30, 108, 150);
        lctx.strokeStyle = '#ccbb88';
        lctx.lineWidth = 2;
        lctx.strokeRect(10, 30, 108, 150);
        lctx.fillStyle = '#333333';
        lctx.font = 'bold 18px sans-serif';
        lctx.textAlign = 'center';
        lctx.fillText('蔗糖', 64, 70);
        lctx.font = '14px sans-serif';
        lctx.fillText('分析纯 AR', 64, 95);
        lctx.font = '11px sans-serif';
        lctx.fillStyle = '#666666';
        lctx.fillText('C₁₂H₂₂O₁₁', 64, 120);
        lctx.fillText('M=342.30', 64, 140);
        lctx.font = '10px sans-serif';
        lctx.fillText('500g/瓶', 64, 165);

        var labelTexture = new THREE.CanvasTexture(labelCanvas);
        var labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true });
        var labelPlane = new THREE.PlaneGeometry(0.55, 0.85);
        var labelMesh = new THREE.Mesh(labelPlane, labelMat);
        labelMesh.position.set(0, 0.5, 0.36);
        group.add(labelMesh);

        return group;
    }

    function createBeaker() {
        var group = new THREE.Group();
        group.name = 'beaker';

        // 圆柱形玻璃烧杯（开口）
        var bodyGeom = new THREE.CylinderGeometry(0.4, 0.38, 0.9, 24, 1, true);
        var glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.25,
            roughness: 0.05, transmission: 0.9, side: THREE.DoubleSide
        });
        var body = new THREE.Mesh(bodyGeom, glassMat);
        body.position.y = 0.45;
        body.name = 'beaker-body';
        body.userData = { clickable: true };
        group.add(body);

        // 底部加厚
        var bottomGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 24);
        var bottomMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05
        });
        var bottom = new THREE.Mesh(bottomGeom, bottomMat);
        bottom.position.y = 0.015;
        group.add(bottom);

        // 刻度线
        for (var i = 1; i <= 4; i++) {
            var tickY = i * 0.18;
            var tickGeom = new THREE.TorusGeometry(0.39, 0.005, 4, 32);
            var tickMat = new THREE.MeshBasicMaterial({ color: 0xaabbcc });
            var tick = new THREE.Mesh(tickGeom, tickMat);
            tick.rotation.x = Math.PI / 2;
            tick.position.y = tickY;
            group.add(tick);
        }

        // 倒液嘴（烧杯一侧的倾倒口）
        var spoutGeom = new THREE.SphereGeometry(0.06, 8, 8);
        var spout = new THREE.Mesh(spoutGeom, glassMat.clone());
        spout.position.set(0.38, 0.82, 0);
        spout.scale.set(1, 0.6, 1);
        group.add(spout);

        // 内部液体 mesh（初始不可见）
        var liquidGeom = new THREE.CylinderGeometry(0.36, 0.34, 0.01, 24);
        var liquidMat = new THREE.MeshPhongMaterial({
            color: 0xfff4c4, transparent: true, opacity: 0.6
        });
        var liquid = new THREE.Mesh(liquidGeom, liquidMat);
        liquid.position.y = 0.005;
        liquid.name = 'beaker-liquid';
        liquid.visible = false;
        group.add(liquid);

        return group;
    }

    function createGlassRod() {
        var group = new THREE.Group();
        group.name = 'glass-rod';

        var rodGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
        var rodMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.4,
            roughness: 0.05, transmission: 0.8
        });
        var rod = new THREE.Mesh(rodGeom, rodMat);
        rod.position.y = 0.6;
        group.add(rod);

        // 手柄端（稍粗）
        var handleGeom = new THREE.CylinderGeometry(0.035, 0.025, 0.25, 8);
        var handle = new THREE.Mesh(handleGeom, rodMat.clone());
        handle.position.y = 1.15;
        handle.rotation.z = 0.15;
        group.add(handle);

        return group;
    }

    function createWashBottle() {
        var group = new THREE.Group();
        group.name = 'wash-bottle';

        // 瓶身（扁平椭圆体）
        var bodyGeom = new THREE.SphereGeometry(0.35, 16, 12);
        bodyGeom.scale(1.2, 1, 0.8);
        var bodyMat = new THREE.MeshPhongMaterial({
            color: 0xeeddff, transparent: true, opacity: 0.75
        });
        var body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.3;
        group.add(body);

        // 颈部
        var neckGeom = new THREE.CylinderGeometry(0.06, 0.1, 0.3, 12);
        var neckMat = bodyMat.clone();
        var neck = new THREE.Mesh(neckGeom, neckMat);
        neck.position.y = 0.72;
        group.add(neck);

        // 喷嘴弯管
        var nozzleCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0.87, 0),
            new THREE.Vector3(0.15, 1.05, 0),
            new THREE.Vector3(0.25, 0.95, 0)
        );
        var nozzleGeom = new THREE.TubeGeometry(nozzleCurve, 12, 0.025, 6, false);
        var nozzleMat = neckMat.clone();
        var nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
        group.add(nozzle);

        // 标签
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 96;
        labelCanvas.height = 48;
        var wlCtx = labelCanvas.getContext('2d');
        wlCtx.fillStyle = '#ddeeff';
        wlCtx.fillRect(0, 0, 96, 48);
        wlCtx.fillStyle = '#3366aa';
        wlCtx.font = 'bold 13px sans-serif';
        wlCtx.textAlign = 'center';
        wlCtx.fillText('蒸馏水', 48, 28);
        wlCtx.font = '10px sans-serif';
        wlCtx.fillText('H₂O', 48, 42);
        var wLabelTex = new THREE.CanvasTexture(labelCanvas);
        var wLabelMat = new THREE.MeshBasicMaterial({ map: wLabelTex, transparent: true });
        var wLabelPlane = new THREE.PlaneGeometry(0.35, 0.18);
        var wLabelMesh = new THREE.Mesh(wLabelPlane, wLabelMat);
        wLabelMesh.position.set(0, 0.3, 0.29);
        group.add(wLabelMesh);

        return group;
    }

    function createVolumetricFlask() {
        var group = new THREE.Group();
        group.name = 'volumetric-flask';

        // 下半球瓶底
        var bottomGeom = new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        var glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.25,
            roughness: 0.05, transmission: 0.9, side: THREE.DoubleSide
        });
        var bottom = new THREE.Mesh(bottomGeom, glassMat);
        group.add(bottom);

        // 锥形过渡段（用 LatheGeometry 构建）
        var lathePoints = [];
        lathePoints.push(new THREE.Vector2(0.45, 0));   // 底部最宽
        lathePoints.push(new THREE.Vector2(0.42, 0.15));
        lathePoints.push(new THREE.Vector2(0.35, 0.35));
        lathePoints.push(new THREE.Vector2(0.18, 0.55)); // 颈部开始收窄
        lathePoints.push(new THREE.Vector2(0.12, 0.65));
        lathePoints.push(new THREE.Vector2(0.10, 0.80)); // 细颈
        lathePoints.push(new THREE.Vector2(0.10, 1.10)); // 颈部长度
        lathePoints.push(new THREE.Vector2(0.14, 1.15)); // 瓶口翻边

        var latheGeom = new THREE.LatheGeometry(lathePoints, 24);
        var latheBody = new THREE.Mesh(latheGeom, glassMat);
        latheBody.name = 'flask-body';
        latheBody.userData = { clickable: true };
        group.add(latheBody);

        // 刻度线（在颈部位置）
        var markY = 0.78; // 刻度线高度
        var markRingGeom = new THREE.TorusGeometry(0.115, 0.008, 4, 32);
        var markMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
        var markRing = new THREE.Mesh(markRingGeom, markMat);
        markRing.rotation.x = Math.PI / 2;
        markRing.position.y = markY;
        group.add(markRing);

        // 辅助刻度标记
        var markTextCanvas = document.createElement('canvas');
        markTextCanvas.width = 64;
        markTextCanvas.height = 24;
        var mtCtx = markTextCanvas.getContext('2d');
        mtCtx.fillStyle = '#cc2222';
        mtCtx.font = 'bold 14px sans-serif';
        mtCtx.textAlign = 'center';
        mtCtx.fillText('100mL', 32, 18);
        var markTextTex = new THREE.CanvasTexture(markTextCanvas);
        var markTextMat = new THREE.MeshBasicMaterial({ map: markTextTex, transparent: true });
        var markTextPlane = new THREE.PlaneGeometry(0.2, 0.075);
        var markTextMesh = new THREE.Mesh(markTextPlane, markTextMat);
        markTextMesh.position.set(0.125, markY + 0.05, 0);
        group.add(markTextMesh);

        // 内部液体 mesh（scaleY 控制）
        var liquidGeom = new THREE.CylinderGeometry(0.40, 0.40, 0.01, 24);
        var liquidMat = new THREE.MeshPhongMaterial({
            color: 0xfff4c4, transparent: true, opacity: 0.55
        });
        var liquid = new THREE.Mesh(liquidGeom, liquidMat);
        liquid.position.y = 0.005;
        liquid.name = 'flask-liquid';
        liquid.visible = false;
        group.add(liquid);

        // 瓶塞
        var stopperGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12);
        var stopperMat = new THREE.MeshPhongMaterial({ color: 0xcc9944, roughness: 0.8 });
        var stopper = new THREE.Mesh(stopperGeom, stopperMat);
        stopper.position.y = 1.21;
        stopper.name = 'flask-stopper';
        group.add(stopper);

        return group;
    }

    function createSpatula() {
        var group = new THREE.Group();
        group.name = 'spatula';

        // 手柄（加粗，便于点击）
        var handleGeom = new THREE.CylinderGeometry(0.03, 0.025, 0.7, 8);
        var handleMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 50 });
        var handle = new THREE.Mesh(handleGeom, handleMat);
        handle.position.y = 0.4;
        handle.rotation.z = 0.15;
        group.add(handle);

        // 铲头（加大，扁平三角形区域）
        var bladeGeom = new THREE.BoxGeometry(0.22, 0.015, 0.28);
        var bladeMat = new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 80 });
        var blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.set(0.06, 0.08, 0);
        blade.rotation.y = 0.2;
        group.add(blade);

        // 点击热区（不可见的大碰撞体，确保容易点中）
        var hitGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        var hitMat = new THREE.MeshBasicMaterial({ visible: false });
        var hitBox = new THREE.Mesh(hitGeom, hitMat);
        hitBox.position.y = 0.35;
        hitBox.name = 'spatula-hit';
        group.add(hitBox);

        return group;
    }

    function createDropper() {
        var group = new THREE.Group();
        group.name = 'dropper';

        // 橡胶头（球形）
        var bulbGeom = new THREE.SphereGeometry(0.08, 12, 10);
        var bulbMat = new THREE.MeshPhongMaterial({ color: 0xdd4444, roughness: 0.7 });
        var bulb = new THREE.Mesh(bulbGeom, bulbMat);
        bulb.position.y = 0.15;
        bulb.name = 'dropper-bulb';
        bulb.userData = { clickable: true };
        group.add(bulb);

        // 玻璃管身
        var tubeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
        var glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.35,
            roughness: 0.05, transmission: 0.7
        });
        var tube = new THREE.Mesh(tubeGeom, glassMat);
        tube.position.y = -0.12;
        group.add(tube);

        // 尖端
        var tipGeom = new THREE.ConeGeometry(0.015, 0.08, 8);
        var tip = new THREE.Mesh(tipGeom, glassMat.clone());
        tip.position.y = -0.33;
        group.add(tip);

        return group;
    }

    function createPolarimeterTube() {
        var group = new THREE.Group();
        group.name = 'polarimeter-tube';

        // 长圆柱管身
        var tubeBodyGeom = new THREE.CylinderGeometry(0.18, 0.18, 2.5, 16);
        var glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.2,
            roughness: 0.05, transmission: 0.92, side: THREE.DoubleSide
        });
        var tubeBody = new THREE.Mesh(tubeBodyGeom, glassMat);
        tubeBody.position.y = 1.25;
        tubeBody.name = 'tube-body';
        tubeBody.userData = { clickable: true };
        group.add(tubeBody);

        // 左端石英玻璃盖
        var endCapGeom = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 16);
        var endCapMat = new THREE.MeshPhysicalMaterial({
            color: 0xf8f8ff, transparent: true, opacity: 0.4,
            roughness: 0.02, transmission: 0.95
        });
        var leftCap = new THREE.Mesh(endCapGeom, endCapMat);
        leftCap.position.y = 0;
        group.add(leftCap);

        // 右端石英玻璃盖
        var rightCap = new THREE.Mesh(endCapGeom.clone(), endCapMat.clone());
        rightCap.position.y = 2.5;
        group.add(rightCap);

        // 金属端环（左）
        var ringGeom = new THREE.TorusGeometry(0.19, 0.02, 6, 24);
        var metalMat = new THREE.MeshPhongMaterial({ color: 0x999999, shininess: 80 });
        var leftRing = new THREE.Mesh(ringGeom, metalMat);
        leftRing.rotation.x = Math.PI / 2;
        leftRing.position.y = 0.03;
        group.add(leftRing);

        // 金属端环（右）
        var rightRing = new THREE.Mesh(ringGeom.clone(), metalMat.clone());
        rightRing.rotation.x = Math.PI / 2;
        rightRing.position.y = 2.47;
        group.add(rightRing);

        // 内部液体 mesh（初始不可见）
        var innerLiquidGeom = new THREE.CylinderGeometry(0.16, 0.16, 2.4, 16);
        var innerLiquidMat = new THREE.MeshPhongMaterial({
            color: 0xfff4c4, transparent: true, opacity: 0.5
        });
        var innerLiquid = new THREE.Mesh(innerLiquidGeom, innerLiquidMat);
        innerLiquid.position.y = 1.25;
        innerLiquid.name = 'tube-liquid';
        innerLiquid.visible = false;
        group.add(innerLiquid);

        // 气泡 sphere（条件可见）
        var bubbleGeom = new THREE.SphereGeometry(0.04, 12, 10);
        var bubbleMat = new THREE.MeshPhongMaterial({
            color: 0xffffff, transparent: true, opacity: 0.6,
            emissive: 0x333333
        });
        var bubble = new THREE.Mesh(bubbleGeom, bubbleMat);
        bubble.position.set(0.05, 1.5, 0.08);
        bubble.name = 'tube-bubble';
        bubble.visible = false;
        group.add(bubble);

        return group;
    }

    function createLensPaper() {
        var group = new THREE.Group();
        group.name = 'lens-paper';

        // 方形薄纸片
        var paperGeom = new THREE.BoxGeometry(0.35, 0.008, 0.35);
        var paperMat = new THREE.MeshPhongMaterial({
            color: 0xfff8ee, roughness: 0.95, side: THREE.DoubleSide
        });
        var paper = new THREE.Mesh(paperGeom, paperMat);
        paper.position.y = 0.004;
        paper.name = 'paper-body';
        paper.userData = { clickable: true };
        group.add(paper);

        // 微微弯曲效果（模拟纸张柔软性）
        paper.rotation.x = 0.03;
        paper.rotation.z = -0.02;

        // 标签文字
        var lpCanvas = document.createElement('canvas');
        lpCanvas.width = 80;
        lpCanvas.height = 40;
        var lpCtx = lpCanvas.getContext('2d');
        lpCtx.fillStyle = '#fff8ee';
        lpCtx.fillRect(0, 0, 80, 40);
        lpCtx.fillStyle = '#aa8855';
        lpCtx.font = 'bold 12px sans-serif';
        lpCtx.textAlign = 'center';
        lpCtx.fillText('擦镜纸', 40, 24);
        var lpTex = new THREE.CanvasTexture(lpCanvas);
        var lpMat = new THREE.MeshBasicMaterial({ map: lpTex, transparent: true });
        var lpPlane = new THREE.PlaneGeometry(0.3, 0.15);
        var lpMesh = new THREE.Mesh(lpPlane, lpMat);
        lpMesh.position.set(0, 0.01, 0);
        lpMesh.rotation.x = -Math.PI / 2;
        group.add(lpMesh);

        return group;
    }

    // ----- 恒温水浴槽（温度控制） -----
    function createWaterBath() {
        var group = new THREE.Group();
        group.name = 'water-bath';

        // 外槽体（不锈钢色矩形）
        var outerGeom = new THREE.BoxGeometry(1.8, 0.6, 1.2);
        var metalMat = new THREE.MeshPhongMaterial({
            color: 0x888899, shininess: 60, roughness: 0.3
        });
        var outerBody = new THREE.Mesh(outerGeom, metalMat);
        outerBody.position.y = 0.3;
        group.add(outerBody);

        // 内部水槽（半透明蓝色液体）
        var waterGeom = new THREE.BoxGeometry(1.5, 0.35, 0.95);
        var waterMat = new THREE.MeshPhongMaterial({
            color: 0x2288cc, transparent: true, opacity: 0.45,
            roughness: 0.1
        });
        var water = new THREE.Mesh(waterGeom, waterMat);
        water.position.y = 0.26;
        water.name = 'bath-water';
        group.add(water);

        // 水面波纹效果层
        var rippleGeom = new THREE.PlaneGeometry(1.4, 0.85);
        var rippleMat = new THREE.MeshBasicMaterial({
            color: 0x44aaff, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide
        });
        var ripple = new THREE.Mesh(rippleGeom, rippleMat);
        ripple.rotation.x = -Math.PI / 2;
        ripple.position.y = 0.435;
        ripple.name = 'bath-ripple';
        group.add(ripple);

        // 加热元件指示（底部红色条）
        var heaterGeom = new THREE.BoxGeometry(1.2, 0.04, 0.7);
        var heaterMat = new THREE.MeshBasicMaterial({ color: 0x662200 }); // 初始暗红（关闭）
        var heater = new THREE.Mesh(heaterGeom, heaterMat);
        heater.position.y = 0.08;
        heater.name = 'bath-heater';
        group.add(heater);

        // 温度显示屏（小型LCD）
        var tempDisplayCanvas = document.createElement('canvas');
        tempDisplayCanvas.width = 96;
        tempDisplayCanvas.height = 40;
        var tCtx = tempDisplayCanvas.getContext('2d');
        tCtx.fillStyle = '#001a00';
        tCtx.fillRect(0, 0, 96, 40);
        tCtx.fillStyle = '#00FF41';
        tCtx.font = 'bold 22px Consolas, monospace';
        tCtx.textAlign = 'center';
        tCtx.fillText('20.0\u00B0C', 48, 28);

        var tempTex = new THREE.CanvasTexture(tempDisplayCanvas);
        var tempDisplayMat = new THREE.MeshBasicMaterial({ map: tempTex });
        var tempDisplayGeom = new THREE.PlaneGeometry(0.5, 0.21);
        var tempDisplayMesh = new THREE.Mesh(tempDisplayGeom, tempDisplayMat);
        tempDisplayMesh.position.set(0, 0.65, 0.61);
        tempDisplayMesh.name = 'bath-temp-display';
        group.add(tempDisplayMesh);

        // 控制旋钮
        var knobGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
        var knobMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 70 });
        var knob = new THREE.Mesh(knobGeom, knobMat);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-0.55, 0.62, 0.61);
        knob.name = 'bath-knob';
        knob.userData = { clickable: true, label: '\u6e29\u63a7\u65cb\u94ae' };
        group.add(knob);

        // 标签 "恒温水浴槽"
        var labelCanvas = document.createElement('canvas');
        labelCanvas.width = 120;
        labelCanvas.height = 30;
        var lbCtx = labelCanvas.getContext('2d');
        lbCtx.fillStyle = 'rgba(10,14,23,0.9)';
        lbCtx.fillRect(0, 0, 120, 30);
        lbCtx.fillStyle = '#00F3FF';
        lbCtx.font = 'bold 13px sans-serif';
        lbCtx.textAlign = 'center';
        lbCtx.fillText('\u6052\u6e29\u6c34\u6d74\u69fd', 60, 20);
        var lbTex = new THREE.CanvasTexture(labelCanvas);
        var lbMat = new THREE.MeshBasicMaterial({ map: lbTex, transparent: true });
        var lbPlane = new THREE.PlaneGeometry(0.6, 0.15);
        var lbMesh = new THREE.Mesh(lbPlane, lbMat);
        lbMesh.position.set(0, 0.63, -0.61);
        group.add(lbMesh);

        return group;
    }

    /** 更新水浴槽温度显示与视觉反馈 */
    function updateBathTempDisplay(bathGroup, temp) {
        if (!bathGroup) return;
        var display = bathGroup.getObjectByName('bath-temp-display');
        if (!display) return;

        var canvas = document.createElement('canvas');
        canvas.width = 96; canvas.height = 40;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#001a00';
        ctx.fillRect(0, 0, 96, 40);
        // 温度颜色：标准=绿色，偏高=橙色，偏低=蓝色
        var tempColor = '#00FF41';
        if (temp > 25) tempColor = '#FF9F43';
        else if (temp < 15) tempColor = '#70C1FF';
        ctx.fillStyle = tempColor;
        ctx.font = 'bold 22px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(temp.toFixed(1) + '\u00B0C', 48, 28);

        var texture = new THREE.CanvasTexture(canvas);
        display.material.map = texture;
        display.material.needsUpdate = true;

        // 加热元件颜色（偏离标准越远越亮）
        var heater = bathGroup.getObjectByName('bath-heater');
        if (heater) {
            var heatIntensity = Math.min(Math.abs(temp - 20) / 15, 1);
            var r = Math.floor(102 + heatIntensity * 153);
            var g = Math.floor(34 * (1 - heatIntensity * 0.5));
            heater.material.color.setHex((r << 16) | (g << 8));
        }

        // 水面颜色（高温偏暖橙，低温偏冷蓝）
        var water = bathGroup.getObjectByName('bath-water');
        if (water) {
            var warmth = Math.max(0, Math.min(1, (temp - 10) / 30));
            var wr = Math.floor(34 + warmth * 200);
            var wg = Math.floor(136 - warmth * 50);
            var wb = Math.floor(204 - warmth * 150);
            water.material.color.setHex((wr << 16) | (wg << 8) | wb);
        }
    }

    /** 切换旋光管长度（1dm / 2dm） */
    function switchTubeLength(newLengthDM) {
        if (currentTubeLengthDM === newLengthDM) return;

        currentTubeLengthDM = newLengthDM;
        TUBE_LENGTH = newLengthDM * 10; // dm → cm

        // 拉伸/压缩3D旋光管模型
        var tube = labObjects['polarimeter-tube'];
        if (tube) {
            var tubeBody = tube.getObjectByName('tube-body');
            if (tubeBody) {
                // 基准高度 2.5 对应 2dm (20cm)，比例系数 2.5/2 = 1.25
                var targetHeight = newLengthDM * 1.25;
                tubeBody.scale.y = targetHeight / 2.5;
                tubeBody.position.y = targetHeight / 2;

                // 同步更新端盖和端环位置
                var rightCap = null, rightRing = null, innerLiquid = null;
                tube.children.forEach(function(child) {
                    if (child.geometry && child.geometry.type === 'CylinderGeometry'
                        && child.position.y > 2 && child !== tubeBody) {
                        rightCap = child;
                    }
                    if (child.geometry && child.geometry.type === 'TorusGeometry'
                        && child.position.y > 2) {
                        rightRing = child;
                    }
                    if (child.name === 'tube-liquid') {
                        innerLiquid = child;
                    }
                });

                // 右端盖移到新位置
                if (rightCap) rightCap.position.y = targetHeight;
                if (rightRing) rightRing.position.y = targetHeight - 0.03;

                // 内部液体同步拉伸
                if (innerLiquid) {
                    innerLiquid.scale.y = (targetHeight - 0.1) / 2.4;
                    innerLiquid.position.y = targetHeight / 2;
                }
            }
        }

        // 重新计算当前旋光角
        updateActualRotationAngle();

        console.log('[3D Lab] \u7ba1\u957f\u5207\u6362: ' + newLengthDM + 'dm (\u603b\u957f' + TUBE_LENGTH + 'cm)');
        showSuccessBubble(
            '\u2713 \u65cb\u5149\u7ba1\u5207\u6362\u4e3a ' + newLengthDM + 'dm\n' +
            '\u6bd4\u65cb\u5149\u5ea6: ' + getCorrectedSpecificRotation().toFixed(3) + '\u00B0\u00B7mL/(g\u00B7dm)\n' +
            '\u5149\u7a0b\u53d8\u5316: \u03b8 \u00D7 ' + newLengthDM
        );

        updateControlPanel();
    }

    // ----- 3.4 创建仪器区器材（右侧 x=+4 区域）-----

    function createInstrumentArea() {
        var polarimeterGroup = new THREE.Group();
        polarimeterGroup.name = 'polarimeter';
        polarimeterGroup.userData = { clickable: true, label: '旋光仪' };

        // 主体机身
        var bodyGeom = new THREE.BoxGeometry(2, 2.5, 3);
        var bodyMat = new THREE.MeshPhongMaterial({ color: 0x2a2a35, shininess: 40 });
        var body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 1.25;
        body.castShadow = true;
        polarimeterGroup.add(body);

        // 机身顶部装饰条
        var topStripGeom = new THREE.BoxGeometry(2.05, 0.08, 3.05);
        var topStripMat = new THREE.MeshPhongMaterial({ color: 0x3a3a48, shininess: 60 });
        var topStrip = new THREE.Mesh(topStripGeom, topStripMat);
        topStrip.position.y = 2.54;
        polarimeterGroup.add(topStrip);

        // 底座（更宽的基座）
        var baseGeom = new THREE.BoxGeometry(2.4, 0.2, 3.4);
        var baseMat = new THREE.MeshPhongMaterial({ color: 0x1a1a22, shininess: 30 });
        var basePlate = new THREE.Mesh(baseGeom, baseMat);
        basePlate.position.y = 0.1;
        polarimeterGroup.add(basePlate);

        // 暗箱（中间凸起部分）
        var darkBoxGeom = new THREE.BoxGeometry(1.4, 1.2, 2.0);
        var darkBoxMat = new THREE.MeshPhongMaterial({ color: 0x1a1a22, shininess: 20 });
        var darkBox = new THREE.Mesh(darkBoxGeom, darkBoxMat);
        darkBox.position.set(0, 1.8, 0.3);
        darkBox.castShadow = true;
        darkBox.name = 'sample-compartment';
        darkBox.userData = { clickable: true, label: '暗箱' };
        polarimeterGroup.add(darkBox);

        // 暗箱盖（可打开/关闭）
        var lidGeom = new THREE.BoxGeometry(1.5, 0.1, 2.1);
        var lidMat = new THREE.MeshPhongMaterial({ color: 0x333344, shininess: 50 });
        var lid = new THREE.Mesh(lidGeom, lidMat);
        lid.position.set(0, 2.45, 0.3);
        lid.name = 'dark-box-lid';
        polarimeterGroup.add(lid);

        // 目镜筒（前上方）
        var eyepieceGeom = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 20);
        var eyepieceMat = new THREE.MeshPhongMaterial({ color: 0x222230, shininess: 60 });
        var eyepieceCyl = new THREE.Mesh(eyepieceGeom, eyepieceMat);
        eyepieceCyl.rotation.x = Math.PI / 2;
        eyepieceCyl.position.set(0, 2.2, 1.7);
        eyepieceCyl.name = 'eyepiece-lens';
        eyepieceCyl.userData = { clickable: true, label: '目镜' };
        polarimeterGroup.add(eyepieceCyl);

        // 目镜玻璃面
        var eyeGlassGeom = new THREE.CircleGeometry(0.23, 20);
        var eyeGlassMat = new THREE.MeshPhysicalMaterial({
            color: 0x334455, transparent: true, opacity: 0.5,
            roughness: 0.1
        });
        var eyeGlass = new THREE.Mesh(eyeGlassGeom, eyeGlassMat);
        eyeGlass.position.set(0, 2.2, 2.11);
        polarimeterGroup.add(eyeGlass);

        // 目镜装饰圈
        var eyeRingGeom = new THREE.TorusGeometry(0.26, 0.025, 8, 24);
        var eyeRingMat = new THREE.MeshPhongMaterial({ color: 0x666677, shininess: 70 });
        var eyeRing = new THREE.Mesh(eyeRingGeom, eyeRingMat);
        eyeRing.position.set(0, 2.2, 2.08);
        polarimeterGroup.add(eyeRing);

        // 手轮（右侧大圆形盘）
        var wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32);
        var wheelMat = new THREE.MeshPhongMaterial({ color: 0x444455, shininess: 50 });
        var wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(1.25, 0.8, 0);
        wheel.name = 'handwheel';
        wheel.userData = { clickable: true, label: '手轮' };
        polarimeterGroup.add(wheel);

        // 手轮中心轴
        var wheelHubGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16);
        var wheelHubMat = new THREE.MeshPhongMaterial({ color: 0x666677, shininess: 60 });
        var wheelHub = new THREE.Mesh(wheelHubGeom, wheelHubMat);
        wheelHub.rotation.x = Math.PI / 2;
        wheelHub.position.set(1.25, 0.8, 0);
        polarimeterGroup.add(wheelHub);

        // 手轮刻度纹路（放射状线条）
        for (var wi = 0; wi < 24; wi++) {
            var angle = (wi / 24) * Math.PI * 2;
            var tickGeom = new THREE.BoxGeometry(0.35, 0.015, 0.008);
            var tickMat = new THREE.MeshBasicMaterial({ color: 0x777788 });
            var tick = new THREE.Mesh(tickGeom, tickMat);
            tick.position.set(1.25, 0.8, 0);
            tick.rotation.z = angle;
            tick.translateX(0.27);
            tick.position.x += 1.25 - tick.position.x + 1.25;
            // 更简单的方式：直接计算位置
            var tx = 1.25 + Math.cos(angle) * 0.27;
            var tz = 0 + Math.sin(angle) * 0.27;
            tick.position.set(tx, 0.8, tz);
            tick.rotation.y = -angle;
            polarimeterGroup.add(tick);
        }

        // 电源开关（前面板左侧小方块）
        var switchGeom = new THREE.BoxGeometry(0.15, 0.15, 0.06);
        var switchOffMat = new THREE.MeshPhongMaterial({ color: 0x662222, shininess: 40 });
        var powerSwitch = new THREE.Mesh(switchGeom, switchOffMat);
        powerSwitch.position.set(-0.7, 0.5, 1.51);
        powerSwitch.name = 'power-switch';
        powerSwitch.userData = { clickable: true, label: '电源开关' };
        polarimeterGroup.add(powerSwitch);

        // 开关指示灯（小红点）
        var ledGeom = new THREE.CircleGeometry(0.025, 12);
        var ledOffMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
        var led = new THREE.Mesh(ledGeom, ledOffMat);
        led.position.set(-0.7, 0.68, 1.54);
        led.name = 'power-led';
        polarimeterGroup.add(led);

        // 读数窗（前面板上部矩形窗口）
        var readWindowGeom = new THREE.BoxGeometry(0.6, 0.3, 0.04);
        var readWindowMat = new THREE.MeshBasicMaterial({ color: 0x002200 }); // 绿色LCD底色
        var readWindow = new THREE.Mesh(readWindowGeom, readWindowMat);
        readWindow.position.set(0, 1.9, 1.52);
        readWindow.name = 'reading-window';
        readWindow.userData = { clickable: true, label: '读数窗' };
        polarimeterGroup.add(readWindow);

        // 读数窗边框
        var rwFrameGeom = new THREE.BoxGeometry(0.65, 0.35, 0.03);
        var rwFrameMat = new THREE.MeshPhongMaterial({ color: 0x444455, shininess: 50 });
        var rwFrame = new THREE.Mesh(rwFrameGeom, rwFrameMat);
        rwFrame.position.set(0, 1.9, 1.53);
        polarimeterGroup.add(rwFrame);

        // 钠光灯指示区（顶部）
        var lampIndicatorGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
        var lampOffMat = new THREE.MeshBasicMaterial({ color: 0x331100 });
        var lampIndicator = new THREE.Mesh(lampIndicatorGeom, lampOffMat);
        lampIndicator.position.set(0, 2.62, 0.5);
        lampIndicator.name = 'lamp-indicator';
        polarimeterGroup.add(lampIndicator);

        // 品牌标签
        var brandCanvas = document.createElement('canvas');
        brandCanvas.width = 128;
        brandCanvas.height = 40;
        var bCtx = brandCanvas.getContext('2d');
        bCtx.fillStyle = '#1a1a22';
        bCtx.fillRect(0, 0, 128, 40);
        bCtx.fillStyle = '#00F3FF';
        bCtx.font = 'bold 16px Consolas, monospace';
        bCtx.textAlign = 'center';
        bCtx.fillText('WXG-4', 64, 26);
        var brandTex = new THREE.CanvasTexture(brandCanvas);
        var brandMat = new THREE.MeshBasicMaterial({ map: brandTex, transparent: true });
        var brandPlane = new THREE.PlaneGeometry(0.6, 0.2);
        var brandMesh = new THREE.Mesh(brandPlane, brandMat);
        brandMesh.position.set(0, 2.56, 1.53);
        polarimeterGroup.add(brandMesh);

        polarimeterGroup.position.set(4, 0.3, 0);
        scene.add(polarimeterGroup);
        addHitboxTo(polarimeterGroup, { w:2.5, h:1.8, d:2.0 });
        labObjects['polarimeter'] = polarimeterGroup;

        // --- 恒温水浴槽（旋光仪前方偏左） ---
        var bathGroup = createWaterBath();
        bathGroup.position.set(2.5, 0.3, -2);
        bathGroup.userData = { clickable: true, label: '\u6c34\u6d74\u69fd' };
        scene.add(bathGroup);
        addHitboxTo(bathGroup, { w:1.6, h:0.7, d:1.0 });
        labObjects['water-bath'] = bathGroup;
    }

    function createGridHelper() {
        // 初始不创建网格，由 toggleGrid 控制
    }

    // ============================================================
    // 第四部分：悬浮字幕提示系统
    // ============================================================

    tooltipOverlay = document.getElementById('tooltip-overlay');

    function showSpatialTooltip(mesh, text, type) {
        // type: undefined | 'warning' | 'error' | 'success'
        removeTooltipForMesh(mesh); // 先移除旧的同名字幕

        var div = document.createElement('div');
        div.className = 'spatial-tooltip' + (type ? ' ' + type : '');
        div.textContent = text;
        div.dataset.meshName = mesh.name || '';

        // 【模块二2.2】添加引导线子元素
        var guideLine = document.createElement('div');
        guideLine.className = 'tooltip-guide-line';
        div.appendChild(guideLine);

        tooltipOverlay.appendChild(div);
        activeTooltips.push({ element: div, meshRef: mesh });
    }

    function updateTooltipPositions() {
        if (!camera || !activeTooltips.length) return;

        activeTooltips.forEach(function(item) {
            if (!item.meshRef || !item.element) return;

            var pos = new THREE.Vector3();
            item.meshRef.getWorldPosition(pos);
            pos.y += 0.8; // 在器材上方

            // 投影到屏幕坐标
            pos.project(camera);

            var x = (pos.x * 0.5 + 0.5) * tooltipOverlay.clientWidth;
            var y = (-pos.y * 0.5 + 0.5) * tooltipOverlay.clientHeight;

            // 检查是否在视锥内（z在-1到1之间）
            if (pos.z < 1 && pos.z > -1) {
                item.element.style.left = x + 'px';
                item.element.style.top = y + 'px';
                item.element.style.display = 'block';
            } else {
                item.element.style.display = 'none';
            }
        });
    }

    function removeTooltipForMesh(mesh) {
        activeTooltips = activeTooltips.filter(function(item) {
            if (item.meshRef === mesh || (mesh.name && item.meshRef && item.meshRef.name === mesh.name)) {
                if (item.element && item.element.parentNode) {
                    item.element.parentNode.removeChild(item.element);
                }
                return false;
            }
            return true;
        });
    }

    function clearAllTooltips() {
        activeTooltips.forEach(function(item) {
            if (item.element && item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }
        });
        activeTooltips = [];
    }

    // 更新空间字幕内容（根据当前状态）
    function updateSpatialTooltips() {
        clearAllTooltips();

        switch(currentState) {
            case STATE.WEIGHING:
                if (labObjects['sugar-bottle']) {
                    showSpatialTooltip(labObjects['sugar-bottle'], '\u2460 \u70b9\u51fb\u6253\u5f00\u8bd5\u5242\u74f6\u76d6');
                }
                break;
            case STATE.DISSOLVING:
                if (labObjects['beaker']) {
                    showSpatialTooltip(labObjects['beaker'], '\u62d6\u62fd\u73bb\u7483\u68cd\u64e6\u65cb\u6405\u62cc\u6eb6\u89e3');
                }
                break;
            case STATE.VOLUMETRIC:
                if (labObjects['volumetric-flask']) {
                    showSpatialTooltip(labObjects['volumetric-flask'], '\u503e\u5012\u6db2\u4f53\u81f3\u523b\u5ea6\u7ebf');
                    if (labData.flaskVolume >= 95) {
                        showSpatialTooltip(labObjects['dropper'], '\u26a0\u63a5\u8fd1\u523b\u5ea6\u7ebf\uff01\u5207\u6362\u6ef4\u7ba1\u5fae\u8c03', 'warning');
                    }
                }
                break;
            case STATE.FILLING_TUBE:
                if (labObjects['polarimeter-tube']) {
                    showSpatialTooltip(labObjects['polarimeter-tube'], '\u70b9\u51fb\u65cb\u5149\u7ba1\u6ce8\u5165\u6db2\u4f53');
                }
                break;
            case STATE.PLACING:
                if (!labData.tubeCleaned && labObjects['lens-paper']) {
                    showSpatialTooltip(labObjects['lens-paper'], '\u62d6\u62fd\u64e6\u955c\u7eb8\u6e05\u6d01\u900f\u5149\u9762');
                }
                break;
            case STATE.MEASURING:
                // 测量阶段不需要空间字幕，靠UI面板引导
                break;
        }
    }

    // ============================================================
    // 第五部分：各步骤交互逻辑
    // ============================================================

    // ----- 步骤1：称量 -----

    function handleWeighingInteraction(clickedObject) {
        var name = clickedObject.name || '';
        // 兼容：同时检查对象名、父级名、label（因为射线可能直接命中子Mesh）
        var label = clickedObject.userData ? clickedObject.userData.label : '';
        var parentName = clickedObject.parent ? clickedObject.parent.name : '';
        var isSugarBottle = (name === 'sugar-bottle' || name === 'sugar-body' || name === 'sugar-cap'
            || parentName === 'sugar-bottle' || label === '蔗糖\u8bd5\u5242\u74f6');

        if (isSugarBottle) {
            // 打开试剂瓶 → 药匙出现
            showSpatialTooltip(clickedObject, '\u74f6\u76d6\u5df2\u6253\u5f00 \u2192 \u8bf7\u70b9\u51fb\u836f\u5319\u53d6蔗糖', 'success');
            labObjects['spatula'].visible = true;
            // 给药匙添加发光效果提示可点击
            highlightObject(labObjects['spatula'], 0x00F3FF);
            showSpatialTooltip(labObjects['spatula'], '\u27a4\ufe0f \u70b9\u51fb\u836f\u5319\u53d6蔗糖\uff08\u6216\u70b9\u53f3\u4fa7\u6309\u94ae\uff09');
            updateHint('\u836f\u5319\u5df2\u51fa\u73b0\uff01\u8bf7\u70b9\u51fb\u836f\u5319\u6216\u53f3\u4fa7\u3010+\u53d6蔗糖\u3011\u6309\u94ae');
            // 刷新控制面板显示取蔗糖按钮
            updateControlPanel();
        }
        else if (name === 'spatula' || name === 'spatula-hit' ||
                 (clickedObject.parent && (clickedObject.parent.name === 'spatula' || clickedObject.parent.name === 'spatula-hit'))) {
            // 点击药匙（或其热区）→ 加蔗糖
            addSugarToBeaker();
        }
        else if (name === 'beaker' || name === 'beaker-body' || parentName === 'beaker') {
            // 点击烧杯（或其瓶身Mesh）也可以触发加糖（如果药匙已激活）
            if (labObjects['spatula'] && labObjects['spatula'].visible) {
                addSugarToBeaker();
            }
        }
    }

    // 高亮对象（脉冲发光效果）
    function highlightObject(obj, color) {
        if (!obj) return;
        obj.traverse(function(child) {
            if (child.isMesh && child.material) {
                child.userData._originalEmissive = child.material.emissive ? child.material.emissive.getHex() : 0;
                if (child.material.emissive) {
                    child.material.emissive.setHex(color);
                    child.material.emissiveIntensity = 0.4;
                }
            }
        });
        // 3秒后取消高亮
        setTimeout(function() {
            obj.traverse(function(child) {
                if (child.isMesh && child.material && child.material.emissive &&
                    child.userData._originalEmissive !== undefined) {
                    child.material.emissive.setHex(child.userData._originalEmissive);
                }
            });
        }, 3000);
    }

    // 高亮对象安全版（不会因材质类型不同而崩溃）
    function highlightObjectSafe(obj, color) {
        if (!obj) return;
        try {
            obj.traverse(function(child) {
                if (child.isMesh && child.material) {
                    // 只对支持emissive的材质设置发光
                    if (child.material.emissive !== undefined &&
                        child.material.emissive !== null &&
                        typeof child.material.emissive.setHex === 'function') {
                        child.userData._originalEmissive = child.material.emissive.getHex();
                        child.material.emissive.setHex(color);
                        if (child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity = 0.4;
                        }
                    } else {
                        // MeshBasicMaterial等不支持emissive：用color变亮代替
                        if (child.material.color && typeof child.material.color.setHex === 'function') {
                            child.userData._originalColor = child.material.color.getHex();
                            // 混合目标色与原色
                            child.material.color.lerp(new THREE.Color(color), 0.4);
                        }
                    }
                }
            });
            setTimeout(function() {
                try {
                    obj.traverse(function(child) {
                        if (!child.isMesh || !child.material) return;
                        if (child.userData._originalEmissive !== undefined && child.material.emissive) {
                            child.material.emissive.setHex(child.userData._originalEmissive);
                        }
                        if (child.userData._originalColor !== undefined && child.material.color) {
                            child.material.color.setHex(child.userData._originalColor);
                        }
                    });
                } catch(e2) { /* 静默 */ }
            }, 3000);
        } catch(e) {
            console.warn('[3D Lab] highlightObjectSafe \u8b66\u544a:', e.message);
        }
    }

    function addSugarToBeaker() {
        var increment = 1.0 + Math.random() * 1.5; // 1.0 ~ 2.5g
        labData.sugarMass += increment;
        labData.sugarMass = Math.round(labData.sugarMass * 100) / 100;

        // 更新天平显示
        updateBalanceDisplay(labObjects['balance'], labData.sugarMass);

        // 更新右侧面板数据显示
        updateDataDisplay('\u5df2\u79f0\u91cf蔗糖', labData.sugarMass.toFixed(2) + ' g');

        // 【模块一关键】每次取蔗糖后必须刷新控制面板
        updateControlPanel();

        // 更新提示
        var diff = Math.abs(labData.sugarMass - labData.targetMass);
        console.log('[3D Lab] \u53d6蔗糖: +' + increment.toFixed(2) + 'g, \u603b\u8ba1=' + labData.sugarMass.toFixed(2) + 'g, \u76ee\u6807=' + labData.targetMass + 'g, \u5dee\u503c=' + diff.toFixed(2) + 'g');

        if (diff < 0.5) {
            // 称量完成！矫正到精确目标值
            labData.sugarMass = labData.targetMass;
            updateBalanceDisplay(labObjects['balance'], labData.sugarMass);
            updateHint('\u2713 \u79f0\u91cf\u5b8c\u6210\uff01\u8d28\u91cf: ' + labData.sugarMass.toFixed(2) + 'g');
            showSuccessBubble(
                '\u2713 \u5b8c\u7f8e\u79f0\u91cf\uff01\n' +
                '蔗糖\u8d28\u91cf: ' + labData.sugarMass.toFixed(2) + ' g\n\n' +
                '\u2192 \u4e0b\u4e00\u6b65: \u70e7\u676f\u52a0\u6c34\u6eb6\u89e3'
            );

            // 延迟进入溶解阶段（加try-catch保护）
            setTimeout(function() {
                try {
                    console.log('[3D Lab] ===== \u5f00\u59cb\u8fc7\u6e21\u5230\u6eb6\u89e3\u9636\u6bb5 =====');
                    transitionTo(STATE.DISSOLVING);

                    if (labObjects['glass-rod']) {
                        labObjects['glass-rod'].visible = true;
                        highlightObjectSafe(labObjects['glass-rod'], 0x00FF87);
                    }
                    if (labObjects['wash-bottle']) {
                        highlightObjectSafe(labObjects['wash-bottle'], 0x70C1FF);
                    }
                    if (labObjects['beaker']) {
                        highlightObjectSafe(labObjects['beaker'], 0xFFDF00);
                    }

                    clearAllTooltips();
                    if (labObjects['wash-bottle']) {
                        showSpatialTooltip(labObjects['wash-bottle'], '\uD83D\uDCA7 \u70b9\u51fb\u84b8\u998f\u6c34\u6d17\u74f6\u52a0\u6c34', 'success');
                    }
                    if (labObjects['beaker']) {
                        showSpatialTooltip(labObjects['beaker'], '\uD83D\uDCA7 \u70b9\u51fb\u73bb\u7483\u68d2\u6405\u62dd\u6eb6\u89e3', 'success');
                    }
                    // 【关键】刷新面板确保状态同步
                    updateControlPanel();
                    console.log('[3D Lab] ===== \u6eb6\u89e3\u9636\u6bb5\u8fc7\u6e21\u5b8c\u6210 =====');
                } catch(e) {
                    console.error('[3D Lab] \u8fc7\u6e21\u5931\u8d25:', e.message, e.stack);
                    showErrorBubble('\u72b6\u6001\u5207\u6362\u51fa\u9519\uff0c\u8bf7\u5237\u65b0\u9875\u9762');
                }
            }, 1500);
        } else if (labData.sugarMass >= labData.targetMass) {
            updateHint('\u26a0 \u8d85\u8fc7\u76ee\u6807\u8d28\u91cf\uff01\u5f53\u524d: ' + labData.sugarMass.toFixed(2) + 'g\uff0c\u76ee\u6807: ' + labData.targetMass + 'g');
        } else {
            updateHint('\u5df2\u52a0\u5165 ' + increment.toFixed(1) + 'g\uff0c\u5f53\u524d\u603b\u91cf: ' + labData.sugarMass.toFixed(2) + 'g / ' + labData.targetMass + 'g');
        }
    }

    // ----- 步骤2：溶解 -----

    function handleDissolvingInteraction(clickedObject) {
        var name = clickedObject.name || '';
        var parentName = clickedObject.parent ? clickedObject.parent.name : '';

        // 洗瓶：兼容子Mesh命中（body/nezzle等无clickable时向上遍历到Group）
        if (name === 'wash-bottle' || name.indexOf('wash') >= 0
            || parentName === 'wash-bottle') {
            // 加水
            labData.waterVolume += 40;
            if (labData.waterVolume > 60) labData.waterVolume = 60;
            updateHint('\u5df2\u52a0\u6c34 ' + labData.waterVolume + 'mL\uff0c\u8bf7\u62d6\u62fd\u73bb\u7483\u68d2\u6405\u62dd');
            showSpatialTooltip(labObjects['glass-rod'], '\u2192 \u70b9\u51fb\u6216\u62d6\u62fd\u6405\u62dd');

            // 烧杯中显示液体
            showLiquidInBeaker(labData.waterVolume / 60);
        }
        else if (name === 'glass-rod' || parentName === 'glass-rod') {
            // 搅拌溶解
            startStirringAnimation();
        }
    }

    // 【模块四4.3】烧杯液体显示增强（带动画）
    var beakerLiquidAnimId = null;

    function showLiquidInBeaker(ratio) {
        if (!labObjects['beaker']) return;
        var liquidMesh = null;
        labObjects['beaker'].traverse(function(child) {
            if (child.name === 'beaker-liquid') liquidMesh = child;
        });
        if (!liquidMesh) return;

        ratio = Math.max(0, Math.min(1, ratio));
        liquidMesh.visible = ratio > 0.01;

        if (!liquidMesh.visible) return;

        var targetHeight = Math.max(0.01, ratio) * 0.75;
        var startScale = liquidMesh.scale.y || 0.01;

        // 取消之前的动画
        if (beakerLiquidAnimId) cancelAnimationFrame(beakerLiquidAnimId);
        var startTime = performance.now();

        function animStep() {
            var t = Math.min((performance.now() - startTime) / 350, 1);
            var ease = 1 - Math.pow(1 - t, 2); // easeOutQuad

            liquidMesh.scale.y = startScale + (targetHeight - startScale) * ease;
            liquidMesh.position.y = (liquidMesh.scale.y * 0.72) / 2;

            if (t < 1) {
                beakerLiquidAnimId = requestAnimationFrame(animStep);
            } else {
                beakerLiquidAnimId = null;
            }
        }
        animStep();
    }

    function startStirringAnimation() {
        if (labData.waterVolume < 20) {
            showErrorBubble('\u274c \u6c34\u91cf\u4e0d\u8db3\uff01\u8bf7\u5148\u70b9\u51fb\u84b8\u998f\u6c34\u6d17\u74f6\u52a0\u6c34');
            return;
        }

        updateHint('\u6b63\u5728\u6405\u62dd\u6eb6\u89e3\u4e2d...');

        // 搅拌动画（玻璃棒旋转）
        var rod = labObjects['glass-rod'];
        var stirCount = 0;
        var maxStirs = 5;

        function doStir() {
            if (stirCount >= maxStirs) {
                labData.dissolved = true;
                updateHint('\u2713 \u6eb6\u89e3\u5b8c\u6210\uff01蔗糖\u5b8c\u5168\u6eb6\u89e3\u4e8e\u6c34\u4e2d');
                showSuccessBubble('\u2713 \u6eb6\u89e3\u5b8c\u6210\uff01\u5de5\u5320\u7cbe\u795e +1');

                setTimeout(function() {
                    transitionTo(STATE.VOLUMETRIC);
                    showSpatialTooltip(labObjects['beaker'], '\u62d6\u62fd\u70e7\u676f\u503e\u5165\u5bb9\u91cf\u74f6');
                    showSpatialTooltip(labObjects['volumetric-flask'], '\u63a5\u6536\u6db2\u4f53');
                }, 1000);
                return;
            }

            // 简化的搅拌动画：旋转玻璃棒
            if (rod) {
                rod.rotation.z += Math.PI * 0.5;
            }
            stirCount++;
            setTimeout(doStir, 400);
        }

        doStir();
    }

    // ----- 步骤3：定容 -----

    function handleVolumetricInteraction(clickedObject) {
        var name = clickedObject.name || '';
        var parentName = clickedObject.parent ? clickedObject.parent.name : '';

        // 兼容：beaker / beaker-body 子Mesh → 触发倾倒
        if (name === 'beaker' || name === 'beaker-body' || parentName === 'beaker') {
            pourToFlask();
        }
        // 兼容：dropper / dropper-bulb 子Mesh → 触发滴管微调
        else if (name === 'dropper' || name === 'dropper-bulb'
                 || parentName === 'dropper') {
            addDropToFlask();
        }
        // 容量瓶被点击 → 引导用户去点烧杯
        else if (name === 'flask-body' || name === 'volumetric-flask'
                 || parentName === 'volumetric-flask') {
            showSpatialTooltip(clickedObject, '\u2192 \u8bf7\u70b9\u51fb\u70e7\u676c\u5c06\u6eb6\u6db2\u503e\u5012\u81f3\u5bb9\u91cf\u74f6', 'warning');
        }
    }

    // 【模块四4.1】倾倒液体（含水柱特效）
    function pourToFlask() {
        // 【修复】微调模式下禁止倾倒操作，引导用户使用滴管
        if (labData.flaskVolume >= 90) {
            showWarningBubble(
                '\u26a0\u5df2\u8fbe\u5fae\u8c03\u533a\u57df\uff01\n' +
                '\u8bf7\u5207\u6362\u4f7f\u7528\u6ef4\u7ba1\u8fdb\u884c\u7cbe\u786e\u5b9a\u5bb9'
            );
            return;
        }

        var pourAmount = 15 + Math.random() * 10; // 每次 15-25mL
        labData.flaskVolume += pourAmount;

        if (labData.flaskVolume >= VOLUMETRIC_VOLUME) {
            labData.flaskVolume = VOLUMETRIC_VOLUME;
            showWarningBubble('\u26a0\u8d85\u8fc7\u523b\u5ea6\u7ebf\uff01\u5b9e\u9a8c\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u5b9a\u5bb9');
            // 重置重来
            setTimeout(resetVolumetric, 2000);
            return;
        }

        // 【模块四4.1】创建倾倒水柱视觉效果
        createPouringStream(labObjects['beaker'], labObjects['volumetric-flask'], pourAmount);

        // 更新容量瓶液位（带动画）
        updateFlaskLiquidLevel(labData.flaskVolume / VOLUMETRIC_VOLUME);
        updateDataDisplay('\u5f53\u524d\u5bb9\u91cf', labData.flaskVolume.toFixed(1) + ' / ' + VOLUMETRIC_VOLUME + ' mL');

        if (labData.flaskVolume >= 95) {
            // 进入微调模式
            labObjects['dropper'].visible = true;
            showSpatialTooltip(labObjects['dropper'], '\u26a0\u5207\u6362\u6ef4\u7ba1\u5fae\u8c03\uff01\u6bcf\u70b9\u4e00\u6ef4', 'warning');
            updateControlPanel(); // 刷新右侧面板按钮
        }

        updateHint('\u503e\u5012\u4e2d... \u5f53\u524d: ' + labData.flaskVolume.toFixed(1) + 'mL / ' + VOLUMETRIC_VOLUME + 'mL');
    }

    function addDropToFlask() {
        // 【修复】使用固定小体积（原随机0.3~0.7mL过大，导致无法精确控制）
        var dropSize = 0.05; // 固定0.05mL/滴
        labData.flaskVolume += dropSize;
        labData.flaskVolume = Math.round(labData.flaskVolume * 100) / 100;

        // 【修复】统一容差标准为 PERFECT_TOLERANCE (±0.02mL)，与键盘操作保持一致
        if (Math.abs(labData.flaskVolume - VOLUMETRIC_VOLUME) <= PERFECT_TOLERANCE) {
            // 成功定容！
            labData.flaskVolume = VOLUMETRIC_VOLUME;
            labData.currentConcentration = labData.sugarMass / VOLUMETRIC_VOLUME;
            labData.actualRotationAngle = SPECIFIC_ROTATION * labData.currentConcentration * (TUBE_LENGTH / 100);

            updateFlaskLiquidLevel(1.0);
            updateHint('\u2713 \u5b8c\u7f8e\u5b9a\u5bb9\uff01\u51f9\u6db2\u9762\u4e0e\u523b\u5ea6\u7ebf\u91cd\u5408');
            showSuccessBubble(
                '\u2713 \u5b8c\u7f8e\u5b9a\u5bb9\uff01\u51f9\u6db2\u9762\u4e0e\u523b\u5ea6\u7ebf\u91cd\u5408\n' +
                '\u8bef\u5dee: \u00b1' + PERFECT_TOLERANCE + ' mL\n' +
                '\u6d53\u5ea6: ' + labData.currentConcentration.toFixed(4) + ' g/mL'
            );

            setTimeout(function() {
                transitionTo(STATE.FILLING_TUBE);
                labObjects['polarimeter-tube'].visible = true;
                showSpatialTooltip(labObjects['polarimeter-tube'], '\u70b9\u51fb\u65cb\u5149\u7ba1\u704c\u6ce8\u6db2\u4f53');
            }, 1200);
        } else if (labData.flaskVolume > VOLUMETRIC_VOLUME) {
            // 超了！
            showErrorBubble('\u274c \u8d85\u51fa\u523b\u5ea6\u7ebf\uff01\u5b9a\u5bb9\u5931\u8d25\uff0c\u9700\u91cd\u65b0\u914d\u5236');
            setTimeout(resetVolumetric, 2000);
        } else {
            updateFlaskLiquidLevel(labData.flaskVolume / VOLUMETRIC_VOLUME);
            updateHint('\u6ef4\u5165... ' + labData.flaskVolume.toFixed(2) + 'mL / ' + VOLUMETRIC_VOLUME + 'mL');
        }
    }

    // 【模块四4.1】水柱生成函数（倾倒视觉效果）
    function createPouringStream(sourceObj, targetObj, amount) {
        if (!sourceObj || !targetObj || !scene) return;

        var streamGroup = new THREE.Group();
        streamGroup.name = 'pouring-stream';

        // 水柱主体：倾斜的圆柱/锥形
        var srcPos = new THREE.Vector3();
        sourceObj.getWorldPosition(srcPos);
        srcPos.y += 0.8; // 从烧杯口出发

        var tgtPos = new THREE.Vector3();
        targetObj.getWorldPosition(tgtPos);
        tgtPos.y += 1.1; // 到容量瓶口

        var direction = new THREE.Vector3().subVectors(tgtPos, srcPos);
        var length = direction.length();

        // 水柱几何体（锥形：上粗下细模拟重力加速）
        var streamGeom = new THREE.CylinderGeometry(0.04, 0.02, length, 8);
        var streamMat = new THREE.MeshPhongMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.6,
            emissive: 0x224466,
            emissiveIntensity: 0.3
        });
        var stream = new THREE.Mesh(streamGeom, streamMat);

        // 定位：中点 + 朝向目标方向
        stream.position.copy(srcPos).add(tgtPos).multiplyScalar(0.5);
        stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());

        streamGroup.add(stream);
        scene.add(streamGroup);

        // 液滴粒子（水柱末端的几个小球）
        for (var i = 0; i < 3; i++) {
            var dropGeom = new THREE.SphereGeometry(0.015 + Math.random()*0.01, 6, 6);
            var dropMat = new THREE.MeshPhongMaterial({
                color: 0x88ccff, transparent: true, opacity: 0.7
            });
            var drop = new THREE.Mesh(dropGeom, dropMat);
            drop.position.copy(tgtPos).add(
                new THREE.Vector3((Math.random()-0.5)*0.05, -Math.random()*0.1, (Math.random()-0.5)*0.05)
            );
            streamGroup.add(drop);
        }

        // 800ms后移除水柱
        setTimeout(function() {
            if (streamGroup && streamGroup.parent) {
                scene.remove(streamGroup);
            }
        }, 800);
    }

    // 【模块四4.2】容量瓶液位上升动画
    var flaskLiquidAnimId = null;

    function updateFlaskLiquidLevel(targetRatio) {
        if (!labObjects['volumetric-flask']) return;
        var liquidMesh = null;
        labObjects['volumetric-flask'].traverse(function(child) {
            if (child.name === 'flask-liquid') liquidMesh = child;
        });
        if (!liquidMesh) return;

        liquidMesh.visible = true;
        var startScale = liquidMesh.scale.y || 0.01;
        var targetScale = Math.max(0.01, Math.min(1, targetRatio)) * 0.78; // 最大高度比例

        // 取消之前的动画
        if (flaskLiquidAnimId) cancelAnimationFrame(flaskLiquidAnimId);

        var startTime = performance.now();
        var duration = 400; // 400ms缓动

        function animStep() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            var ease = 1 - Math.pow(1 - t, 2); // easeOutQuad

            liquidMesh.scale.y = startScale + (targetScale - startScale) * ease;
            liquidMesh.position.y = (liquidMesh.scale.y * 0.01) / 2;

            if (t < 1) {
                flaskLiquidAnimId = requestAnimationFrame(animStep);
            } else {
                flaskLiquidAnimId = null;
            }
        }
        animStep();
    }

    function resetVolumetric() {
        labData.flaskVolume = 0;
        updateFlaskLiquidLevel(0);
        if (labObjects['dropper']) labObjects['dropper'].visible = false;

        // 【修复】完整重置：隐藏虚拟键盘、清除数据显示、更新控制面板
        _setKbdMode('GLOBAL'); // 退出微操模式，隐藏虚拟键盘
        updateDataDisplay('\u5f53\u524d\u5bb9\u91cf', '0 / ' + VOLUMETRIC_VOLUME + ' mL');
        updateControlPanel(); // 刷新面板（隐藏滴管按钮）
        updateHint('\u5df2\u91cd\u7f6e\uff0c\u8bf7\u91cd\u65b0\u503e\u5012');
    }

    // ----- 步骤4：灌管（含气泡检测）-----

    function handleFillingTubeInteraction(clickedObject) {
        var name = clickedObject.name || '';
        var parentName = clickedObject.parent ? clickedObject.parent.name : '';

        if (name === 'polarimeter-tube' || name.indexOf('tube') >= 0
            || parentName === 'polarimeter-tube') {
            fillTube();
        }
    }

    function fillTube() {
        // 随机决定是否有气泡（操作不当概率 30%）
        var bubbleChance = Math.random();
        labData.hasBubbles = bubbleChance < 0.3;
        labData.tubeFilled = true;

        // 旋光管内显示液体
        showLiquidInTube(true);

        if (labData.hasBubbles) {
            // 显示气泡
            showBubbleInTube();
            showErrorBubble(
                '\u274c \u68c0\u6d4b\u5230\u7ba1\u5185\u5b58\u5728\u6e38\u52a8\u6c14\u6ce1\uff01\n' +
                '\u6c14\u6ce1\u4f1a\u4e25\u91cd\u6298\u5c04\u5149\u7ebf\uff0c\u8bf7\u5012\u6389\u91cd\u65b0\u704c\u6ce8\u3002'
            );
            // 提供重新灌注选项
            updateControlPanel(); // 显示"重新灌注"按钮
        } else {
            showSuccessBubble('\u2713 \u704c\u6ce8\u5b8c\u6210\uff01\u7ba1\u5185\u65e0\u6c14\u6ce1');

            setTimeout(function() {
                transitionTo(STATE.PLACING);
                showSpatialTooltip(labObjects['lens-paper'], '\u9996\u5148\u7528\u64e6\u955c\u7eb8\u6e05\u6d01\u65cb\u5149\u7ba1\u4e24\u7aef');
            }, 1000);
        }
    }

    function showLiquidInTube(show) {
        if (!labObjects['polarimeter-tube']) return;
        var liquid = labObjects['polarimeter-tube'].getObjectByName('tube-liquid');
        if (liquid) liquid.visible = show;
    }

    function showBubbleInTube() {
        if (!labObjects['polarimeter-tube']) return;
        var bubble = labObjects['polarimeter-tube'].getObjectByName('tube-bubble');
        if (bubble) {
            bubble.visible = true;
            // 气泡浮动动画
            animateBubble(bubble);
        }
    }

    function hideBubbleInTube() {
        if (!labObjects['polarimeter-tube']) return;
        var bubble = labObjects['polarimeter-tube'].getObjectByName('tube-bubble');
        if (bubble) bubble.visible = false;
    }

    function animateBubble(bubble) {
        if (!bubble || !bubble.visible) return;
        var time = Date.now() * 0.002;
        bubble.position.x = Math.sin(time) * 0.04;
        bubble.position.y = 1.5 + Math.sin(time * 1.3) * 0.3;
        bubble.position.z = Math.cos(time * 0.7) * 0.06;
        requestAnimationFrame(function() { animateBubble(bubble); });
    }

    function refillTube() {
        labData.tubeFilled = false;
        labData.hasBubbles = false;
        showLiquidInTube(false);
        hideBubbleInTube();
        fillTube(); // 重新尝试
    }

    // ----- 步骤5：擦拭与放置 -----

    function handlePlacingInteraction(clickedObject) {
        var name = clickedObject.name || '';
        var parentName = clickedObject.parent ? clickedObject.parent.name : '';

        if (name === 'lens-paper' || name === 'paper-body' || name.indexOf('paper') >= 0
            || parentName === 'lens-paper') {
            // 擦拭旋光管
            labData.tubeCleaned = true;
            showSuccessBubble('\u2713 \u64e6\u62ed\u5b8c\u6210\uff01\u900f\u5149\u9762\u5e72\u51c0');
            removeTooltipForMesh(labObjects['lens-paper']);

            // 引导开电源
            var polarimeter = labObjects['polarimeter'];
            if (polarimeter) {
                var psw = polarimeter.getObjectByName('power-switch');
                showSpatialTooltip(
                    psw || polarimeter,
                    '\u2192 \u70b9\u51fb\u7535\u6e90\u5f00\u5173\u542f\u52a8\u4eea\u5668'
                );
            }
            updateControlPanel();
        }
        else if (name === 'power-switch') {
            turnOnInstrument();
        }
    }

    function turnOnInstrument() {
        if (labData.instrumentOn) return;

        labData.instrumentOn = true;

        // 更新开关外观
        var polarimeter = labObjects['polarimeter'];
        if (polarimeter) {
            var sw = polarimeter.getObjectByName('power-switch');
            if (sw) sw.material = new THREE.MeshPhongMaterial({ color: 0x226622, shininess: 40 });

            var led = polarimeter.getObjectByName('power-led');
            if (led) led.material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

            var lampInd = polarimeter.getObjectByName('lamp-indicator');
            if (lampInd) lampInd.material = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
        }

        // 钠光灯亮起
        var lamp = scene.getObjectByName('sodium-lamp');
        if (lamp) lamp.intensity = 1.5;

        updateHint('\u94a0\u706f\u5df2\u5f00\u542f\uff0c\u6b63\u5728\u9884\u70ed...');
        showSpatialTooltip(labObjects['polarimeter'], '\u9884\u70ed\u4e2d... \u7b49\u5f85\u94a0\u706f\u7a33\u5b9a (589.3nm)');

        // 5秒预热倒计时
        var countdown = 5;
        var countdownInterval = setInterval(function() {
            countdown--;
            updateHint('\u9884\u70ed\u4e2d... ' + countdown + 's');

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                labData.preheated = true;
                updateHint('\u2713 \u9884\u70ed\u5b8c\u6210\uff01\u94a0\u706f\u6ce2\u957F\u7a33\u5b9a 589.3nm');
                showSuccessBubble('\u2713 \u9884\u70ed\u5b8c\u6210\uff01\u4eea\u5668\u53ef\u4ee5\u6b63\u5e38\u5de5\u4f5c');

                clearAllTooltips();
                // 引导放置旋光管
                showSpatialTooltip(labObjects['polarimeter-tube'], '\u62d6\u62fd\u65cb\u5149\u7ba1\u653e\u5165\u6697\u7bb1\u5361\u69fd');
                updateControlPanel();
            }
        }, 1000);
    }

    function placeTubeInInstrument() {
        if (!labData.tubeCleaned || !labData.preheated) return;

        labData.tubePlaced = true;

        // 计算初始旋光角（使用完整物理公式）
        labData.currentConcentration = TARGET_CONCENTRATION; // 0.10 g/mL
        updateActualRotationAngle();

        // 旋光管移动到仪器内部（动画）
        var tube = labObjects['polarimeter-tube'];
        var targetPos = new THREE.Vector3(4, 1.2, 0);
        var startPos = tube.position.clone();
        var progress = 0;

        function animatePlacement() {
            progress += 0.03;
            if (progress >= 1) {
                tube.position.copy(targetPos);
                tube.visible = false; // 放入后隐藏（在仪器内部）

                transitionTo(STATE.MEASURING);
                updateHint('\u2713 \u65cb\u5149\u7ba1\u5df2\u653e\u5165\uff01\u8bf7\u70b9\u51fb\u3010\u76ee\u955c\u89c6\u89d2\u3011\u5f00\u59cb\u89c2\u6d4b');
                showSuccessBubble('\u2713 \u51c6\u5907\u5b8c\u6210\uff01\u8fdb\u5165\u6d4b\u91cf\u9636\u6bb5');

                // 高亮底部工具栏的目镜按钮
                highlightEyepieceButton();
                return;
            }

            // 缓动插值
            var ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            tube.position.lerpVectors(startPos, targetPos, ease);

            requestAnimationFrame(animatePlacement);
        }

        animatePlacement();
    }

    function highlightEyepieceButton() {
        var btn = document.getElementById('btn-eyepiece');
        if (btn) {
            btn.style.background = 'rgba(0,255,135,0.2)';
            btn.style.borderColor = 'rgba(0,255,135,0.6)';
            btn.style.boxShadow = '0 0 12px rgba(0,255,135,0.3)';
            setTimeout(function() {
                btn.style.background = '';
                btn.style.borderColor = 'rgba(0,255,135,0.2)';
                btn.style.boxShadow = '';
            }, 3000);
        }
    }

    // ============================================================
    // 第六部分：目镜观测（2D Canvas 三分视场）
    // ============================================================

    // 【模块三3.2】目镜观测（含电影式过渡）
    function openEyepiece() {
        if (!labData.tubePlaced && currentState !== STATE.MEASURING) {
            showErrorBubble('\u274c \u8bf7\u5148\u5c06\u65cb\u5149\u7ba1\u653e\u5165\u4eea\u5668\uff01');
            return;
        }

        // 电影式过渡：相机冲向目镜
        var eyepieceObj = labObjects['polarimeter'];
        var epPos = eyepieceObj ? eyepieceObj.position : new THREE.Vector3(5.5, 2, 0);

        // 第一步：相机快速推进到目镜位置
        animateCameraTo([5.2, 2, 0.5], [5.5, 2, 0], 500);

        // 第二步：600ms后弹出目镜模态框（带淡入动画）
        setTimeout(function() {
            var modal = document.getElementById('eyepiece-modal');
            if (modal) {
                modal.style.display = 'flex';
                modal.style.opacity = '0';
                modal.style.transition = 'opacity 0.3s ease';
                // 强制重绘
                requestAnimationFrame(function() {
                    modal.style.opacity = '1';
                });
            }
            initEyepieceCanvas();
            initDialTicks();           // 生成24条刻度线
            updateDialPointer(eyepieceAngle || 0); // 初始化指针
            _initGlobalKeyboardSystem(); // ★★★ 初始化全局键盘系统（含HUD）
            _setKbdMode('EYEPIECE');    // ★★★ 切换到目镜模式
            renderEyepieceField();
        }, 600);
    }

    function closeEyepiece() {
        var modal = document.getElementById('eyepiece-modal');
        if (modal) modal.style.display = 'none';
        _setKbdMode('GLOBAL'); // 退出目镜模式
        // 注意：不销毁全局键盘系统（可能还有其他模式需要）
    }

    // ============================================================
    //  目镜 2D 手轮盘交互系统
    // ============================================================

    var _dialDragging = false;
    var _dialStartAngle = 0;       // 拖拽开始时的角度
    var _dialStartValue = 0;       // 拖拽开始时的检偏角值
    var _dialCenterX = 0, _dialCenterY = 0;

    /**
     * 初始化手轮刻度线（24条，每15°一条）
     */
    function initDialTicks() {
        var container = document.getElementById('dial-ticks');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < 24; i++) {
            var tick = document.createElement('div');
            tick.className = 'eyepiece-dial-tick';
            // 每90°的主刻度加粗
            if (i % 6 === 0) {
                tick.style.height = '12px';
                tick.style.width = '2.5px';
                tick.style.background = 'rgba(224,230,237,0.5)';
            }
            tick.style.transform = 'rotate(' + (i * 15) + 'deg)';
            container.appendChild(tick);
        }
    }

    /**
     * 更新手轮指针角度（映射检偏角到指针旋转）
     */
    function updateDialPointer(angleDeg) {
        var pointer = document.getElementById('dial-pointer');
        if (!pointer) return;
        // 将检偏角（-180~180）映射到指针旋转（0~360）
        // 指针12点方向为0°（对应angle=0），顺时针旋转
        var rotation = angleDeg % 360;
        if (rotation < 0) rotation += 360;
        pointer.style.transform = 'translate(-50%, -100%) rotate(' + rotation + 'deg)';
    }

    /**
     * 开始拖拽手轮盘
     */
    window.startDialDrag = function(event) {
        event.preventDefault();
        var wheel = document.getElementById('eyepiece-dial-wheel');
        if (!wheel) return;

        var rect = wheel.getBoundingClientRect();
        _dialCenterX = rect.left + rect.width / 2;
        _dialCenterY = rect.top + rect.height / 2;

        // 计算鼠标相对于中心的角度
        var clientX = event.touches ? event.touches[0].clientX : event.clientX;
        var clientY = event.touches ? event.touches[0].clientY : event.clientY;
        _dialStartAngle = Math.atan2(clientY - _dialCenterY, clientX - _dialCenterX);
        _dialStartValue = eyepieceAngle || 0;

        _dialDragging = true;

        // 绑定全局移动/释放事件
        document.addEventListener('mousemove', _onDialMove);
        document.addEventListener('mouseup', _onDialUp);
        document.addEventListener('touchmove', _onDialMove, { passive: false });
        document.addEventListener('touchend', _onDialUp);

        console.log('[Dial] 开始拖拽, 初始角:', (_dialStartAngle * 180 / Math.PI).toFixed(1) + 'deg');
    };

    /** 拖拽中：计算角度差并更新检偏角 */
    function _onDialMove(event) {
        if (!_dialDragging) return;
        event.preventDefault();

        var clientX = event.touches ? event.touches[0].clientX : event.clientX;
        var clientY = event.touches ? event.touches[0].clientY : event.clientY;

        var currentAngle = Math.atan2(clientY - _dialCenterY, clientX - _dialCenterX);
        var deltaAngle = currentAngle - _dialStartAngle;

        // 将弧度差转换为角度值（灵敏度：1:1 映射，即拖拽1°=调整1°）
        var deltaDeg = deltaAngle * 180 / Math.PI;

        // 应用新角度
        var newValue = _dialStartValue + deltaDeg;
        eyepieceAngle = newValue;

        // 更新UI
        updateEyepieceDisplay();
        renderEyepieceField();
        updateDialPointer(newValue);
    }

    /** 拖拽结束 */
    function _onDialUp(event) {
        if (!_dialDragging) return;
        _dialDragging = false;

        document.removeEventListener('mousemove', _onDialMove);
        document.removeEventListener('mouseup', _onDialUp);
        document.removeEventListener('touchmove', _onDialMove);
        document.removeEventListener('touchend', _onDialUp);

        console.log('[Dial] 拖拽结束, 最终角:', (eyepieceAngle || 0).toFixed(2) + 'deg');
    }

    function _stopDialDrag() {
        _dialDragging = false;
        document.removeEventListener('mousemove', _onDialMove);
        document.removeEventListener('mouseup', _onDialUp);
        document.removeEventListener('touchmove', _onDialMove);
        document.removeEventListener('touchend', _onDialUp);
    }

    // ============================================================
    //  键盘操作系统 —— 四层架构（物理步长/双锁流控/HUD/鲁棒性）
    //
    //  物理精度对应真实仪器：
    //    目镜微调：Δθ = 0.05°(正常) / 0.01°(Shift+超微)
    //    滴管单滴：ΔV = 0.04 mL/滴（标准水滴体积）
    //    完美定容判定：±0.02 mL 容差
    // ============================================================

    // ========== 键盘物理常量 ==========
    var KBD_STEP_FINE      = 0.05;       // 微调步长（对应游标卡尺最小分度值）
    var KBD_STEP_ULTRA     = 0.01;       // 超微调步长（Shift组合键，科研级极精密）
    var KBD_STEP_COARSE    = 0.5;        // 粗调步长
    var DROP_VOLUME_ML     = 0.04;       // 单滴体积（标准水滴）
    var PERFECT_TOLERANCE  = 0.02;       // 完美定容容差（±0.02 mL）
    var KBD_THROTTLE_MS    = 50;         // 长按节流阀（50ms = 20次/秒）

    // ========== 三态分流状态机 ==========
    // 状态A: GLOBAL_VIEW   → OrbitControls全激活, 键盘静音
    // 状态B: MICRO_OP      → OrbitControls半锁定, 键盘控制器材
    // 状态C: EYEPIECE      → OrbitControls全锁定, 键盘高级模式
    var _kbdMode = 'GLOBAL';            // 当前键盘模式

    // ========== 节流与防呆变量 ==========
    var _kbdThrottleTimers = {};         // 按键节流计时器 {key: lastTimestamp}
    var _kbdActiveElementCheck = true;   // 输入框焦点检测开关

    /**
     * 全局统一键盘处理器（替代原来的目镜专用监听器）
     * 根据当前状态机自动分发到不同处理逻辑
     */
    function _initGlobalKeyboardSystem() {
        if (window._globalKbdHandler) return; // 防重复

        window._globalKbdHandler = function(event) {
            // ====== 层4：输入框焦点智能退位 ======
            // 如果用户正在输入框中打字，不拦截键盘事件
            if (_kbdActiveElementCheck) {
                var activeEl = document.activeElement;
                var tag = activeEl ? activeEl.tagName.toLowerCase() : '';
                if (tag === 'input' || tag === 'textarea' || activeEl.isContentEditable) {
                    return; // 将键盘控制权完整归还给文本输入
                }
            }

            // ====== 层3：浏览器默认行为拦截 ======
            // Focus Mode下阻止方向键滚动、空格翻页等
            if (_opState !== OP_IDLE || _kbdMode !== 'GLOBAL') {
                var isNavKey = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                    ' ','Space','PageUp','PageDown'].indexOf(event.key) >= 0;
                if (isNavKey) {
                    event.preventDefault();
                }
            }

            // ====== 层2：状态机分流 ======
            switch(_kbdMode) {
                case 'EYEPIECE':
                    _handleEyepieceKeyboard(event);
                    break;
                case 'MICRO_OP':
                    _handleMicroOpKeyboard(event);
                    break;
                // 'GLOBAL' 模式下键盘静音，不做任何处理
            }

            // ====== 同步更新虚拟键盘HUD ======
            _syncVirtualKeyboard(event.key);
        };

        document.addEventListener('keydown', window._globalKbdHandler);
        console.log('[Keyboard] 全局键盘系统已初始化');
    }

    function _removeGlobalKeyboardSystem() {
        if (window._globalKbdHandler) {
            document.removeEventListener('keydown', window._globalKbdHandler);
            window._globalKbdHandler = null;
        }
        _hideVirtualKeyboard();
    }

    // ========== 层1：物理步长 — 目镜观测模式 ==========

    /**
     * 目镜模式下键盘处理：
     *  ← / → : Δθ = 0.05° 微调
     *  Shift+← / Shift+→ : Δθ = 0.01° 超微调
     *  ↑ / ↓ : Δθ = 0.5° 粗调
     */
    function _handleEyepieceKeyboard(event) {
        var modal = document.getElementById('eyepiece-modal');
        if (!modal || modal.style.display === 'none') return;

        // ====== 节流防眩晕 ======
        var now = performance.now();
        var lastTime = _kbdThrottleTimers[event.key] || 0;
        if (now - lastTime < KBD_THROTTLE_MS) return; // 未到节流时间，跳过
        _kbdThrottleTimers[event.key] = now;

        var delta = 0;

        switch(event.key) {
            case 'ArrowLeft':
                delta = event.shiftKey ? -KBD_STEP_ULTRA : -KBD_STEP_FINE;
                break;
            case 'ArrowRight':
                delta = event.shiftKey ? KBD_STEP_ULTRA : KBD_STEP_FINE;
                break;
            case 'ArrowUp':
                delta = -KBD_STEP_COARSE;
                break;
            case 'ArrowDown':
                delta = KBD_STEP_COARSE;
                break;
            default:
                return; // 非方向键，直接返回
        }

        event.preventDefault();

        // 应用角度变化
        eyepieceAngle += delta;
        eyepieceAngle = Math.round(eyepieceAngle * 100) / 100; // 保留2位小数

        // 范围限制
        if (eyepieceAngle < -180) eyepieceAngle = -180;
        if (eyepieceAngle > 180) eyepieceAngle = 180;

        // ★★★ 像素级即时反馈：立即重绘三分视场 + 更新所有UI
        if (renderEyepieceField) renderEyepieceField();
        updateEyepieceDisplay();
        updateDialPointer(eyepieceAngle);

        // 显示操作反馈（仅在粗调时显示气泡提示，避免微调时频繁弹窗）
        if (Math.abs(delta) >= KBD_STEP_COARSE) {
            console.log('[Keyboard] 目镜粗调:', delta > 0 ? '+' : '', delta.toFixed(1), '° →', eyepieceAngle.toFixed(2), '°');
        } else {
            console.log('[Keyboard] 目镜' + (event.shiftKey ? '超微' : '微') + '调:',
                delta > 0 ? '+' : '', delta.toFixed(2), '° →', eyepieceAngle.toFixed(2), '°');
        }
    }

    // ========== 层1：物理步长 — 定容微操模式 ==========

    /**
     * 定容阶段键盘处理：
     *  ↓ 或 ArrowDown : 触发单滴滴落 (0.04 mL)
     */
    function _handleMicroOpKeyboard(event) {
        if (currentState !== STATE.VOLUMETRIC) return;
        // 只有在滴管可见时才响应
        if (labObjects['dropper'] && !labObjects['dropper'].visible) return;

        // ====== 节流 ======
        var now = performance.now();
        var lastTime = _kbdThrottleTimers['dropper'] || 0;
        if (now - lastTime < KBD_THROTTLE_MS) return;
        _kbdThrottleTimers['dropper'] = now;

        if (event.key === 'ArrowDown' || event.key === 'Down') {
            event.preventDefault();

            // 触发单滴滴落
            labData.flaskVolume += DROP_VOLUME_ML;
            labData.flaskVolume = Math.round(labData.flaskVolume * 100) / 100;

            var remaining = VOLUMETRIC_VOLUME - labData.flaskVolume;
            var dropsNeeded = Math.ceil(Math.max(0, remaining) / DROP_VOLUME_ML);

            // ====== 完美定容判定（±0.02 mL）=====
            if (Math.abs(labData.flaskVolume - VOLUMETRIC_VOLUME) <= PERFECT_TOLERANCE) {
                labData.flaskVolume = VOLUMETRIC_VOLUME;
                labData.currentConcentration = labData.sugarMass / VOLUMETRIC_VOLUME;
                labData.actualRotationAngle = SPECIFIC_ROTATION * labData.currentConcentration * (TUBE_LENGTH / 100);

                updateFlaskLiquidLevel(1.0);
                updateDataDisplay('\u5f53\u524d\u5bb9\u91cf', VOLUMETRIC_VOLUME.toFixed(2) + ' / ' + VOLUMETRIC_VOLUME + ' mL');
                showSuccessBubble(
                    '\u2713 \u5b8c\u7f8e\u5b9a\u5bb9\uff01\u51f9\u6db2\u9762\u4e0e\u523b\u5ea6\u7ebf\u91cd\u5408\n' +
                    '\u8bef\u5dee: \u00b1' + PERFECT_TOLERANCE + ' mL\n' +
                    '\u6d53\u5ea6: ' + labData.currentConcentration.toFixed(4) + ' g/mL'
                );

                // 切换到灌管阶段
                setTimeout(function() {
                    transitionTo(STATE.FILLING_TUBE);
                    labObjects['polarimeter-tube'].visible = true;
                    showSpatialTooltip(labObjects['polarimeter-tube'], '\u70b9\u51fb\u65cb\u5149\u7ba1\u704c\u6ce8\u6db2\u4f53');
                    _setKbdMode('GLOBAL'); // 退出微操模式
                    _hideVirtualKeyboard();
                }, 1200);
            }
            else if (labData.flaskVolume > VOLUMETRIC_VOLUME) {
                showErrorBubble('\u274c \u8d85\u51fa\u523b\u5ea6\u7ebf\uff01\u5b9a\u5bb9\u5931\u8d25');
                setTimeout(resetVolumetric, 2000);
            }
            else {
                updateFlaskLiquidLevel(labData.flaskVolume / VOLUMETRIC_VOLUME);
                updateDataDisplay('\u5f53\u524d\u5bb9\u91cf', labData.flaskVolume.toFixed(2) + ' / ' + VOLUMETRIC_VOLUME + ' mL');

                // 动态提示文案
                if (labData.flaskVolume >= VOLUMETRIC_VOLUME - 1) {
                    updateHint('\ud83d\udcea \u5fae\u8c03\u9636\u6bb5\uff1a\u5df2\u6ef4\u5165' +
                        labData.flaskVolume.toFixed(2) + 'mL\uff0c\u8fd8\u5dee\u7ea6 ' + dropsNeeded + ' \u6ef4');
                } else {
                    updateHint('\u952e\u76d8 [ \u2193 ] \u89e6\u53d1\u5355\u6ef4\u8fdb\u7ed9 (+0.04mL)');
                }
            }

            console.log('[Keyboard] 滴管单滴:', DROP_VOLUME_ML, 'mL → 总计:', labData.flaskVolume.toFixed(2), 'mL');
        }
    }

    // ========== 键盘模式切换 ==========

    function _setKbdMode(mode) {
        _kbdMode = mode;
        console.log('[Keyboard] 模式切换:', mode);

        // 根据模式显示/隐藏虚拟键盘HUD
        if (mode === 'EYEPIECE') {
            _showVirtualKeyboard('eyepiece');
        } else if (mode === 'MICRO_OP') {
            _showVirtualKeyboard('dropper');
        } else {
            _hideVirtualKeyboard();
        }
    }

    // ============================================================
    //  层3：拟物化虚拟键盘HUD引导系统
    //
    //  功能：
    //    - 浮动微型按键气泡（暗黑科技风）
    //    - 物理按键按下时，UI按键同步高亮发光 + 凹陷动效
    //    - 差异化动态文案（粗调/微调/定容阶段不同提示）
    // ============================================================

    var _vkContainer = null;       // 虚拟键盘容器DOM
    var _vkKeys = {};              // 虚拟按键元素缓存 {keyName: DOM}

    /**
     * 显示虚拟键盘HUD
     * @param {string} mode - 'eyepiece' 或 'dropper'
     */
    function _showVirtualKeyboard(mode) {
        _hideVirtualKeyboard(); // 先清除旧的

        var container = document.createElement('div');
        container.id = 'virtual-keyboard-hud';
        container.style.cssText =
            'position:fixed; z-index:9998;' +
            'pointer-events:none;' +  // 不阻挡鼠标事件穿透到3D场景
            'animation:vkSlideIn 0.4s ease-out forwards;';

        // 根据模式选择位置和内容
        if (mode === 'eyepiece') {
            // 目镜模式：右下角，显示 ← → ↑ ↓ 四个方向键
            container.style.right = '20px';
            container.style.bottom = '100px';

            container.innerHTML = _buildVKPanel(
                '\ud83d\udd0d \u89c2\u6d4b\u9636\u6bb5',
                [
                    { key: '', label: '\u2191', hint: '\u7c97\u8c03-0.5\u00b0' },
                    { key: '', label: '\u2190', hint: '\u5fae\u8c03-0.05\u00b0' },
                    { key: '', label: '\u2193', hint: '\u7c97\u8c03+0.5\u00b0' },
                    { key: '', label: '\u2192', hint: '\u5fae\u8c03+0.05\u00b0' }
                ],
                'Shift+\u2190\u2192 \u8d85\u5fae\u8c03\u00b10.01\u00b0',
                '#9D00FF' // 紫色主题（目镜观测）
            );
        } else if (mode === 'dropper') {
            // 定容模式：靠近滴管位置或底部中央
            container.style.left = '50%';
            container.style.bottom = '80px';
            container.style.transform = 'translateX(-50%)';

            var remaining = Math.max(0, VOLUMETRIC_VOLUME - labData.flaskVolume);
            var dropsNeeded = Math.ceil(remaining / DROP_VOLUME_ML);

            container.innerHTML = _buildVKPanel(
                '\ud83d\udcea \u5b9a\u5bb9\u5fae\u8c03\u9636\u6bb5',
                [
                    { key: '', label: '\u2193', hint: '+' + DROP_VOLUME_ML + 'mL/\u6ef4' }
                ],
                '\u8fd8\u5dee\u7ea6 ' + dropsNeeded + ' \u6ef4\uff08\u603b\u8ba1 ' + remaining.toFixed(2) + 'mL\uff09',
                '#FFDF00' // 黄色主题（定容操作）
            );
        }

        document.body.appendChild(container);
        _vkContainer = container;

        // 缓存所有虚拟按键引用
        _vkKeys = {};
        var btns = container.querySelectorAll('.vk-key');
        for (var i = 0; i < btns.length; i++) {
            _vkKeys[btns[i].dataset.key] = btns[i];
        }

        console.log('[VirtualKbd] 显示模式:', mode);
    }

    /**
     * 构建虚拟键盘面板HTML
     */
    function _buildVKPanel(title, keys, footerText, themeColor) {
        var keysHtml = '';
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            keysHtml += '<div class="vk-key" data-key="' + k.key + '" ' +
                'style="display:inline-flex; flex-direction:column; align-items:center; justify-content:center;' +
                'width:48px; height:48px; border-radius:10px;' +
                'background:rgba(20,28,45,0.92); border:1px solid rgba(' +
                _hexToRgb(themeColor) + ',0.35);' +
                'color:#e0e6ed; font-size:18px; font-weight:800;' +
                'font-family:\'Consolas\',\'Monaco\',monospace;' +
                'transition:all 0.12s ease-out;' +
                'box-shadow:0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);' +
                'cursor:pointer; position:relative;">' +
                '<span class="vk-label">' + k.label + '</span>' +
                '<span style="font-size:8px; color:rgba(224,230,237,0.4); margin-top:2px;">' + k.hint + '</span>' +
                '</div>';
        }

        return '<div style="padding:14px 18px; border-radius:16px;' +
            'background:linear-gradient(145deg, rgba(10,16,29,0.95), rgba(20,30,50,0.92));' +
            'border:1px solid rgba(' + _hexToRgb(themeColor) + ',0.25);' +
            'backdrop-filter:blur(20px); box-shadow:' +
            '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(' + _hexToRgb(themeColor) + ',0.08);">' +

            // 标题行
            '<div style="font-size:11px; font-weight:700; margin-bottom:10px;' +
            'color:' + themeColor + '; letter-spacing:1px; text-align:center;">' +
            title + '</div>' +

            // 按键网格
            '<div style="display:flex; gap:8px; justify-content:center; margin-bottom:8px;">' +
            keysHtml +
            '</div>' +

            // 底部提示
            '<div style="font-size:10px; color:rgba(224,230,237,0.45); text-align:center;">' +
            footerText + '</div>' +
            '</div>';
    }

    /** 颜色辅助：#RRGGBB → "R,G,B" */
    function _hexToRgb(hex) {
        if (!hex || hex.charAt(0) !== '#') return '157,0,255'; // 默认紫色
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return r + ',' + g + ',' + b;
    }

    /** 隐藏虚拟键盘 */
    function _hideVirtualKeyboard() {
        if (_vkContainer) {
            _vkContainer.remove();
            _vkContainer = null;
        }
        _vkKeys = {};
    }

    /**
     * 同步虚拟键盘按键状态（物理键按下时UI同步反馈）
     * @param {string} physicalKey - 浏览器event.key值
     */
    function _syncVirtualKeyboard(physicalKey) {
        if (!_vkContainer || !_vkKeys) return;

        // 映射物理键名到虚拟键名
        var vkKey = null;
        switch(physicalKey) {
            case 'ArrowUp': case 'ArrowDown':
            case 'ArrowLeft': case 'ArrowRight':
                vkKey = physicalKey;
                break;
            default:
                return;
        }

        var vkEl = _vkKeys[vkKey];
        if (!vkEl) return;

        // ★★★ 视觉通感：高亮发光 + 向下凹陷
        vkEl.style.background = 'rgba(' + (_kbdMode === 'EYEPIECE' ? '157,0,255' : '255,223,0') + ',0.35)';
        vkEl.style.borderColor = (_kbdMode === 'EYEPIECE' ? '#9D00FF' : '#FFDF00');
        vkEl.style.boxShadow =
            '0 0 16px rgba(' + (_kbdMode === 'EYEPIECE' ? '157,0,255' : '255,223,0') + ',0.5),' +
            'inset 0 3px 6px rgba(0,0,0,0.4)';
        vkEl.style.transform = 'translateY(2px) scale(0.95)';
        vkEl.style.color = (_kbdMode === 'EYEPIECE' ? '#C084FF' : '#FFE066');

        // 120ms后恢复原状（模拟真实按键回弹）
        setTimeout(function() {
            if (vkEl) {
                vkEl.style.background = 'rgba(20,28,45,0.92)';
                vkEl.style.borderColor = 'rgba(' + (_hexToRgb(_kbdMode === 'EYEPIECE' ? '#9D00FF' : '#FFDF00')) + ',0.35)';
                vkEl.style.boxShadow =
                    '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)';
                vkEl.style.transform = '';
                vkEl.style.color = '#e0e6ed';
            }
        }, 120);
    }

    function initEyepieceCanvas() {
        var canvas = document.getElementById('eyepiece-canvas');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var size = canvas.width; // 400

        // 直接在这里实现三分视场渲染
        renderEyepieceField = function() {
            var theta = eyepieceAngle;
            var delta = HALF_SHADE_ANGLE; // 4°

            ctx.clearRect(0, 0, size, size);

            // 圆形裁剪区域
            ctx.save();
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
            ctx.clip();

            // 黑色背景
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, size, size);

            // 计算三区域亮度 (马吕斯定律 I = I₀cos²θ)
            var brightnessMid = Math.pow(Math.cos(theta * Math.PI / 180), 2);
            var brightnessSides = Math.pow(Math.cos((theta + delta) * Math.PI / 180), 2);

            var midVal = Math.floor(brightnessMid * 255);
            var sideVal = Math.floor(brightnessSides * 255);

            // 中间矩形区域（占宽度 1/3）
            ctx.fillStyle = 'rgb(' + midVal + ',' + midVal + ',' + midVal + ')';
            ctx.fillRect(size/3, 0, size/3, size);

            // 左侧区域
            ctx.fillStyle = 'rgb(' + sideVal + ',' + sideVal + ',' + sideVal + ')';
            ctx.fillRect(0, 0, size/3, size);

            // 右侧区域
            ctx.fillRect(size*2/3, 0, size/3, size);

            // 分界线（细微）
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(size/3, 0); ctx.lineTo(size/3, size);
            ctx.moveTo(size*2/3, 0); ctx.lineTo(size*2/3, size);
            ctx.stroke();

            // 十字准星
            ctx.strokeStyle = 'rgba(255,200,0,0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(size/2, size/2 - 15); ctx.lineTo(size/2, size/2 + 15);
            ctx.moveTo(size/2 - 15, size/2); ctx.lineTo(size/2 + 15, size/2);
            ctx.stroke();

            ctx.restore();

            // 外圈边框
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
            ctx.stroke();

            // 更新角度显示
            var angleEl = document.getElementById('eyepiece-angle');
            if (angleEl) angleEl.textContent = eyepieceAngle.toFixed(2);
        };
    }

    /**
     * 更新目镜角度数字显示（独立于Canvas重绘）
     * 供 adjustAngle / 手轮拖拽 / 键盘微调 调用
     */
    function updateEyepieceDisplay() {
        var el = document.getElementById('eyepiece-angle');
        if (el) {
            el.textContent = eyepieceAngle.toFixed(2);
        }
    }

    function adjustAngle(delta) {
        eyepieceAngle += delta;
        eyepieceAngle = Math.round(eyepieceAngle * 100) / 100;

        // 限制范围
        if (eyepieceAngle < -180) eyepieceAngle = -180;
        if (eyepieceAngle > 180) eyepieceAngle = 180;

        if (renderEyepieceField) renderEyepieceField();
        updateEyepieceDisplay();       // 更新数字显示
        updateDialPointer(eyepieceAngle); // 同步手轮指针
    }

    function confirmReading() {
        if (!labData.tubePlaced) {
            showErrorBubble('\u274c \u8bf7\u5148\u5c06\u65cb\u5149\u7ba1\u653e\u5165\u4eea\u5668');
            return;
        }

        // 记录读数（含环境参数）
        var reading = {
            concentration: parseFloat(labData.currentConcentration.toFixed(4)),
            angleA0: 0,  // 零点读数（假设已校零）
            angleA: parseFloat(eyepieceAngle.toFixed(2)),
            deltaA: parseFloat((eyepieceAngle).toFixed(2)),
            temperature: currentTemperature,
            tubeLengthDM: currentTubeLengthDM,
            correctedAlpha: parseFloat(getCorrectedSpecificRotation().toFixed(6)),
            timestamp: Date.now()
        };

        labData.readings.push(reading);

        showSuccessBubble(
            '\u2713 \u8bfb\u6570\u5df2\u8bb0\u5f55\uff01\n' +
            '\u65cb\u5149\u89d2: ' + reading.deltaA.toFixed(2) + '\u00B0\n' +
            '\u6d53\u5ea6: ' + reading.concentration.toFixed(4) + ' g/mL\n' +
            'T=' + currentTemperature.toFixed(1) + '\u00B0C  L=' + currentTubeLengthDM + 'dm'
        );

        closeEyepiece();

        // 如果只做了一组测量，提示可以继续做多组或结束
        if (labData.readings.length >= 1) {
            updateControlPanel(); // 显示"开始新一组测量"/"完成实验"按钮
        }
    }

    // ============================================================
    // 第七部分：UI 更新与数据联动
    // ============================================================

    function updateTaskPanel() {
        var taskText = document.getElementById('task-text');
        var progressText = document.getElementById('progress-text');
        var progressBar = document.getElementById('progress-bar');

        var taskNames = {};
        taskNames[STATE.WEIGHING] = '1. 称量蔗糖固体试剂 (' + labData.targetMass.toFixed(1) + 'g)';
        taskNames[STATE.DISSOLVING] = '2. 烧杯中加水溶解';
        taskNames[STATE.VOLUMETRIC] = '3. 容量瓶定容至刻度线';
        taskNames[STATE.FILLING_TUBE] = '4. 灌注旋光管';
        taskNames[STATE.PLACING] = '5. 清洁并装入仪器';
        taskNames[STATE.MEASURING] = '6. 调等亮并读取旋光角';

        // 下一步预告文字
        var nextHints = {};
        nextHints[STATE.WEIGHING] = '\u2192 \u4e0b\u4e00\u6b65: \u70e7\u676f\u52a0\u6c34\u6eb6\u89e3';
        nextHints[STATE.DISSOLVING] = '\u2192 \u4e0b\u4e00\u6b65: \u5b9a\u5bb9\u81f3\u523b\u5ea6\u7ebf';
        nextHints[STATE.VOLUMETRIC] = '\u2192 \u4e0b\u4e00\u6b65: \u704c\u6ce8\u65cb\u5149\u7ba1';
        nextHints[STATE.FILLING_TUBE] = '\u2192 \u4e0b\u4e00\u6b65: \u6e05\u6d01\u5e76\u88c5\u5165\u4eea\u5668';
        nextHints[STATE.PLACING] = '\u2192 \u4e0b\u4e00\u6b65: \u8c03\u7b49\u4eae\u8bfb\u53d6';
        nextHints[STATE.MEASURING] = '\u2705 \u5b8c\u6210\u6240\u6709\u6b65\u9aa4';

        if (taskText) taskText.textContent = taskNames[currentState] || '';

        var stepNum = currentState;
        var totalSteps = 6;
        if (progressText) progressText.textContent = stepNum + ' / ' + totalSteps;
        if (progressBar) progressBar.style.width = (stepNum / totalSteps * 100) + '%';

        // 【模块二2.1】更新步骤列表样式 - 支持三种状态
        var steps = document.querySelectorAll('.step-item');
        steps.forEach(function(el) {
            var s = parseInt(el.dataset.step);
            el.classList.remove('step-active', 'step-done', 'step-locked');

            if (s < currentState) {
                // 已完成 → 绿色勾
                el.classList.add('step-done');
                // 在文字前添加 ✓ （如果还没有）
                var icon = el.querySelector('.step-icon');
                if (icon) icon.textContent = '✓';
            } else if (s === currentState) {
                // 进行中 → 青色发光
                el.classList.add('step-active');
                var icon = el.querySelector('.step-icon');
                if (icon) icon.textContent = '●';
                // 添加下一步预告
                var hint = el.querySelector('.step-next-hint');
                if (hint) {
                    hint.textContent = nextHints[currentState] || '';
                    hint.style.display = '';
                }
            } else {
                // 未解锁 → 锁定图标
                el.classList.add('step-locked');
                var icon = el.querySelector('.step-icon');
                if (icon) icon.textContent = '🔒';
                var hint = el.querySelector('.step-next-hint');
                if (hint) hint.style.display = 'none';
            }
        });
    }

    function updateControlPanel() {
        var area = document.getElementById('control-area');
        if (!area) return;

        var html = '';

        switch(currentState) {
            case STATE.WEIGHING:
                var spatulaReady = labObjects['spatula'] && labObjects['spatula'].visible;
                if (!spatulaReady) {
                    // 药匙未出现：引导点击试剂瓶
                    html = '<div style="text-align:center;padding:16px 8px;color:rgba(224,230,237,0.4);font-size:12px;line-height:1.6;">';
                    html += '<div style="font-size:20px;margin-bottom:8px;">&#128279;</div>';
                    html += '\u8bf7\u5148\u70b9\u51fb\u5de6\u4fa7\u7684<strong style="color:#00F3FF;">蔗糖\u8bd5\u5242\u74f6</strong><br>\u6253\u5f00\u74f6\u76d6\u83b7\u53d6\u836f\u5319';
                    html += '</div>';
                } else {
                    // 药匙已出现：显示取蔗糖按钮
                    html = '<button onclick="quickAddSugar()" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(0,243,255,0.4);background:linear-gradient(135deg,rgba(0,243,255,0.15),rgba(0,180,216,0.08));color:#00F3FF;font-size:14px;cursor:pointer;font-weight:800;margin-bottom:8px;">&#10024; + \u53d6蔗糖 (\u7ea61~2.5g)</button>';
                    html += '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">';
                    html += '<span style="color:rgba(224,230,237,0.35);font-size:11px;">\u5df2\u79f0: ' + labData.sugarMass.toFixed(2) + 'g</span>';
                    html += '<span style="color:rgba(224,230,237,0.35);font-size:11px;">\u76ee\u6807: ' + labData.targetMass + 'g</span>';
                    html += '</div>';
                    html += '<button onclick="resetWeighing()" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,107,107,0.2);background:transparent;color:rgba(255,107,107,0.6);font-size:12px;cursor:pointer;">\u91cd\u7f6e\u79f0\u91cf</button>';
                }
                break;
            case STATE.DISSOLVING:
                html = '<button onclick="addWater()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(112,193,255,0.3);background:rgba(112,193,255,0.1);color:#70C1FF;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:8px;">\u27700\u6dfb\u52a0\u6c34(40mL)</button>';
                html += '<button onclick="doStir()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,255,135,0.3);background:rgba(0,255,135,0.1);color:#00FF87;font-size:13px;cursor:pointer;font-weight:700;">\u6405\u62e6! \uff08\u6405\u62e6\u6eb6\u89e3\uff09</button>';
                break;
            case STATE.VOLUMETRIC:
                html = '<button onclick="pourFromBeaker()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(184,181,255,0.3);background:rgba(184,181,255,0.1);color:#B8B5FF;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:8px;">\u503e\u5012\u81f3\u5bb9\u91cf\u74f6</button>';
                html += '<button onclick="addDroplet()" id="btn-dropper" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,159,67,0.3);background:rgba(255,159,67,0.1);color:#FF9F43;font-size:13px;cursor:pointer;font-weight:700;display:none;">\u6ef4\u7ba1\u5fae\u8c03(+0.05mL)</button>';
                break;
            case STATE.FILLING_TUBE:
                if (labData.hasBubbles) {
                    html = '<button onclick="refillTube()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,107,107,0.3);background:rgba(255,107,107,0.1);color:#FF6B6B;font-size:13px;cursor:pointer;font-weight:700;">\u91cd\u65b0\u704c\u88c5</button>';
                } else {
                    html = '<div style="text-align:center;color:rgba(224,230,237,0.5);font-size:12px;padding:20px 0;">\u7b49\u5f85\u704c\u6ce8\u5b8c\u6210...</div>';
                }
                break;
            case STATE.PLACING:
                if (!labData.tubeCleaned) {
                    html = '<button onclick="cleanWithPaper()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,243,255,0.3);background:rgba(0,243,255,0.1);color:#00F3FF;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:8px;">\u7528\u64e6\u955c\u7eb8\u6e05\u6d01</button>';
                }
                if (!labData.instrumentOn) {
                    html += '<button onclick="turnOnInstrument()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(157,0,255,0.3);background:rgba(157,0,255,0.1);color:#9D00FF;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:8px;">\u6253\u5f00\u4eea\u5668\u7535\u6e90</button>';
                }
                if (labData.preheated && !labData.tubePlaced) {
                    html += '<button onclick="placeTubeInInstrument()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,255,135,0.3);background:rgba(0,255,135,0.1);color:#00FF87;font-size:13px;cursor:pointer;font-weight:700;">\u653e\u5165\u65cb\u5149\u7ba1</button>';
                }
                break;
            case STATE.MEASURING:
                // 目镜按钮
                html = '<button onclick="openEyepiece()" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(0,255,135,0.4);background:linear-gradient(135deg,rgba(0,255,135,0.15),rgba(0,204,106,0.08));color:#00FF87;font-size:14px;cursor:pointer;font-weight:800;margin-bottom:10px;">&#128300; \u6253\u5f00\u76ee\u9557\u89c2\u6d4b</button>';

                // ===== 环境参数控制区（温度 + 管长）=====
                html += '<div style="margin-top:12px;padding:10px;background:rgba(157,0,255,0.06);border:1px solid rgba(157,0,255,0.15);border-radius:8px;">';
                html += '<div style="font-size:11px;color:rgba(157,0,255,0.7);font-weight:700;margin-bottom:8px;letter-spacing:0.5px;">&#9881; \u73af\u5883\u53c2\u6570</div>';

                // 温度控制
                var tempColor = currentTemperature === 20 ? '#00FF87' : (currentTemperature > 22 ? '#FF9F43' : '#70C1FF');
                html += '<div style="margin-bottom:8px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
                html += '<span style="font-size:11px;color:rgba(224,230,237,0.5);">温度 T</span>';
                html += '<span id="temp-value-label" style="font-size:13px;font-weight:700;color:' + tempColor + ';font-family:Consolas,monospace;">' + currentTemperature.toFixed(1) + '\u00B0C</span>';
                html += '</div>';
                html += '<div style="display:flex;gap:4px;">';
                html += '<button onclick="adjustTemperature(-2)" style="flex:1;padding:5px;border-radius:5px;border:1px solid rgba(112,193,255,0.3);background:rgba(112,193,255,0.08);color:#70C1FF;font-size:11px;cursor:pointer;">-2°</button>';
                html += '<button onclick="adjustTemperature(-0.5)" style="flex:1;padding:5px;border-radius:5px;border:1px solid rgba(112,193,255,0.3);background:rgba(112,193,255,0.08);color:#70C1FF;font-size:11px;cursor:pointer;">-0.5°</button>';
                html += '<button onclick="resetTemperature()" style="flex:1;padding:5px;border-radius:5px;border:1px solid rgba(0,255,135,0.3);background:rgba(0,255,135,0.08);color:#00FF87;font-size:11px;cursor:pointer;">20°</button>';
                html += '<button onclick="adjustTemperature(0.5)" style="flex:1;padding:5px;border-radius:5px;border:1px solid rgba(255,159,67,0.3);background:rgba(255,159,67,0.08);color:#FF9F43;font-size:11px;cursor:pointer;">+0.5°</button>';
                html += '<button onclick="adjustTemperature(2)" style="flex:1;padding:5px;border-radius:5px;border:1px solid rgba(255,159,67,0.3);background:rgba(255,159,67,0.08);color:#FF9F43;font-size:11px;cursor:pointer;">+2°</button>';
                html += '</div></div>';

                // 管长切换
                html += '<div>';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
                html += '<span style="font-size:11px;color:rgba(224,230,237,0.5);">旋光管长 L</span>';
                html += '<span style="font-size:13px;font-weight:700;color:#B8B5FF;font-family:Consolas,monospace;">' + currentTubeLengthDM + ' dm (' + TUBE_LENGTH + 'cm)</span>';
                html += '</div>';
                html += '<div style="display:flex;gap:4px;">';
                html += '<button onclick="switchTubeLength(1)" style="flex:1;padding:6px;border-radius:5px;border:1px solid ' + (currentTubeLengthDM===1?'rgba(184,181,255,0.6)':'rgba(184,181,255,0.2)') + ';background:' + (currentTubeLengthDM===1?'rgba(184,181,255,0.15)':'transparent') + ';font-size:12px;cursor:pointer;font-weight:700;' + (currentTubeLengthDM===1?'color:#B8B5FF;':'color:rgba(184,181,255,0.5);') + '">1 dm</button>';
                html += '<button onclick="switchTubeLength(2)" style="flex:1;padding:6px;border-radius:5px;border:1px solid ' + (currentTubeLengthDM===2?'rgba(184,181,255,0.6)':'rgba(184,181,255,0.2)') + ';background:' + (currentTubeLengthDM===2?'rgba(184,181,255,0.15)':'transparent') + ';font-size:12px;cursor:pointer;font-weight:700;' + (currentTubeLengthDM===2?'color:#B8B5FF;':'color:rgba(184,181,255,0.5);') + '">2 dm</button>';
                html += '</div></div>';

                // 实时物理参数显示
                var correctedAlpha = getCorrectedSpecificRotation();
                var alphaColor = Math.abs(currentTemperature - 20) < 0.5 ? '#00FF87' : '#FF9F43';
                html += '<div style="margin-top:8px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:5px;font-size:10px;line-height:1.6;">';
                html += '<div style="display:flex;justify-content:space-between;"><span style="color:rgba(224,230,237,0.35);">[α]<sub>T</sub> 比旋光度:</span><span style="color:' + alphaColor + ';font-family:Consolas,monospace;font-weight:700;">' + correctedAlpha.toFixed(3) + '°</span></div>';
                html += '<div style="display:flex;justify-content:space-between;"><span style="color:rgba(224,230,237,0.35);">温度修正:</span><span style="color:' + (Math.abs(currentTemperature-20)<0.5?'#00FF87':'#FF6B6B') + ';font-family:Consolas,monospace;">' + (TEMP_COEFFICIENT * (currentTemperature - 20)).toFixed(4) + '°</span></div>';
                html += '</div>';

                html += '</div>'; // 环境参数区结束

                if (labData.readings.length > 0) {
                    html += '<div style="font-size:11px;color:rgba(0,255,135,0.5);margin-top:8px;margin-bottom:8px;">已记录 ' + labData.readings.length + ' 组读数</div>';
                    html += '<button onclick="startNewMeasurement()" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(0,243,255,0.2);background:transparent;color:#00F3FF;font-size:12px;cursor:pointer;">\u5f00\u59cb\u65b0\u4e00\u8f6e\u6d4b\u91cf</button>';
                    html += '<button onclick="finishExperiment()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,243,255,0.3);background:linear-gradient(135deg,#00F3FF,#0077B6);color:#0a0e17;font-size:13px;cursor:pointer;font-weight:800;margin-top:6px;">\u5b8c\u6210\u5b9e\u9a8c \u2192 \u6570\u636e\u5206\u6790</button>';
                }
                break;
        }

        area.innerHTML = html;

        // 数据显示区
        var dataDisp = document.getElementById('data-display');
        if (dataDisp) dataDisp.style.display = 'block';

        // 特殊处理：如果定容接近刻度线，显示滴管按钮
        if (currentState === STATE.VOLUMETRIC && labData.flaskVolume >= 95) {
            var btnDrop = document.getElementById('btn-dropper');
            if (btnDrop) btnDrop.style.display = '';
        }
    }

    function updateDataDisplay(label, value) {
        var rows = document.getElementById('data-rows');
        if (!rows) return;

        var existing = document.getElementById('data-row-' + label);
        if (existing) {
            var valEl = existing.querySelector('.data-value');
            if (valEl) valEl.textContent = value;
        } else {
            var row = document.createElement('div');
            row.id = 'data-row-' + label;
            row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:12px;';
            row.innerHTML = '<span style="color:rgba(224,230,237,0.4);">' + label + '</span><span class="data-value" style="color:#00F3FF;font-family:Consolas,monospace;font-weight:700;">' + value + '</span>';
            rows.appendChild(row);
        }
    }

    function updateHint(text) {
        var hintEl = document.getElementById('hint-text');
        if (hintEl) hintEl.textContent = text;
    }

    function updateBalanceDisplay(balanceGroup, mass) {
        if (!balanceGroup) return;
        var display = balanceGroup.getObjectByName('balance-display');
        if (!display) return;

        // 用 Canvas 纹理更新数字
        var canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 70;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#001a00';
        ctx.fillRect(0, 0, 160, 70);
        ctx.fillStyle = '#00FF41';
        ctx.font = 'bold 28px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(mass.toFixed(2) + ' g', 80, 48);

        var texture = new THREE.CanvasTexture(canvas);
        var mat = new THREE.MeshBasicMaterial({ map: texture });
        display.material = mat;
    }

    // ============================================================
    // 第八部分：错误气泡和成功气泡（含粒子效果增强）
    // ============================================================

    function showErrorBubble(message) {
        showBubble(message, '');
    }

    function showWarningBubble(message) {
        showBubble(message, 'warning');
    }

    function showSuccessBubble(message) {
        showBubble(message, 'success-bubble');
    }

    // 【模块二2.3】粒子爆裂效果函数
    function spawnParticles(bubbleEl, colors, count) {
        if (!bubbleEl) return;
        var rect = bubbleEl.getBoundingClientRect();
        for (var i = 0; i < count; i++) {
            var p = document.createElement('div');
            var angle = (i / count) * Math.PI * 2;
            var dist = 25 + Math.random() * 35;
            var dx = Math.cos(angle) * dist;
            var dy = Math.sin(angle) * dist;

            p.style.cssText = 'position:fixed;width:3px;height:3px;border-radius:50%;background:' +
                colors[i % colors.length] + ';z-index:9999;pointer-events:none;left:' +
                (rect.left + rect.width/2) + 'px;top:' + (rect.top + rect.height/2) + 'px;' +
                'animation:particle-fly 0.6s ease-out forwards;' +
                '--dx:' + dx + 'px;--dy:' + dy + 'px;';
            document.body.appendChild(p);

            // 使用JS动画（避免CSS变量兼容问题）
            (function(particle, targetX, targetY) {
                var startX = parseFloat(particle.style.left);
                var startY = parseFloat(particle.style.top);
                var startTime = performance.now();

                function animateParticle() {
                    var elapsed = performance.now() - startTime;
                    var t = Math.min(elapsed / 600, 1);
                    var ease = 1 - Math.pow(1 - t, 2); // easeOutQuad

                    particle.style.left = (startX + targetX * ease) + 'px';
                    particle.style.top = (startY + targetY * ease) + 'px';
                    particle.style.opacity = (1 - t).toString();
                    particle.style.transform = 'scale(' + (1 + t * 0.5) + ')';

                    if (t < 1) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }
                animateParticle();
            })(p, dx, dy);

            setTimeout(function(){ if(p && p.parentNode) p.parentNode.removeChild(p); }, 650);
        }
    }

    function showBubble(message, extraClass) {
        var container = document.getElementById('error-bubble-container');
        if (!container) return;

        var div = document.createElement('div');
        div.className = 'error-bubble' + (extraClass ? ' ' + extraClass : '');

        // 【模块二2.3】警告气泡添加⚠️图标
        if (extraClass === 'warning') {
            div.innerHTML = '<span style="margin-right:6px;">⚠️</span>' + message.replace(/\n/g, '<br>');
        } else {
            div.innerHTML = message.replace(/\n/g, '<br>');
        }

        container.appendChild(div);

        // 【模块二2.3】成功气泡触发粒子爆裂
        if (extraClass === 'success-bubble') {
            setTimeout(function() {
                spawnParticles(div, ['#00FF87', '#00F3FF', '#FFDF00'], 10);
            }, 50);
        }

        // 4秒后自动消失
        setTimeout(function() {
            if (div.parentNode) {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.3s';
                setTimeout(function() { if(div.parentNode) div.parentNode.removeChild(div); }, 300);
            }
        }, 4000);
    }

    // ============================================================
    // 第九部分：事件绑定与动画循环
    // ============================================================

    function bindEvents() {
        var canvas = renderer.domElement;

        // ============================================================
        //  事件流控 v2.0 —— 完整的事件分发链路
        //  流程图：
        //    mousedown → raycaster → 命中器材? → 是: stopPropagation + lockControls
        //                                    → 否: OrbitControls正常接管
        //    mousemove(按下中) → 超过阈值? → 是: unlockControls(用户想转视角)
        //    mouseup → 恢复controls + 判定点击/拖拽
        // ============================================================

        // ---------- mousedown：区域分流入口（capture阶段优先于OrbitControls）----------
        canvas.addEventListener('mousedown', function(event) {
            if (event.button !== 0) return; // 只响应左键

            _mouseDownPos.x = event.clientX;
            _mouseDownPos.y = event.clientY;

            var hitObj = _raycastAt(event.clientX, event.clientY);

            if (hitObj) {
                // 【路径A】命中交互敏感区 → 阻断OrbitControls
                // 使用 stopImmediatePropagation() 阻止同元素上后续监听器（包括OrbitControls内部监听）
                event.stopImmediatePropagation();
                event.preventDefault();

                _opState = OP_ACTIVE;
                _lockControls();

                // 光标切换为 pointer（手指/操作态）
                canvas.style.cursor = 'pointer';

                // 显示荧光青色高亮边框
                showHighlightOutline(hitObj);

                // 根据当前状态显示操作指示器
                var opLabel = hitObj.userData.label || hitObj.name || '\u5668\u6750';
                _showOpIndicator('\u6b63\u5728\u64cd\u4f5c\uff1a' + opLabel, 'normal');

                console.log('[EventFlow] mousedown(capture) → 锁定视角，命中:', hitObj.name || opLabel);
            } else {
                // 【路径B】空白区域左键按下 → 无特殊操作（FPS模式下空白区左键无功能）
                _opState = OP_IDLE;
                canvas.style.cursor = 'grab';
                removeHighlightOutline();
                _hideOpIndicator();
            }
        }, true); // ★★★ capture:true —— 在其他监听器之前执行

        // ---------- mousemove（按下期间）：拖拽判定（capture阶段）----------
        canvas.addEventListener('mousemove', function(event) {
            if (_opState !== OP_ACTIVE) {
                // 非操作状态下，走原有悬停逻辑
                onCanvasHover(event);
                return;
            }

            // 操作状态下，阻止事件传播
            event.stopImmediatePropagation();

            var dx = event.clientX - _mouseDownPos.x;
            var dy = event.clientY - _mouseDownPos.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > DRAG_THRESHOLD) {
                // 移动超过阈值 → 用户意图是移动鼠标而非点击器材
                console.log('[EventFlow] mousemove 超阈值(' + Math.round(dist) + 'px) → 解锁');
                _opState = OP_IDLE;
                _unlockControls();
                removeHighlightOutline();
                _hideOpIndicator();
                canvas.style.cursor = 'grab';
            }
        }, true); // ★★★ capture:true

        // ---------- mouseup：释放恢复（capture阶段）----------
        canvas.addEventListener('mouseup', function(event) {
            if (_opState !== OP_ACTIVE) {
                // 空白区域或右键的mouseup
                if (_opState === OP_IDLE) {
                    canvas.style.cursor = 'grab';
                }
                return;
            }

            // 操作状态下的mouseup也阻止传播
            event.stopImmediatePropagation();

            // 恢复视角控制
            _unlockControls();
            _hideOpIndicator();
            removeHighlightOutline();

            // 判定点击 vs 拖拽
            var dx = event.clientX - _mouseDownPos.x;
            var dy = event.clientY - _mouseDownPos.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            _opState = OP_IDLE;

            if (dist <= DRAG_THRESHOLD) {
                // 有效点击 → 触发器材交互
                console.log('[EventFlow] 有效点击(位移' + Math.round(dist) + 'px) → 触发交互');
                canvas.style.cursor = 'default';

                // 手动触发交互（绕过click事件的防重复问题）
                onCanvasClick(event);
            } else {
                canvas.style.cursor = 'grab';
            }
        });

        // ---------- click：防重复保护 ----------
        // 当mouseup已触发交互时，跳过浏览器原生click避免重复
        var _lastClickTime = 0;
        canvas.addEventListener('click', function(event) {
            var now = performance.now();
            if (now - _lastClickTime < 100) {
                // 100ms内的重复click（由mouseup手动触发的），跳过
                return;
            }
            _lastClickTime = now;

            // 正常的click（未经过mousedown隔离路径）
            if (_opState === OP_IDLE) {
                onCanvasClick(event);
            }
        });

        // ---------- 双击聚焦 ----------
        canvas.addEventListener('dblclick', onCanvasDoubleClick);

        // ---------- 悬停检测（光标样式）----------
        canvas.addEventListener('mousemove', onCanvasHover);

        // ---------- 窗口resize ----------
        window.addEventListener('resize', onWindowResize);

        // 底部工具栏按钮
        var btnResetView = document.getElementById('btn-reset-view');
        var btnToggleGrid = document.getElementById('btn-toggle-grid');
        var btnEyepiece = document.getElementById('btn-eyepiece');
        var btnHelp = document.getElementById('btn-help');

        if (btnResetView) btnResetView.addEventListener('click', resetCameraView);
        if (btnToggleGrid) btnToggleGrid.addEventListener('click', toggleGrid);
        // 【模块三3.3】目镜按钮条件判断
        if (btnEyepiece) {
            btnEyepiece.addEventListener('click', function() {
                if (!labData.tubePlaced && currentState !== STATE.MEASURING) {
                    showErrorBubble('\u274c \u8bf7\u5148\u5c06\u65cb\u5149\u7ba1\u653e\u5165\u4eea\u5668\uff01');
                    return;
                }
                openEyepiece();
            });
        }
        if (btnHelp) btnHelp.addEventListener('click', showHelpInfo);
    }

    // 【模块三3.1】获取点击对象辅助函数（复用射线检测）
    function getClickedObject(event) {
        if (!renderer || !camera || !raycaster) return null;
        var rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        var clickables = [];
        scene.traverse(function(obj) {
            if (obj.userData && obj.userData.clickable) clickables.push(obj);
            obj.traverse && obj.traverse(function(child) {
                if (child.userData && child.userData.clickable) clickables.push(child);
            });
        });

        var intersects = raycaster.intersectObjects(clickables, true);
        if (intersects.length > 0) {
            var clicked = intersects[0].object;
            while (clicked && !clicked.userData.clickable && clicked.parent) {
                clicked = clicked.parent;
            }
            return clicked && clicked.userData.clickable ? clicked : null;
        }
        return null;
    }

    // 【模块三3.1】双击聚焦事件处理
    function onCanvasDoubleClick(event) {
        var clicked = getClickedObject(event);
        if (!clicked || !clicked.userData || !clicked.userData.label) return;

        var label = clicked.userData.label;
        console.log('[3D Lab] 双击聚焦:', label);

        // 根据不同器材设置不同的聚焦相机位置
        var focusPositions = {
            '蔗糖试剂瓶': { pos: [-3, 4, 3], target: [-5.5, 0.7, -1.5] },
            '电子天平': { pos: [-3, 4, 2], target: [-4, 0.8, 0] },
            '烧杯': { pos: [-2, 4, 2], target: [-3, 0.6, -1.5] },
            '容量瓶(100mL)': { pos: [-2, 4.5, 3], target: [-4, 0.9, 2] },
            '旋光仪': { pos: [6, 4, 4], target: [4, 1.2, 0] },
            '目镜': { pos: [5.5, 2, 1], target: [5.5, 2, 0] },
            '电源开关': { pos: [5.5, 3, 3], target: [4.5, 1.5, 0.5] },
            '擦镜纸': { pos: [3, 4, 2], target: [2, 0.5, 1.5] },
            '旋光管': { pos: [0, 4, 3], target: [-2, 1, 2] },
            '蒸馏水洗瓶': { pos: [-2, 4, 2.5], target: [-3, 0.6, 1] },
            '玻璃棒': { pos: [-2, 4, 2], target: [-2.5, 0.7, -1.5] },
            '胶头滴管': { pos: [-3, 5, 2.5], target: [-4, 1.5, 2] },
            '水浴槽': { pos: [3, 5, -3], target: [2.5, 0.6, -2] },
            '温控旋钮': { pos: [3, 4.5, -1.5], target: [1.95, 0.92, -1.39] },
        };

        var config = focusPositions[label];
        if (!config) return; // 未知器材不聚焦

        animateCameraTo(config.pos, config.target, 800);
    }

    // 【模块三3.1】相机平滑过渡动画
    function animateCameraTo(targetPos, targetLookAt, duration) {
        if (!camera || !controls) return;
        var startPos = camera.position.clone();
        var startTarget = controls.target.clone();
        var startTime = performance.now();

        function update() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            // easeOutCubic
            var ease = 1 - Math.pow(1 - t, 3);

            camera.position.lerpVectors(startPos, new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]), ease);
            controls.target.lerpVectors(startTarget, new THREE.Vector3(targetLookAt[0], targetLookAt[1], targetLookAt[2]), ease);

            if (t < 1) {
                requestAnimationFrame(update);
            } else {
                // ★★★ 动画结束后同步FPS相机角度
                _syncCameraAnglesFromPosition();
            }
        }
        update();
    }

    // ============================================================
    //  高亮边框系统 —— 荧光青色Outline效果（替代OutlinePass）
    //  使用 emissive 发光 + CSS投影层实现，无需额外依赖库
    // ============================================================

    var _outlineMesh = null;       // 当前高亮轮廓网格
    var _outlineObject = null;      // 当前被高亮的对象

    /**
     * 为指定3D对象显示荧光青色高亮轮廓
     * 原理：克隆对象几何体 → 略微放大 + 反面渲染(BackSide) + 自发光材质
     */
    function showHighlightOutline(obj) {
        removeHighlightOutline(); // 先清除旧的

        if (!obj || !scene) return;
        _outlineObject = obj;

        try {
            // 找到对象的几何体（优先取自身，否则向上查找Group）
            var sourceGeom = null;
            var targetObj = obj;

            if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
                sourceGeom = obj.geometry;
            } else {
                // Group对象：找第一个有geometry的子Mesh
                obj.traverse(function(child) {
                    if (!sourceGeom && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                        sourceGeom = child.geometry;
                        targetObj = child;
                    }
                });
            }

            if (!sourceGeom) return;

            // 创建轮廓网格：略微放大 + 反面渲染
            var outlineMat = new THREE.MeshBasicMaterial({
                color: 0x00F3FF,           // 荧光青色
                side: THREE.BackSide,      // 只渲染背面（产生"外壳"效果）
                transparent: true,
                opacity: 0.5
            });

            _outlineMesh = new THREE.Mesh(sourceGeom.clone(), outlineMat);
            _outlineMesh.position.copy(targetObj.position);
            _outlineMesh.rotation.copy(targetObj.rotation);
            _outlineMesh.scale.copy(targetObj.scale).multiplyScalar(1.06); // 放大6%
            scene.add(_outlineMesh);

        } catch(e) {
            console.warn('[Outline] 高亮创建失败:', e.message);
        }
    }

    /** 移除当前高亮轮廓 */
    function removeHighlightOutline() {
        if (_outlineMesh && scene) {
            scene.remove(_outlineMesh);
            if (_outlineMesh.geometry) _outlineMesh.geometry.dispose();
            if (_outlineMesh.material) _outlineMesh.material.dispose();
            _outlineMesh = null;
        }
        _outlineObject = null;
    }

    // ============================================================
    //  悬停检测 v2.0 —— 三态指针样式系统
    //
    //  光标状态映射：
    //    grab    (小手抓取)   → 空白区域：可拖拽旋转视角
    //    pointer (手指点击)   → 可交互器材上：可点击操作
    //    move    (上下箭头)   → 垂直拖拽类器材（滴管/倾倒等）
    // ============================================================

    function onCanvasHover(event) {
        if (!renderer || !camera || _opState === OP_ACTIVE) return;

        var hitObj = _raycastAt(event.clientX, event.clientY);

        if (hitObj) {
            // 【交互敏感区】→ 切换为操作态光标
            var name = hitObj.name || '';
            var label = (hitObj.userData && hitObj.userData.label) || '';

            // 特殊器材使用 move 光标（暗示垂直/方向性操作）
            var isVerticalOp = (name.indexOf('dropper') >= 0 || name.indexOf('wash') >= 0
                || name.indexOf('spatula') >= 0 || label.indexOf('\u6ef4\u7ba1') >= 0
                || label.indexOf('\u6d17\u74f6') >= 0 || label.indexOf('\u836f\u5319') >= 0);

            renderer.domElement.style.cursor = isVerticalOp ? 'ns-resize' : 'pointer';

            // 悬停时轻微发光提示（不触发完整的高亮边框）
            highlightObjectSafe(hitObj, 0x003344); // 极淡的青色emissive
        } else {
            // 【非交互区】→ 抓取态光标
            renderer.domElement.style.cursor = 'grab';
        }
    }

    function onCanvasClick(event) {
        var rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // 收集所有可点击对象
        var clickables = [];
        scene.traverse(function(obj) {
            if (obj.userData && obj.userData.clickable) clickables.push(obj);
            if (obj.children) {
                obj.traverse(function(child) {
                    if (child.userData && child.userData.clickable) clickables.push(child);
                });
            }
        });

        var intersects = raycaster.intersectObjects(clickables, true);

        if (intersects.length > 0) {
            var clicked = intersects[0].object;
            // 向上查找带有 userData 的父级
            while (clicked && !clicked.userData.clickable && clicked.parent) {
                clicked = clicked.parent;
            }
            if (clicked && clicked.userData.clickable) {
                handleInteraction(clicked);
            }
        }
    }

    function handleInteraction(obj) {
        console.log('[3D Lab] 点击了:', obj.name || obj.userData.label);

        switch(currentState) {
            case STATE.WEIGHING: handleWeighingInteraction(obj); break;
            case STATE.DISSOLVING: handleDissolvingInteraction(obj); break;
            case STATE.VOLUMETRIC: handleVolumetricInteraction(obj); break;
            case STATE.FILLING_TUBE: handleFillingTubeInteraction(obj); break;
            case STATE.PLACING: handlePlacingInteraction(obj); break;
            case STATE.MEASURING: break; // 测量阶段通过目镜面板操作
        }
    }

    function resetCameraView() {
        if (!controls) return;
        // 平滑回到默认俯视视角（45度角）
        camera.position.set(5, 7, 9);
        controls.target.set(0, 0.3, 0);
        controls.update();
    }

    function toggleGrid() {
        if (gridHelper) {
            scene.remove(gridHelper);
            gridHelper = null;
        } else {
            gridHelper = new THREE.GridHelper(14, 14, 0x00F3FF, 0x111122);
            gridHelper.material.opacity = 0.15;
            gridHelper.material.transparent = true;
            scene.add(gridHelper);
        }
    }

    function showHelpInfo() {
        alert(
            '3D \u65cb\u5149\u4eea\u865a\u62df\u5b9e\u9a8c\u5ba4 \u64cd\u4f5c\u6307\u5357\n\n' +
            '1. \u9f20\u6807\u5de6\u952e\u62d6\u52a8\uff1a\u65cb\u8f6c\u89c6\u89d2\n' +
            '2. \u9f20\u6807\u53f3\u952e\u62d6\u52a8\uff1a\u5e73\u79fb\u89c6\u89d2\n' +
            '3. \u6eda\u8f6e\uff1a\u7f29\u653e\n' +
            '4. \u70b9\u51fb\u5668\u6750\uff1a\u8fdb\u884c\u4ea4\u4e92\u64cd\u4f5c\n' +
            '5. \u5de6\u4fa7\u9762\u677f\uff1a\u67e5\u770b\u5f53\u524d\u4efb\u52a1\u8fdb\u5ea6\n' +
            '6. \u53f3\u4fa7\u9762\u677f\uff1a\u64cd\u4f5c\u6309\u94ae\u4e0e\u5b9e\u65f6\u6570\u636e\n' +
            '7. \u5e95\u90e8\u5de5\u5177\u680f\uff1a\u5feb\u6377\u529f\u80fd\u5165\u53e3\n' +
            '8. \u6e29\u5ea6\u63a7\u5236: 10~40\u00B0C, [α]_T = [α]_20 - 0.00014(T-20)\n' +
            '9. \u7ba1\u957f\u5207\u6362: 1dm / 2dm (\u5149\u7a0b\u7ffb\u500d)'
        );
    }

    function onWindowResize() {
        var container = document.getElementById('lab-canvas');
        if (!container || !camera || !renderer) return;

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    var _camHintShown = false;  // 控制提示是否已显示过

    function animate() {
        animationId = requestAnimationFrame(animate);

        // ★★★ FPS相机：每帧处理WASD移动
        _processCameraMovement();

        // OrbitControls更新（仅用于滚轮缩放 damping 效果）
        if (controls) {
            controls.update();
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }

        // 更新悬浮字幕位置
        updateTooltipPositions();

        // 首次渲染后显示操作提示
        if (!_camHintShown && renderer) {
            _camHintShown = true;
            setTimeout(_showCamControlHint, 1000); // 延迟1秒等场景加载完
        }
    }

    // ==================== 快捷操作函数（被HTML按钮调用）====================
    window.quickAddSugar = function() { addSugarToBeaker(); };
    window.resetWeighing = function() {
        labData.sugarMass = 0;
        updateBalanceDisplay(labObjects['balance'], 0);
        updateHint('\u5df2\u91cd\u7f6e\u79f0\u91cf');
        updateDataDisplay('\u5df2\u79f0\u91cf蔗糖', '0.00 g');
    };
    window.addWater = function() {
        labData.waterVolume += 40;
        if (labData.waterVolume > 60) labData.waterVolume = 60;
        updateHint('\u5df2\u52a0\u6c34 ' + labData.waterVolume + 'mL');
        showLiquidInBeaker(labData.waterVolume / 60);
    };
    window.doStir = function() { startStirringAnimation(); };
    window.pourFromBeaker = function() { pourToFlask(); };
    window.addDroplet = function() { addDropToFlask(); };
    window.cleanWithPaper = function() { handlePlacingInteraction(labObjects['lens-paper']); };
    window.refillTube = function() { refillTube(); };
    window.startNewMeasurement = function() {
        // 准备下一组测量（改变浓度）— 使用完整物理公式 θ = [α]_T × c × L
        var newConc = 0.05 + Math.random() * 0.15; // 0.05 ~ 0.20 g/mL
        labData.currentConcentration = parseFloat(newConc.toFixed(4));
        labData.actualRotationAngle = calculateRotationAngle();
        eyepieceAngle = 0;
        updateHint('\u65b0\u6d53\u5ea6: ' + labData.currentConcentration.toFixed(4) + ' g/mL\uff0c[α]_' + currentTemperature.toFixed(0) + '=' + getCorrectedSpecificRotation().toFixed(3) + '°\uff0cL=' + currentTubeLengthDM + 'dm');
        openEyepiece();
    };
    window.finishExperiment = function() {
        // 将数据存入 sessionStorage（含温度和管长参数）
        var exportData = {
            studentName: sessionStorage.getItem('lab_student_name') || '\u5f20\u4e09',
            studentId: sessionStorage.getItem('lab_student_id') || '123',
            measurements: labData.readings.map(function(r) {
                return {
                    concentration: r.concentration,
                    rotationAngle: r.deltaA,
                    wavelength: WAVELENGTH,
                    tubeLength: TUBE_LENGTH,
                    tubeLengthDM: currentTubeLengthDM,
                    temperature: currentTemperature,
                    correctedAlpha: parseFloat(getCorrectedSpecificRotation(r.temperature || currentTemperature).toFixed(6)),
                    halfShadeAngle: HALF_SHADE_ANGLE
                };
            }),
            experimentConfig: {
                wavelength: WAVELENGTH,
                tubeLength: TUBE_LENGTH,
                tubeLengthDM: currentTubeLengthDM,
                temperature: currentTemperature,
                correctedAlpha: parseFloat(getCorrectedSpecificRotation().toFixed(6)),
                tempCoefficient: TEMP_COEFFICIENT,
                halfShadeAngle: HALF_SHADE_ANGLE
            },
            timestamp: Date.now()
        };

        sessionStorage.setItem('polarimeter_experiment_data', JSON.stringify(exportData));
        window.location.href = 'data-analysis.html';
    };

    // ===== 温度调节函数 =====
    window.adjustTemperature = function(delta) {
        var newTemp = currentTemperature + delta;
        // 限制范围 10°C ~ 40°C（超出此范围蔗糖可能分解或结晶）
        newTemp = Math.max(10, Math.min(40, newTemp));
        currentTemperature = parseFloat(newTemp.toFixed(1));

        // 更新水浴槽3D显示
        updateBathTempDisplay(labObjects['water-bath'], currentTemperature);

        // 重新计算旋光角
        updateActualRotationAngle();

        // 更新UI
        updateControlPanel();
        updateDataDisplay('\u73af\u5883\u6e29\u5ea6', currentTemperature.toFixed(1) + '\u00B0C');
        updateDataDisplay('[α]_' + currentTemperature.toFixed(0), getCorrectedSpecificRotation().toFixed(4) + '\u00B0');

        // 温度偏离提示
        if (Math.abs(currentTemperature - 20) > 2) {
            showWarningBubble(
                '\u26a0\ufe0f \u6e29\u5ea6\u504f\u79bb' + TEMP_STANDARD + '\u00B0C: ' +
                (currentTemperature > 20 ? '+' : '') + (currentTemperature - 20).toFixed(1) + '\u00B0C\n' +
                '\u6bd4\u65cb\u5149\u5ea6\u4fee\u6b63: ' + (TEMP_COEFFICIENT * (currentTemperature - 20)).toFixed(4) + '\u00B0'
            );
        }
    };

    window.resetTemperature = function() {
        currentTemperature = TEMP_STANDARD;
        updateBathTempDisplay(labObjects['water-bath'], currentTemperature);
        updateActualRotationAngle();
        updateControlPanel();
        showSuccessBubble('\u2713 \u6e29\u5ea6\u5df2\u91cd\u7f6e\u4e3a\u6807\u51c6 20.0\u00B0C');
    };

    // 暴露给 HTML 的全局函数
    window.openEyepiece = openEyepiece;
    window.closeEyepiece = closeEyepiece;
    window.adjustAngle = adjustAngle;
    window.confirmReading = confirmReading;
    window.turnOnInstrument = turnOnInstrument;
    window.placeTubeInInstrument = placeTubeInInstrument;
    window.switchTubeLength = switchTubeLength;
    window.adjustTemperature = adjustTemperature;
    window.resetTemperature = resetTemperature;

    // ==================== 初始化 ====================
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initLabScene();
                updateTaskPanel();
                updateControlPanel();
                updateSpatialTooltips();
            });
        } else {
            initLabScene();
            updateTaskPanel();
            updateControlPanel();
            updateSpatialTooltips();
        }
    } catch(e) {
        console.error('[3D Lab] 初始化失败:', e.message, '\n', e.stack);
        alert('3D场景初始化失败，请刷新页面重试。\n错误信息: ' + e.message);
    }

})();
