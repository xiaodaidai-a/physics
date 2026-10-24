/**
 * 基于多智能体教学辅助的偏振光与蔗糖旋光现象仿真实验平台 - 物理引擎核心模块
 * 
 * 包含所有物理公式计算，无 UI 依赖，纯数学/物理层。
 * 核心公式：马吕斯定律、三分视场光强、旋光公式、温度修正、误差模型
 */

const PhysicsEngine = (() => {
    'use strict';

    // ==================== 常量定义 ====================
    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;

    // 蔗糖溶液在钠黄光(589.3nm)、20°C下的标准比旋光度 [α]20^589.3 = +66.37°·mL/(dm·g)
    const SUCROSE_ALPHA_20 = 66.37;

    // 钠黄光波长 (nm)
    const SODIUM_WAVELENGTH = 589.3;

    // 温度系数 (°/(°C·dm))
    const TEMP_COEFFICIENT = 0.00014;

    // 半荫片默认夹角 (度)
    const DEFAULT_DELTA_ANGLE = 4.0;

    // ==================== 工具函数 ====================

    /**
     * 度转弧度
     */
    function degToRad(deg) {
        return deg * DEG_TO_RAD;
    }

    /**
     * 弧度转度
     */
    function radToDeg(rad) {
        return rad * RAD_TO_DEG;
    }

    /**
     * 将角度规范化到 [0, 360) 范围
     */
    function normalizeAngle(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * 数值约束到指定范围
     */
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Box-Muller 变换生成高斯随机数
     * @param {number} sigma 标准差
     * @param {number} mu 均值（默认0）
     * @returns {number} 高斯分布随机数
     */
    function gaussianRandom(sigma, mu = 0) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * sigma + mu;
    }

    // ==================== 马吕斯定律 ====================

    /**
     * 马吕斯定律：I = I₀ · cos²θ
     * @param {number} I0 - 入射光强 (0~255)
     * @param {number} theta - 偏振器与检偏器之间的夹角 (度)
     * @returns {number} 出射光强 (0~255)
     */
    function malusLaw(I0, theta) {
        const cosTheta = Math.cos(degToRad(theta));
        return clamp(Math.round(I0 * cosTheta * cosTheta), 0, 255);
    }

    // ==================== 三分视场光强 ====================

    /**
     * 计算三分视场（半荫片法）的中间区域和两侧区域的亮度
     *
     * 中间视场：I_mid = I₀ · cos²(α_analyzer - θ_solution)
     * 两侧视场：I_sides = I₀ · cos²(α_analyzer - θ_solution ± δ)
     *
     * @param {number} I0 - 入射光强 (0~255)，默认255
     * @param {number} analyzerAngle - 检偏器角度 (度)
     * @param {number} solutionRotation - 溶液旋光角 (度)
     * @param {number} delta - 半荫片固定夹角 (度)，默认4°
     * @returns {{ mid: number, sides: number }} 中间和两侧的亮度值 (0~255)
     */
    function threePartIntensity(I0 = 255, analyzerAngle, solutionRotation, delta = DEFAULT_DELTA_ANGLE) {
        const thetaMid = degToRad(normalizeAngle(analyzerAngle - solutionRotation));
        const thetaSides = degToRad(normalizeAngle(analyzerAngle - solutionRotation + delta));

        const bMid = clamp(Math.round(I0 * Math.pow(Math.cos(thetaMid), 2)), 0, 255);
        const bSides = clamp(Math.round(I0 * Math.pow(Math.cos(thetaSides), 2)), 0, 255);

        return { mid: bMid, sides: bSides };
    }

    /**
     * 等亮判定：检查三分视场是否达到等亮状态
     * @param {number} analyzerAngle - 检偏器角度 (度)
     * @param {number} solutionRotation - 溶液旋光角 (度)
     * @param {number} delta - 半荫片夹角 (度)
     * @param {number} tolerance - 容差（灰度级），默认3
     * @returns {{ isEquibright: boolean, diff: number, brightnessMid: number, brightnessSides: number, hint: string }}
     */
    function checkEquibrightness(analyzerAngle, solutionRotation, delta = DEFAULT_DELTA_ANGLE, tolerance = 3) {
        const { mid, sides } = threePartIntensity(255, analyzerAngle, solutionRotation, delta);
        const diff = Math.abs(mid - sides);

        let hint = '';
        if (diff <= tolerance) {
            hint = '✓ 等亮点！请记录读数';
        } else if (diff <= 10) {
            hint = '接近等亮，请微调！';
        } else if (diff <= 30) {
            hint = '继续调节手轮...';
        } else {
            hint = '视场差异较大，需要大幅调节';
        }

        return {
            isEquibright: diff <= tolerance,
            diff: Math.round(diff * 100) / 100,
            brightnessMid: mid,
            brightnessSides: sides,
            hint: hint
        };
    }

    // ==================== 旋光公式 ====================

    /**
     * 旋光角计算：θ = [α]_T^λ · c · L
     * @param {number} specificRotation - 比旋光度 (°·mL/(dm·g))
     * @param {number} concentration - 浓度 (g/mL)
     * @param {number} tubeLength - 旋光管长度 (dm)
     * @returns {number} 旋光角 (度)
     */
    function rotationAngle(specificRotation, concentration, tubeLength) {
        return specificRotation * concentration * tubeLength;
    }

    /**
     * 温度修正比旋光度：[α]_T = [α]_20 - 0.00014 · (T - 20)
     * @param {number} alpha20 - 20°C时的比旋光度，默认66.37
     * @param {number} temperature - 当前温度 (°C)
     * @returns {number} 温度修正后的比旋光度
     */
    function temperatureCorrectedAlpha(alpha20 = SUCROSE_ALPHA_20, temperature) {
        return alpha20 - TEMP_COEFFICIENT * (temperature - 20);
    }

    /**
     * 完整旋光角计算（含温度修正）
     * @param {number} concentration - 浓度 (g/mL)
     * @param {number} tubeLength - 旋光管长度 (dm)
     * @param {number} temperature - 温度 (°C)，默认20
     * @returns {number} 旋光角 (度)
     */
    function fullRotationAngle(concentration, tubeLength, temperature = 20) {
        const alphaT = temperatureCorrectedAlpha(SUCROSE_ALPHA_20, temperature);
        return rotationAngle(alphaT, concentration, tubeLength);
    }

    /**
     * 浓度反算：c = ΔA / ([α]_T · L)
     * @param {number} rotationAngle - 旋光角 ΔA (度)
     * @param {number} tubeLength - 旋光管长度 (dm)
     * @param {number} temperature - 温度 (°C)，默认20
     * @returns {number} 反算浓度 (g/mL)
     */
    function calculateConcentration(rotationAngle, tubeLength, temperature = 20) {
        const alphaT = temperatureCorrectedAlpha(SUCROSE_ALPHA_20, temperature);
        if (alphaT * tubeLength === 0) return 0;
        return rotationAngle / (alphaT * tubeLength);
    }

    // ==================== 最小二乘法拟合 ====================

    /**
     * 最小二乘法线性拟合 y = kx + b
     * @param {Array<{x: number, y: number}>} dataPoints - 数据点数组
     * @returns {{ slope: number, intercept: number, rSquared: number, stdError: number }}
     */
    function linearRegression(dataPoints) {
        const n = dataPoints.length;
        if (n < 2) {
            return { slope: 0, intercept: 0, rSquared: 0, stdError: Infinity };
        }

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (const pt of dataPoints) {
            sumX += pt.x;
            sumY += pt.y;
            sumXY += pt.x * pt.y;
            sumX2 += pt.x * pt.x;
            sumY2 += pt.y * pt.y;
        }

        const denom = n * sumX2 - sumX * sumX;
        if (Math.abs(denom) < 1e-10) {
            return { slope: 0, intercept: sumY / n, rSquared: 0, stdError: Infinity };
        }

        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;

        // 计算 R² (决定系数)
        const meanY = sumY / n;
        let ssTotal = 0, ssResidual = 0;
        for (const pt of dataPoints) {
            const predicted = slope * pt.x + intercept;
            ssTotal += (pt.y - meanY) ** 2;
            ssResidual += (pt.y - predicted) ** 2;
        }
        const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

        // 标准误差
        const stdError = n > 2 ? Math.sqrt(ssResidual / (n - 2)) : 0;

        return {
            slope: Math.round(slope * 10000) / 10000,
            intercept: Math.round(intercept * 100000) / 100000,
            rSquared: Math.round(rSquared * 10000) / 10000,
            stdError: Math.round(stdError * 10000) / 10000
        };
    }

    // ==================== 误差发生器 ====================

    /**
     * 读数随机误差（高斯分布）
     * @param {number} sigma - 标准差 (度)，默认 0.02°
     * @returns {number} 误差值 (度)
     */
    function generateReadingError(sigma = 0.02) {
        return gaussianRandom(sigma);
    }

    /**
     * 温度系统误差
     * @param {number} temperature - 当前温度 (°C)
     * @returns {number} 引起的比旋光度系统误差
     */
    function generateSystemError(temperature) {
        // 温度偏离 20°C 导致的系统误差
        return TEMP_COEFFICIENT * Math.abs(temperature - 20);
    }

    /**
     * 接触不完全误差（均匀分布）
     * @param {number} range - 误差范围半宽 (度)，默认 0.05°
     * @returns {number} 误差值 (度)
     */
    function generateContactError(range = 0.05) {
        return (Math.random() * 2 - 1) * range;
    }

    /**
     * 判断主观误差（等亮容差抖动）
     * @param {number} baseTolerance - 基础容差
     * @returns {number} 抖动后的容差
     */
    function generateJudgmentError(baseTolerance = 3) {
        const jitter = gaussianRandom(1); // ±1 灰度级抖动
        return Math.max(1, baseTolerance + jitter);
    }

    /**
     * 综合误差注入：对真实值注入多层误差后返回"记录值"
     * @param {number} trueValue - 真实值 (度)
     * @param {Object} options - 误差选项
     * @returns {{ rawValue: number, recordedValue: number, totalError: number, errors: Object }}
     */
    function injectErrors(trueValue, options = {}) {
        const readingSigma = options.readingSigma || 0.02;
        const includeContact = options.includeContact !== false;
        const contactRange = options.contactRange || 0.05;

        let totalError = 0;
        const errors = {};

        // 1. 读数随机误差
        const readingErr = generateReadingError(readingSigma);
        totalError += readingErr;
        errors.reading = readingErr;

        // 2. 接触不完全误差（仅首次校准时）
        if (includeContact) {
            const contactErr = generateContactError(contactRange);
            totalError += contactErr;
            errors.contact = contactErr;
        }

        const recordedValue = trueValue + totalError;

        return {
            rawValue: Math.round(trueValue * 100) / 100,
            recordedValue: Math.round(recordedValue * 100) / 100,
            totalError: Math.round(totalError * 10000) / 10000,
            errors: errors
        };
    }

    // ==================== 公开 API ====================
    return {
        // 常量
        SUCROSE_ALPHA_20,
        SODIUM_WAVELENGTH,
        TEMP_COEFFICIENT,
        DEFAULT_DELTA_ANGLE,

        // 工具函数
        degToRad,
        radToDeg,
        normalizeAngle,
        clamp,

        // 马吕斯定律
        malusLaw,

        // 三分视场
        threePartIntensity,
        checkEquibrightness,

        // 旋光公式
        rotationAngle,
        temperatureCorrectedAlpha,
        fullRotationAngle,
        calculateConcentration,

        // 数据分析
        linearRegression,

        // 误差模型
        generateReadingError,
        generateSystemError,
        generateContactError,
        generateJudgmentError,
        injectErrors
    };
})();
