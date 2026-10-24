/**
 * 液相旋光（蔗糖溶液）虚拟仿真实验平台 - 核心实验控制模块
 *
 * 负责驱动四步闭环实验流程的状态机实现。
 * 实验流程：IDLE -> 零点校准 -> 放入溶液 -> 再次调等亮 -> 完成
 *
 * @module experiment-core
 * @version 1.0.0
 */

// ==================== 依赖检查 ====================

if (typeof PhysicsEngine === 'undefined') {
    console.warn('[experiment-core] 警告: PhysicsEngine 未定义，部分物理计算功能将不可用');
}

// ==================== 状态枚举 ====================

/**
 * 实验状态枚举
 * 定义实验的五个主要状态及其含义
 * @readonly
 * @enum {string}
 */
const ExperimentState = {
    /** 初始/待开始状态 */
    IDLE: 'idle',
    /** 状态1：零点校准（未放溶液/蒸馏水） */
    ZERO_CALIBRATION: 'zero_calibration',
    /** 状态2：已放入蔗糖溶液 */
    SUBSTANCE_INTRODUCED: 'substance_introduced',
    /** 状态3：再次调等亮 */
    RE_ADJUSTING: 're_adjusting',
    /** 状态4：完成（可继续下一组测量） */
    COMPLETED: 'completed'
};

// ==================== 常量定义 ====================

/** 默认半荫片夹角 (度) */
const DEFAULT_DELTA_ANGLE = 4.0;

/** 默认钠黄光波长 (nm) */
const DEFAULT_WAVELENGTH = 589.3;

/** 蔗糖在20°C下的标准比旋光度 (°·mL/(dm·g)) */
const DEFAULT_ALPHA_20 = 66.37;

/** 浓度范围限制 (g/mL) */
const CONCENTRATION_RANGE = { min: 0, max: 0.2 };

/** 温度范围限制 (°C) */
const TEMPERATURE_RANGE = { min: 15, max: 30 };

/** 允许的管长选项 (dm) */
const TUBE_LENGTH_OPTIONS = [1, 2];

/** SessionStorage 存储键名 */
const SESSION_STORAGE_KEY = 'polarimeter_experiment_data';

// ==================== 主类定义 ====================

/**
 * 实验状态机类
 * 管理整个液相旋光实验的生命周期和状态流转
 *
 * @class ExperimentStateMachine
 * @example
 * const machine = new ExperimentStateMachine({
 *     onStateChange: (old, newState) => console.log(`状态变更: ${old} -> ${newState}`),
 *     onEquibright: (result) => console.log('等亮判定:', result),
 *     onDataUpdate: (data) => console.log('数据更新'),
 *     onError: (msg) => alert(msg)
 * });
 */
class ExperimentStateMachine {
    /**
     * 创建实验状态机实例
     * @constructor
     * @param {Object} options - 配置选项
     * @param {Function} [options.onStateChange] - 状态变化回调函数 (oldState, newState) => void
     * @param {Function} [options.onEquibright] - 达到等亮时回调 (result) => void
     * @param {Function} [options.onDataUpdate] - 数据更新回调 (data) => void
     * @param {Function} [options.onError] - 错误回调 (message) => void
     */
    constructor(options = {}) {
        /**
         * 回调配置对象
         * @private
         */
        this._callbacks = {
            onStateChange: options.onStateChange || (() => {}),
            onEquibright: options.onEquibright || (() => {}),
            onDataUpdate: options.onDataUpdate || (() => {}),
            onError: options.onError || ((msg) => console.error(`[ExperimentStateMachine] ${msg}`))
        };

        /**
         * 当前实验状态
         * @private
         * @type {string}
         */
        this._currentState = ExperimentState.IDLE;

        /**
         * 实验数据对象
         * @private
         * @type {Object}
         */
        this._data = this._createEmptyData();

        /**
         * 测量组计数器（用于生成唯一ID）
         * @private
         * @type {number}
         */
        this._measurementCounter = 0;
    }

    // ==================== 私有方法 ====================

