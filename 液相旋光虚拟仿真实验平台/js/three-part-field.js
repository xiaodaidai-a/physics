/**
 * 基于多智能体教学辅助的偏振光与蔗糖旋光现象仿真实验平台 - 三分视场 Canvas 渲染器
 * 
 * 核心视觉模块：在 Canvas 2D 上实时绘制半荫片三分视场的光强变化。
 * 视觉亮点："一黑两白"及"调等亮"的交互效果。
 */

class ThreePartFieldRenderer {
    /**
     * @param {HTMLCanvasElement} canvas - 目标 Canvas 元素
     * @param {Object} options - 渲染选项
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 渲染参数
        this.radius = options.radius || 200;                    // 视场半径 (px)
        this.centerX = options.centerX || 250;                   // 圆心 X
        this.centerY = options.centerY || 250;                   // 圆心 Y
        this.deltaAngle = options.deltaAngle || 4.0;             // 半荫片夹角 (度)
        this.colorTint = options.colorTint || { r: 255, g: 220, b: 0 }; // 钠黄光色调

        // 中间区域配置
        this.midWidth = options.midWidth || 150;                 // 中间区域宽度
        this.midHeight = options.midHeight || 400;               // 中间区域高度
        this.midShape = options.midShape || 'rect';              // 'rect' 或 'circle'

        // 后处理选项
        this.enableVignette = options.enableVignette !== false;   // 暗角渐晕
        this.enableNoise = options.enableNoise !== false;         // 噪声纹理
        this.enableCrosshair = options.enableCrosshair !== false; // 十字准线
        this.enableLensFlare = options.enableLensFlare !== false; // 镜头反光

        // 动画状态
        this._animationId = null;
        this._lastAngle = null;
        this._lastRotation = null;

        // 预计算 cos 查找表（优化性能）
        this._cosTable = new Float64Array(360001); // 0 ~ 360°，精度 0.001°
        for (let i = 0; i <= 360000; i++) {
            this._cosTable[i] = Math.cos((i / 1000) * Math.PI / 180);
        }

        console.log('[ThreePartField] 渲染器初始化完成', {
            size: `${canvas.width}×${canvas.height}`,
            radius: this.radius,
            deltaAngle: this.deltaAngle + '°'
        });
    }

    /**
     * 快速 cos 查找（避免重复计算）
     */
    _fastCos(degrees) {
        const idx = Math.round(Math.abs(degrees % 360) * 1000);
        return this._cosTable[idx % 360001];
    }