    /**
     * 创建空的实验数据结构
     * @private
     * @returns {Object} 初始数据对象
     */
    _createEmptyData() {
        return {
            studentInfo: {
                name: '',
                studentId: '',
                className: '',
                date: new Date().toISOString().split('T')[0]
            },
            config: {
                deltaAngle: DEFAULT_DELTA_ANGLE,
                halfShadeAngle: DEFAULT_DELTA_ANGLE || 4.0,
                wavelength: DEFAULT_WAVELENGTH,
                alpha20: DEFAULT_ALPHA_20
            },
            calibration: {
                A0: null,
                timestamp: null
            },
            measurements: [],
            currentMeasurementId: null,
            currentState: ExperimentState.IDLE
        };
    }

    /**
     * 创建新的测量组对象
     * @private
     * @returns {Object} 新测量组
     */
    _createMeasurement() {
        this._measurementCounter++;
        return {
            id: this._measurementCounter,
            concentration: 0.1,
            temperature: 20,
            tubeLength: 1,
            A0: null,
            A: null,
            deltaA: null,
            isBlindBox: false,
            errors: {
                reading: null,
                contact: null
            }
        };
    }

    /**
     * 触发数据更新通知
     * @private
     */
    _notifyDataUpdate() {
        try {
            this._callbacks.onDataUpdate(this.getExperimentData());
        } catch (e) {
            console.warn('[experiment-core] onDataUpdate 回调执行出错:', e);
        }
    }

    /**
     * 触发错误通知
     * @private
     * @param {string} message - 错误信息
     */
    _notifyError(message) {
        try {
            this._callbacks.onError(message);
        } catch (e) {
            console.error(`[experiment-core] ${message}`, e);
        }
    }

    /**
     * 数值约束到指定范围
     * @private
     * @param {number} value - 输入值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 约束后的值
     */
    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // ==================== 状态转移方法 ====================

    /**
     * 执行状态转移
     * 包含前置条件校验，不满足条件时抛出错误或返回 false
     *
     * @public
     * @param {string} targetState - 目标状态（ExperimentState 枚举值）
     * @returns {boolean} 是否成功转移
     * @throws {Error} 当目标状态无效时抛出错误
     */
    transitionTo(targetState) {
        // 验证目标状态是否有效
        const validStates = Object.values(ExperimentState);
        if (!validStates.includes(targetState)) {
            throw new Error(`无效的目标状态: ${targetState}`);
        }

        // 检查是否允许转移
        if (!this.canTransitionTo(targetState)) {
            const msg = `不允许从 "${this._currentState}" 转移到 "${targetState}"`;
            this._notifyError(msg);
            return false;
        }

        // 执行转移
        const oldState = this._currentState;
        this._currentState = targetState;
        this._data.currentState = targetState;

        // 触发状态变更回调
        try {
            this._callbacks.onStateChange(oldState, targetState);
        } catch (e) {
            console.warn('[experiment-core] onStateChange 回调执行出错:', e);
        }

        this._notifyDataUpdate();
        return true;
    }

    /**
     * 检查是否允许转移到目标状态
     * 基于状态转移规则矩阵进行判断
     *
     * @public
     * @param {string} targetState - 目标状态
     * @returns {boolean} 是否允许转移
     */
    canTransitionTo(targetState) {
        const current = this._currentState;

        // 定义合法的状态转移规则
        const transitionRules = {
            [ExperimentState.IDLE]: [ExperimentState.ZERO_CALIBRATION],
            [ExperimentState.ZERO_CALIBRATION]: [ExperimentState.SUBSTANCE_INTRODUCED],
            [ExperimentState.SUBSTANCE_INTRODUCED]: [ExperimentState.RE_ADJUSTING],
            [ExperimentState.RE_ADJUSTING]: [ExperimentState.COMPLETED],
            [ExperimentState.COMPLETED]: [ExperimentState.ZERO_CALIBRATION]  // 可继续下一组测量
        };

        const allowedTargets = transitionRules[current];
        return allowedTargets ? allowedTargets.includes(targetState) : false;
    }

    /**
     * 开始实验（从 IDLE 进入零点校准）
     *
     * @public
     * @returns {boolean} 是否成功开始
     */
    start() {
        if (this._currentState !== ExperimentState.IDLE) {
            this._notifyError(`当前状态为 ${this._currentState}，无法重新开始实验`);
            return false;
        }
        return this.transitionTo(ExperimentState.ZERO_CALIBRATION);
    }

    /**
     * 确认零点校准读数并进入"已放入溶液"状态
     * 仅在 ZERO_CALIBRATION 状态下有效
     *
     * @public
     * @returns {boolean} 是否成功确认
     */
    confirmA0() {
        if (this._currentState !== ExperimentState.ZERO_CALIBRATION) {
            this._notifyError('当前不在零点校准状态，无法确认初读数');
            return false;
        }

        if (this._data.calibration.A0 === null) {
            this._notifyError('尚未记录初读数 A0，请先记录读数');
            return false;
        }

        return this.transitionTo(ExperimentState.SUBSTANCE_INTRODUCED);
    }

    /**
     * 放入蔗糖溶液（从 SUBSTANCE_INTRODUCED 进入再次调等亮）
     *
     * @public
     * @returns {boolean} 是否成功放入
     */
    introduceSolution() {
        if (this._currentState !== ExperimentState.SUBSTANCE_INTRODUCED) {
            this._notifyError('当前未处于"已放入溶液"状态，无法执行此操作');
            return false;
        }

        // 为当前测量组设置 A0（使用校准值）
        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.A0 = this._data.calibration.A0;
        }

        return this.transitionTo(ExperimentState.RE_ADJUSTING);
    }

    /**
     * 确认末读数并进入完成状态
     * 仅在 RE_ADJUSTING 状态下有效
     *
     * @public
     * @returns {boolean} 是否成功确认
     */
    confirmA() {
        if (this._currentState !== ExperimentState.RE_ADJUSTING) {
            this._notifyError('当前不在调等亮状态，无法确认末读数');
            return false;
        }

        const currentMeas = this.getCurrentMeasurement();
        if (!currentMeas) {
            this._notifyError('没有正在进行的测量组');
            return false;
        }

        if (currentMeas.A === null) {
            this._notifyError('尚未记录末读数 A，请先记录读数');
            return false;
        }

        // 计算 deltaA
        currentMeas.deltaA = currentMeas.A - currentMeas.A0;

        return this.transitionTo(ExperimentState.COMPLETED);
    }

    // ==================== 读数记录方法 ====================

    /**
     * 记录通用读数（通过 PhysicsEngine.injectErrors 注入误差）
     *
     * @public
     * @param {number} value - 原始读数值（度）
     * @param {Object} [options] - 误差注入选项
     * @param {boolean} [options.includeContact=false] - 是否包含接触不完全误差
     * @param {number} [options.readingSigma=0.02] - 读数随机误差标准差
     * @returns {Object} 注入误差后的结果对象
     */
    recordReading(value, options = {}) {
        if (value === null || value === undefined) {
            this._notifyError('读数值不能为空');
            return null;
        }

        let result;
        if (typeof PhysicsEngine !== 'undefined' && PhysicsEngine.injectErrors) {
            result = PhysicsEngine.injectErrors(value, options);
        } else {
            // PhysicsEngine 不可用时直接返回原始值
            result = {
                rawValue: Math.round(value * 100) / 100,
                recordedValue: Math.round(value * 100) / 100,
                totalError: 0,
                errors: { reading: 0, contact: 0 }
            };
        }

        return result;
    }

    /**
     * 记录初读数 A0（仅在 ZERO_CALIBRATION 状态下有效）
     *
     * @public
     * @param {number} value - 初读数值（度）
     * @returns {Object|null} 记录结果，失败返回 null
     */
    recordA0(value) {
        if (this._currentState !== ExperimentState.ZERO_CALIBRATION) {
            this._notifyError('只能在零点校准状态下记录初读数 A0');
            return null;
        }

        if (value === null || value === undefined) {
            this._notifyError('初读数 A0 不能为空');
            return null;
        }

        // 注入误差并记录
        const result = this.recordReading(value, { includeContact: true });

        this._data.calibration.A0 = result.recordedValue;
        this._data.calibration.timestamp = Date.now();

        // 记录误差明细到当前测量组
        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.errors.reading = result.errors.reading;
            currentMeas.errors.contact = result.errors.contact;
        }

        this._notifyDataUpdate();
        return result;
    }

    /**
     * 记录末读数 A（仅在 RE_ADJUSTING 状态下有效）
     *
     * @public
     * @param {number} value - 末读数值（度）
     * @returns {Object|null} 记录结果，失败返回 null
     */
    recordA(value) {
        if (this._currentState !== ExperimentState.RE_ADJUSTING) {
            this._notifyError('只能在调等亮状态下记录末读数 A');
            return null;
        }

        if (value === null || value === undefined) {
            this._notifyError('末读数 A 不能为空');
            return null;
        }

        const currentMeas = this.getCurrentMeasurement();
        if (!currentMeas) {
            this._notifyError('没有正在进行的测量组');
            return null;
        }

        // 注入误差并记录（不含接触误差）
        const result = this.recordReading(value, { includeContact: false });

        currentMeas.A = result.recordedValue;
        currentMeas.errors.reading = result.errors.reading;

        this._notifyDataUpdate();
        return result;
    }

    // ==================== 数据获取方法 ====================

    /**
     * 获取当前实验状态
     *
     * @public
     * @returns {string} 当前状态字符串
     */
    getCurrentState() {
        return this._currentState;
    }

    /**
     * 获取全部实验数据对象
     *
     * @public
     * @returns {Object} 完整的实验数据副本
     */
    getExperimentData() {
        return JSON.parse(JSON.stringify(this._data));
    }

    /**
     * 获取当前正在进行的测量组
     *
     * @public
     * @returns {Object|null} 当前测量组对象，无则返回 null
     */
    getCurrentMeasurement() {
        if (!this._data.currentMeasurementId) {
            return null;
        }
        return this._data.measurements.find(
            m => m.id === this._data.currentMeasurementId
        ) || null;
    }

    /**
     * 获取所有已完成测量的列表
     *
     * @public
     * @returns {Array} 已完成的测量数组
     */
    getCompletedMeasurements() {
        return this._data.measurements.filter(m => m.deltaA !== null);
    }

    // ==================== 变量管理方法 ====================

    /**
     * 设置学生信息
     *
     * @public
     * @param {Object} info - 学生信息对象
     * @param {string} info.name - 姓名
     * @param {string} info.studentId - 学号
     * @param {string} info.className - 班级
     * @param {string} [info.date] - 日期（默认今天）
     */
    setStudentInfo(info) {
        if (!info || typeof info !== 'object') {
            this._notifyError('学生信息格式不正确');
            return;
        }

        this._data.studentInfo = {
            name: info.name || '',
            studentId: info.studentId || '',
            className: info.className || '',
            date: info.date || new Date().toISOString().split('T')[0]
        };

        this._notifyDataUpdate();
    }

    /**
     * 设置当前浓度
     *
     * @public
     * @param {number} c - 浓度值 (g/mL)，范围 0~0.2
     * @returns {number} 实际设置的浓度值（经过约束后）
     */
    setConcentration(c) {
        const clamped = this._clamp(c, CONCENTRATION_RANGE.min, CONCENTRATION_RANGE.max);
        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.concentration = Math.round(clamped * 10000) / 10000;
            this._notifyDataUpdate();
        }
        return clamped;
    }

    /**
     * 设置温度
     *
     * @public
     * @param {number} T - 温度值 (°C)，范围 15~30
     * @returns {number} 实际设置的温度值（经过约束后）
     */
    setTemperature(T) {
        const clamped = this._clamp(T, TEMPERATURE_RANGE.min, TEMPERATURE_RANGE.max);
        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.temperature = Math.round(clamped * 10) / 10;
            this._notifyDataUpdate();
        }
        return clamped;
    }

    /**
     * 设置旋光管长度
     *
     * @public
     * @param {number} L - 管长 (dm)，仅允许 1 或 2
     * @returns {number} 实际设置的管长值
     */
    setTubeLength(L) {
        if (!TUBE_LENGTH_OPTIONS.includes(L)) {
            this._notifyError(`管长只能为 ${TUBE_LENGTH_OPTIONS.join(' 或 ')} dm`);
            return this.getCurrentMeasurement()?.tubeLength || 1;
        }

        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.tubeLength = L;
            this._notifyDataUpdate();
        }
        return L;
    }

    /**
     * 切换未知浓度模式（盲盒模式）
     *
     * @public
     * @returns {boolean} 切换后的盲盒模式状态
     */
    toggleBlindBox() {
        const currentMeas = this.getCurrentMeasurement();
        if (currentMeas) {
            currentMeas.isBlindBox = !currentMeas.isBlindBox;
            this._notifyDataUpdate();
            return currentMeas.isBlindBox;
        }
        return false;
    }

    /**
     * 通过 PhysicsEngine.fullRotationAngle 计算当前旋光角
     *
     * @public
     * @returns {number} 旋光角（度），计算失败返回 0
     */
    /**
     * 计算当前溶液的旋光角
     *
     * 核心逻辑：
     * - 零点校准阶段（IDLE / ZERO_CALIBRATION）：无样品，旋光角 = 0
     * - 放入溶液后（SUBSTANCE_INTRODUCED 及之后）：有蔗糖溶液，按公式计算真实旋光角
     * 这保证了放入溶液前后视场会发生明显变化（视觉冲击力）
     *
     * @public
     * @returns {number} 当前旋光角度（度）
     */
    getComputedRotationAngle() {
        // 零点校准阶段：无溶液，旋光角恒为 0
        if (
            this._currentState === ExperimentState.IDLE ||
            this._currentState === ExperimentState.ZERO_CALIBRATION
        ) {
            return 0;
        }

        const currentMeas = this.getCurrentMeasurement();

        if (!currentMeas) {
            return 0;
        }

        if (typeof PhysicsEngine === 'undefined' || !PhysicsEngine.fullRotationAngle) {
            console.warn('[experiment-core] PhysicsEngine.fullRotationAngle 不可用');
            // 使用简化公式手动计算
            const alpha20 = this._data.config.alpha20;
            const tempCoeff = 0.00014;
            const alphaT = alpha20 - tempCoeff * (currentMeas.temperature - 20);
            return alphaT * currentMeas.concentration * currentMeas.tubeLength;
        }

        return PhysicsEngine.fullRotationAngle(
            currentMeas.concentration,
            currentMeas.tubeLength,
            currentMeas.temperature
        );
    }

    // ==================== 测量组管理 ====================

    /**
     * 开始新一组测量
     * 在 COMPLETED 状态下可继续添加新测量；其他状态下创建初始测量组
     *
     * @public
     * @returns {Object} 新创建的测量组对象
     */
    addMeasurement() {
        const newMeas = this._createMeasurement();
        this._data.measurements.push(newMeas);
        this._data.currentMeasurementId = newMeas.id;

        // 如果是首次添加且处于 IDLE 状态，自动进入准备状态
        if (this._currentState === ExperimentState.IDLE ||
            this._currentState === ExperimentState.COMPLETED) {
            // 不自动改变状态，等待用户点击开始
        }

        this._notifyDataUpdate();
        return newMeas;
    }

    /**
     * 重置全部状态和数据
     * 将实验恢复到初始状态
     *
     * @public
     */
    reset() {
        const oldState = this._currentState;
        this._currentState = ExperimentState.IDLE;
        this._data = this._createEmptyData();
        this._measurementCounter = 0;

        // 创建初始测量组
        this.addMeasurement();

        // 触发状态变更回调
        if (oldState !== ExperimentState.IDLE) {
            try {
                this._callbacks.onStateChange(oldState, ExperimentState.IDLE);
            } catch (e) {
                console.warn('[experiment-core] onStateChange 回调执行出错:', e);
            }
        }

        this._notifyDataUpdate();
    }

    // ==================== 数据导出与持久化 ====================

    /**
     * 导出实验数据为 JSON 字符串
     * 用于 sessionStorage 存储或外部传输
     *
     * @public
     * @param {boolean} [pretty=false] - 是否格式化输出
     * @returns {string} JSON 字符串
     */
    exportData(pretty = false) {
        try {
            const data = this.getExperimentData();
            return pretty
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);
        } catch (e) {
            this._notifyError(`数据导出失败: ${e.message}`);
            return '{}';
        }
    }

    /**
     * 将完整实验数据保存到 sessionStorage
     *
     * @public
     * @returns {boolean} 是否保存成功
     */
    saveToSession() {
        try {
            const data = this.exportData();
            sessionStorage.setItem(SESSION_STORAGE_KEY, data);
            return true;
        } catch (e) {
            this._notifyError(`保存到 SessionStorage 失败: ${e.message}`);
            return false;
        }
    }

    /**
     * 从 sessionStorage 恢复实验数据
     *
     * @public
     * @returns {boolean} 是否恢复成功
     */
    loadFromSession() {
        try {
            const dataStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (!dataStr) {
                this._notifyError('SessionStorage 中没有找到实验数据');
                return false;
            }

            const data = JSON.parse(dataStr);

            // 验证基本结构
            if (!data || typeof data !== 'object') {
                this._notifyError('SessionStorage 中的数据格式无效');
                return false;
            }

            // 恢复数据
            this._data = data;
            this._currentState = data.currentState || ExperimentState.IDLE;

            // 更新计数器以避免 ID 冲突
            if (data.measurements && data.measurements.length > 0) {
                const maxId = Math.max(...data.measurements.map(m => m.id));
                this._measurementCounter = maxId;
            }

            this._notifyDataUpdate();
            return true;
        } catch (e) {
            this._notifyError(`从 SessionStorage 恢复数据失败: ${e.message}`);
            return false;
        }
    }

    /**
     * 清除 sessionStorage 中的实验数据
     *
     * @public
     * @returns {boolean} 是否清除成功
     */
    clearSession() {
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            return true;
        } catch (e) {
            this._notifyError(`清除 SessionStorage 失败: ${e.message}`);
            return false;
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 执行等亮判定检查
     * 通过 PhysicsEngine.checkEquibrightness 进行判定，并通过回调通知 UI
     *
     * @public
     * @param {number} analyzerAngle - 检偏器角度（度）
     * @param {number} [tolerance=3] - 等亮容差（灰度级）
     * @returns {Object} 等亮判定结果
     */
    checkEquibrightness(analyzerAngle, tolerance = 3) {
        const solutionRotation = this.getComputedRotationAngle();
        const delta = this._data.config.deltaAngle;

        let result;
        if (typeof PhysicsEngine !== 'undefined' && PhysicsEngine.checkEquibrightness) {
            result = PhysicsEngine.checkEquibrightness(analyzerAngle, solutionRotation, delta, tolerance);
        } else {
            // 降级处理：简单比较
            result = {
                isEquibright: Math.abs(analyzerAngle - solutionRotation) < tolerance,
                diff: Math.abs(analyzerAngle - solutionRotation),
                brightnessMid: 128,
                brightnessSides: 128,
                hint: 'PhysicsEngine 不可用，使用简化判定'
            };
        }

        // 如果达到等亮，触发回调
        if (result.isEquibright) {
            try {
                this._callbacks.onEquibright(result);
            } catch (e) {
                console.warn('[experiment-core] onEquibright 回调执行出错:', e);
            }
        }

        return result;
    }

    /**
     * 获取实验进度摘要
     *
     * @public
     * @returns {Object} 进度信息对象
     */
    getProgressSummary() {
        const totalMeasurements = this._data.measurements.length;
        const completedMeasurements = this.getCompletedMeasurements().length;

        return {
            currentState: this._currentState,
            stateName: this.getStateName(this._currentState),
            totalMeasurements,
            completedMeasurements,
            progressPercent: totalMeasurements > 0
                ? Math.round((completedMeasurements / totalMeasurements) * 100)
                : 0,
            hasCalibration: this._data.calibration.A0 !== null
        };
    }

    /**
     * 获取状态的中文显示名称
     *
     * @public
     * @param {string} state - 状态枚举值
     * @returns {string} 中文状态名称
     */
    getStateName(state) {
        const names = {
            [ExperimentState.IDLE]: '待开始',
            [ExperimentState.ZERO_CALIBRATION]: '零点校准',
            [ExperimentState.SUBSTANCE_INTRODUCED]: '已放入溶液',
            [ExperimentState.RE_ADJUSTING]: '再次调等亮',
            [ExperimentState.COMPLETED]: '测量完成'
        };
        return names[state] || '未知状态';
    }

    /**
     * 发送数据到分析模块
     * 准备将当前所有测量数据用于后续的数据分析和图表绘制
     *
     * @public
     * @returns {Object} 可用于分析的数据集
     */
    sendToAnalysis() {
        const measurements = this.getCompletedMeasurements();

        if (measurements.length === 0) {
            this._notifyError('没有已完成的测量数据可供分析');
            return null;
        }

        // 整理为分析友好的格式
        const analysisData = {
            points: measurements.map(m => ({
                x: m.concentration,
                y: m.deltaA,
                temperature: m.temperature,
                tubeLength: m.tubeLength,
                id: m.id
            })),
            config: { ...this._data.config },
            calibration: { ...this._data.calibration },
            studentInfo: { ...this._data.studentInfo },
            measurementCount: measurements.length
        };

        return analysisData;
    }
}

// ==================== 模块导出 ====================

// 支持不同模块系统
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = {
        ExperimentStateMachine,
        ExperimentState
    };
}