    /**
     * 核心渲染方法：绘制三分视场
     * @param {number} analyzerAngle - 检偏器角度 (度)
     * @param {number} solutionRotation - 溶液旋光角 (度)
     * @returns {{ brightnessMid: number, brightnessSides: number, isEquibright: boolean }}
     */
    render(analyzerAngle, solutionRotation) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, w, h);

        // 计算亮度值
        const thetaMid = (analyzerAngle - solutionRotation) * Math.PI / 180;
        const thetaSides = (analyzerAngle - solutionRotation + this.deltaAngle) * Math.PI / 180;

        let bMid, bSides;

        // 使用查找表加速
        bMid = Math.min(255, Math.max(0, Math.round(255 * this._fastCos(analyzerAngle - solutionRotation) ** 2)));
        bSides = Math.min(255, Math.max(0, Math.round(255 * this._fastCos(analyzerAngle - solutionRotation + this.deltaAngle) ** 2)));

        const { r: tr, g: tg, b: tb } = this.colorTint;

        // === 第1步：绘制圆形背景（两侧视场）===
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.clip();

        // 两侧背景色
        ctx.fillStyle = `rgb(${Math.round(bSides * tr / 255)}, ${Math.round(bSides * tg / 255)}, ${Math.round(bSides * tb / 255)})`;
        ctx.fillRect(this.centerX - this.radius, this.centerY - this.radius, this.radius * 2, this.radius * 2);

        // === 第2步：绘制中间视场 ===
        ctx.fillStyle = `rgb(${Math.round(bMid * tr / 255)}, ${Math.round(bMid * tg / 255)}, ${Math.round(bMid * tb / 255)})`;

        if (this.midShape === 'rect') {
            const mx = this.centerX - this.midWidth / 2;
            const my = this.centerY - this.midHeight / 2;
            ctx.fillRect(mx, my, this.midWidth, this.midHeight);
        } else {
            // 圆形中间区域
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.midWidth / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // === 第3步：叠加镜头纹理/暗角 ===
        if (this.enableVignette) {
            this._drawVignette();
        }

        // === 第4步：叠加噪声纹理 ===
        if (this.enableNoise) {
            this._drawNoise(bMid, bSides);
        }

        // === 第5步：绘制边框和十字准线 ===
        this._drawBorder();

        if (this.enableCrosshair) {
            this._drawCrosshair();
        }

        // === 第6步：等亮判定视觉反馈 ===
        const diff = Math.abs(bMid - bSides);
        const isEquibright = diff <= 3;

        if (isEquibright) {
            this._drawEquibrightIndicator();
        } else if (diff < 15) {
            this._drawNearEquibrightHint(diff);
        }

        // 绘制区域标注
        this._drawZoneLabels();

        return {
            brightnessMid: bMid,
            brightnessSides: bSides,
            isEquibright: isEquibright,
            diff: diff
        };
    }

    /**
     * 绘制暗角渐晕效果
     */
    _drawVignette() {
        const ctx = this.ctx;
        const gradient = ctx.createRadialGradient(
            this.centerX, this.centerY, this.radius * 0.4,
            this.centerX, this.centerY, this.radius
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.08)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.35)');

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
    }

    /**
     * 绘制噪声纹理（模拟胶片颗粒感）
     */
    _drawNoise(bMid, bSides) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.clip();

        const imageData = ctx.getImageData(
            this.centerX - this.radius,
            this.centerY - this.radius,
            this.radius * 2,
            this.radius * 2
        );
        const data = imageData.data;
        const noiseIntensity = 8; // 噪声强度

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseIntensity;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        ctx.putImageData(imageData,
            this.centerX - this.radius,
            this.centerY - this.radius
        );
        ctx.restore();
    }

    /**
     * 绘制视场边框
     */
    _drawBorder() {
        const ctx = this.ctx;
        ctx.save();

        // 外圈金属边框
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 6;
        ctx.stroke();

        // 内圈细线
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius - 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * 绘制十字准线
     */
    _drawCrosshair() {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;

        // 水平线
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.radius + 10, this.centerY);
        ctx.lineTo(this.centerX + this.radius - 10, this.centerY);
        ctx.stroke();

        // 垂直线
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY - this.radius + 10);
        ctx.lineTo(this.centerX, this.centerY + this.radius - 10);
        ctx.stroke();

        // 中心点
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();

        ctx.restore();
    }

    /**
     * 等亮指示器（绿色闪烁边框）
     */
    _drawEquibrightIndicator() {
        const ctx = this.ctx;
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(16, 185, 129, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 四角标记
        const corners = [
            [this.centerX - this.radius - 12, this.centerY - this.radius - 12],
            [this.centerX + this.radius + 12, this.centerY - this.radius - 12],
            [this.centerX - this.radius - 12, this.centerY + this.radius + 12],
            [this.centerX + this.radius + 12, this.centerY + this.radius + 12]
        ];
        ctx.fillStyle = `rgba(16, 185, 129, ${pulse})`;
        for (const [cx, cy] of corners) {
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * 接近等亮提示
     */
    _drawNearEquibrightHint(diff) {
        const ctx = this.ctx;
        const alpha = Math.max(0, 1 - diff / 15) * 0.3;

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 201, 66, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 绘制区域标注（左/中/右）
     */
    _drawZoneLabels() {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = '11px "Source Sans Pro", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';

        ctx.fillText('左', this.centerX - this.midWidth / 2 - 30, this.centerY + this.radius + 20);
        ctx.fillText('中', this.centerX, this.centerY + this.radius + 20);
        ctx.fillText('右', this.centerX + this.midWidth / 2 + 30, this.centerY + this.radius + 20);

        ctx.restore();
    }

    /**
     * 启动连续渲染模式（用于手轮拖拽时的实时更新）
     * @param {Function} getAngles - 返回 { analyzerAngle, solutionRotation } 的函数
     */
    startContinuousRender(getAngles) {
        const loop = () => {
            const angles = getAngles();
            if (angles) {
                this.render(angles.analyzerAngle, angles.solutionRotation);
            }
            this._animationId = requestAnimationFrame(loop);
        };
        this.stopContinuousRender();
        this._animationId = requestAnimationFrame(loop);
    }

    /**
     * 停止连续渲染
     */
    stopContinuousRender() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }

    /**
     * 设置半荫片夹角
     */
    setDeltaAngle(delta) {
        this.deltaAngle = delta;
    }

    /**
     * 设置光色调
     */
    setColorTint(r, g, b) {
        this.colorTint = { r, g, b };
    }

    /**
     * 销毁资源
     */
    destroy() {
        this.stopContinuousRender();
        this._cosTable = null;
        console.log('[ThreePartField] 渲染器已销毁');
    }
}

// 导出（支持 ES Module 和全局变量两种方式）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreePartFieldRenderer;
}
