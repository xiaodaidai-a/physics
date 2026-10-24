/**
 * 数据分析页面 JavaScript — 教科书式教学平台 v4
 * 四大模块：演算核对 / 物理图表 / 误差自查 / 成绩评定
 *
 * DOM 结构匹配：pages/data-analysis.html (重构版)
 */

// ==================== 全局变量 ====================
var fitChartInstance = null;
var histogramChartInstance = null;
var radarChartInstance = null;
var experimentData = null;
var cachedRegression = null;

// 标准比旋光度（蔗糖，D线，20°C）
var STANDARD_SPECIFIC_ROTATION = 66.37;

// ==================== 全局色彩常量 ====================
var DA_COLORS = {
    // 模块一（蓝）— 数据核对
    blue: '#3B82F6',
    blueHover: '#60A5FA',
    blue300: '#93C5FD',
    blue400: '#60A5FA',
    // 模块二（青）— 图表可视化
    cyan: '#06B6D4',
    cyanLight: '#67E8F9',
    // 模块三（琥珀）— 诊断
    amber: '#F59E0B',
    amberLight: '#FBBF24',
    // 模块四（紫）— 评定
    purple: '#8B5CF6',
    purpleLight: '#A78BFA',
    // 功能色
    success: '#16A34A',
    error: '#DC2626',
    neutral: '#52525B',
    // 文字与背景
    textPrimary: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#64748B',
    border: '#E2E8F0',
    panelBg: '#FFFFFF',
    primaryBg: '#F8FAFC'
};

// ==================== 字体常量 ====================
var FONT_MONO = "'Cascadia Code','JetBrains Mono','Consolas','monospace'";
var FONT_SANS = '"Segoe UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

// ==================== 思考题库 ====================
var THEORY_QUESTIONS = [
    {
        question: "为什么本实验采用<strong>三分视场法</strong>而不是单视场消光法来测定旋光角？",
        hint: "提示：从人眼对亮度微小变化的敏感度和半荫片的原理入手分析。",
        referenceAnswer: "三分视场法的核心优势在于利用人眼对相邻区域亮度差异的高灵敏度。半荫片将视场分为左右两个偏振方向略有差异的区域，当检偏器旋转到某一位置时，三部分亮度一致，此时人眼能以最高精度判断消光位置，精度可达 ±0.01°~0.02°。而单视场消光法仅凭整体亮度最暗来判断，人眼对绝对亮度的微小变化远不如对相对亮度差异敏感，因此测量精度较低。"
    },
    {
        question: "若将光源钠光灯(D线589.3nm)更换为He-Ne激光器(632.8nm)，测得的比旋光度会如何变化？为什么？",
        hint: "提示：考虑旋光色散规律。",
        referenceAnswer: "根据旋光色散规律（Drude 公式），物质的比旋光度与波长的平方近似成反比：[α] ∝ 1/λ²。当波长从 589.3nm 增加到 632.8nm 时，波长增大约 7.3%，因此测得的比旋光度会减小约 13%~15%。具体而言，蔗糖在 632.8nm 下的比旋光度约为 52°~55°·mL/(dm·g)，明显低于钠 D 线下的标准值 66.37°·mL/(dm·g)。"
    },
    {
        question: "实验中为什么要<strong>分别测定零点 A₀ 和溶液读数 A</strong>，而不是直接读取旋光角？",
        hint: "提示：考虑仪器零点漂移和系统误差的消除。",
        referenceAnswer: "零点校准是消除系统误差的关键步骤。旋光仪的光学系统（包括起偏器、检偏器、半荫片等）存在机械安装误差和光学元件的不完美性，导致即使不放样品时\u201C完全消光\u201D的位置也不在刻度盘的 0° 处。若不测定零点 A₀ 而直接读取旋光角，所有测量值都会携带一个恒定的系统偏差 ΔA₀。通过分别测定 A₀ 和溶液读数 A，再计算 ΔA = |A - A₀|，可以有效消除这一系统误差，确保测量结果仅反映样品本身的旋光特性。"
    },
    {
        question: "蔗糖溶液的比旋光度随温度升高而降低，其物理本质是什么？",
        hint: "提示：从分子结构和光学活性的温度依赖性角度分析。",
        referenceAnswer: "蔗糖分子的手性结构决定了其旋光能力。温度升高时，蔗糖分子热运动加剧，分子间氢键网络被破坏，分子构象的平均取向发生变化。更重要的是，水作为溶剂的折射率随温度升高而降低（dn/dT < 0），根据 Lorentz-Lorenz 方程，溶质分子感受到的有效电场发生变化，导致其旋光本领下降。实验数据表明，蔗糖比旋光度的温度系数约为 -0.02°/(°C·dm)，即每升高 1°C，每分米管长的旋光角减小约 0.02°。"
    }
];

// 当前题目索引（0~3，对应4道题）
var currentQuestionIndex = 0;

// 每道题的作答记录 { idx: string }
var questionAnswers = {};

// 演算核对状态记录
var calcRowStates = []; // 每行 { correct: bool|null, userValue: number|null, systemValue: number }

// ==================== 页面入口 ====================
document.addEventListener('DOMContentLoaded', function() {
    try {
        initAnalysisPage();
    } catch(e) {
        console.error('[数据分析] 初始化失败:', e);
        showNoDataWarning();
    }
});

/**
 * 页面入口主函数 — 统一调度全部模块初始化
 */
function initAnalysisPage() {
    if (typeof Chart === 'undefined') {
        console.error('[数据分析] Chart.js 未加载！图表无法渲染');
    }

    var data = loadExperimentData();

    if (!data) {
        showNoDataWarning();
        return;
    }

    // 显示学生信息弹窗
    showStudentInfoModal(function() {
        // 按顺序初始化四大模块
        renderOverview();
        renderCalcTable(data);
        computeRegression(data.measurements);
        renderFitChart();
        renderHistogramChart();
        renderFormulaBoard();
        renderFitSummary();
        checkErrorTrigger();
        initSelfCheckListeners();

        // 模块四：课后思考与成绩评定（增强版）
        restoreAllQuestionAnswers();     // 恢复所有作答记录
        switchQuestion(0);              // 加载第1题
        populateSummaryCard();          // 填充数据摘要卡
        initSelfCheck();                // 初始化知识点自评表
        restoreReflection();            // 恢复心得体会
        bindReflectionInput();          // 绑定心得字数监听
        initRadarChart();               // 渲染雷达图

        console.log('[数据分析] 全部模块初始化完成');
    });
}

// ==================== 一、数据加载与工具函数 ====================

/**
 * 从 localStorage 读取实验数据
 * 若无数据则生成模拟演示数据（5组浓度梯度）
 * @returns {Object|null} 实验数据对象
 */
function loadExperimentData() {
    try {
        var rawData = localStorage.getItem('polarimeter_experiment_data');

        if (!rawData) {
            console.warn('[数据分析] localStorage 中未找到实验数据，生成模拟演示数据...');
            experimentData = generateDemoData();
            return experimentData;
        }

        experimentData = JSON.parse(rawData);

        if (!experimentData || !experimentData.measurements || !Array.isArray(experimentData.measurements)) {
            console.warn('[数据分析] 数据格式异常，使用模拟数据');
            experimentData = generateDemoData();
            return experimentData;
        }

        if (experimentData.measurements.length < 1) {
            console.warn('[数据分析] 测量数据为空，使用模拟数据');
            experimentData = generateDemoData();
            return experimentData;
        }

        // 确保 deltaA 字段存在
        experimentData.measurements.forEach(function(m) {
            if (m.deltaA == null && m.A0 != null && m.A != null) {
                m.deltaA = Math.abs(m.A - m.A0);
            }
        });

        console.log('[数据分析] 成功加载 ' + experimentData.measurements.length + ' 组测量数据');
        return experimentData;

    } catch(error) {
        console.error('[数据分析] 数据解析异常:', error.message || error);
        experimentData = generateDemoData();
        return experimentData;
    }
}

/**
 * 生成模拟演示数据（5组浓度梯度）
 * @returns {Object} 模拟实验数据
 */
function generateDemoData() {
    var baseDate = new Date().toLocaleDateString('zh-CN');

    // 生成合理的蔗糖旋光实验数据
    // 斜率 k ≈ 13.35 (对应 [α]=66.37, L=2dm)
    var concentrations = [0.05, 0.10, 0.15, 0.20, 0.25];
    var trueSlope = 13.35;
    var trueIntercept = -0.008; // 近似过原点但微偏
    var measurements = [];

    concentrations.forEach(function(c, i) {
        var trueDeltaA = trueSlope * c + trueIntercept;
        // 加入微小的随机噪声 ±0.01~0.03°
        var noise = (Math.random() - 0.5) * 0.04;
        var actualDeltaA = trueDeltaA + noise;
        var A0 = (Math.random() - 0.5) * 0.04; // 零点小偏移
        var A = A0 + actualDeltaA;

        measurements.push({
            concentration: c,
            A0: parseFloat(A0.toFixed(4)),
            A: parseFloat(A.toFixed(4)),
            deltaA: parseFloat(actualDeltaA.toFixed(4)),
            rotationAngle: parseFloat(actualDeltaA.toFixed(4)), // 兼容旧字段名
            tubeLength: 2.0,
            temperature: 20.0 + (Math.random() - 0.5) * 2
        });
    });

    return {
        studentName: '张三',
        studentId: '20250001',
        date: baseDate,
        halfShadeAngle: 4.0,
        wavelength: 589.3,
        tubeLength: 2.0,
        measurements: measurements
    };
}

/**
 * 显示无数据警告 UI
 */
function showNoDataWarning() {
    var warningEl = document.getElementById('no-data-warning');
    var containerEl = document.getElementById('analysis-container');
    if (warningEl) warningEl.style.display = 'block';
    if (containerEl) containerEl.style.display = 'none';
}

/**
 * 安全设置元素 textContent
 */
function setTextContent(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ==================== 二、学生信息弹窗 ====================

/**
 * 显示学生信息录入弹窗
 * @param {Function} callback - 确认后的回调
 */
function showStudentInfoModal(callback) {
    var modal = document.getElementById('student-info-modal');
    if (!modal) {
        if (callback) callback();
        return;
    }

    var nameInput = document.getElementById('input-student-name');
    var idInput = document.getElementById('input-student-id');

    if (nameInput && experimentData && experimentData.studentName) {
        nameInput.value = experimentData.studentName;
    } else if (nameInput) {
        nameInput.value = '张三';
    }
    if (idInput && experimentData && experimentData.studentId) {
        idInput.value = experimentData.studentId;
    } else if (idInput) {
        idInput.value = '123';
    }

    modal.style.display = 'flex';

    window._studentInfoCallback = callback;

    var handleEnter = function(e) {
        if (e.key === 'Enter') confirmStudentInfo();
    };
    if (nameInput) nameInput.addEventListener('keydown', handleEnter);
    if (idInput) idInput.addEventListener('keydown', handleEnter);
}

/**
 * 确认学生信息并关闭弹窗
 */
function confirmStudentInfo() {
    var nameInput = document.getElementById('input-student-name');
    var idInput = document.getElementById('input-student-id');
    var modal = document.getElementById('student-info-modal');

    var name = (nameInput ? nameInput.value.trim() : '') || '张三';
    var id = (idInput ? idInput.value.trim() : '') || '123';

    if (experimentData) {
        experimentData.studentName = name;
        experimentData.studentId = id;
        try {
            localStorage.setItem('polarimeter_experiment_data', JSON.stringify(experimentData));
        } catch(e) {}
    }

    if (modal) modal.style.display = 'none';

    if (window._studentInfoCallback) {
        window._studentInfoCallback();
        window._studentInfoCallback = null;
    }

    console.log('[数据分析] 学生信息已确认：' + name + ' / ' + id);
}

// ==================== 三、概览横条渲染 ====================

/**
 * 渲染概览横条 — 填充 7 个数据项
 */
function renderOverview() {
    if (!experimentData) return;

    setTextContent('student-name', experimentData.studentName || '\u2014');
    setTextContent('student-id', experimentData.studentId || '\u2014');
    setTextContent('experiment-date', experimentData.date || new Date().toLocaleDateString('zh-CN'));
    setTextContent('half-shade-angle', (experimentData.halfShadeAngle || '4.0') + '\u00B0');
    setTextContent('wavelength', (experimentData.wavelength || '589.3') + ' nm');
    setTextContent('tube-length', (experimentData.tubeLength || '2.0') + ' dm');

    var countEl = document.getElementById('measurement-count');
    if (countEl) {
        var targetCount = experimentData.measurements ? experimentData.measurements.length : 0;
        countUp(countEl, 0, targetCount, 600, ' \u7EC4');
    }
}

/**
 * 数值计数动画（从 start 递增到 end）
 * @param {HTMLElement} el - 目标元素
 * @param {number} start - 起始值
 * @param {number} end - 结束值
 * @param {number} duration - 动画时长 ms
 * @param {string} suffix - 后缀文字
 */
function countUp(el, start, end, duration, suffix) {
    if (!el) return;
    suffix = suffix || '';
    var startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        // easeOutCubic
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(start + (end - start) * eased);
        el.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

// ==================== 四、模块一：原始数据与演算核对 ====================

/**
 * 渲染计算表格（含手动输入框）
 * 列：序号 | 浓度 c | A₀(零点) | A(末读数) | 你的ΔA(input) | 系统值 | 状态
 * @param {Object} data - 实验数据对象
 */
function renderCalcTable(data) {
    var tbody = document.getElementById('calcTableBody');
    if (!tbody || !data || !data.measurements) return;

    tbody.innerHTML = '';
    calcRowStates = [];

    var measurements = data.measurements;

    for (var i = 0; i < measurements.length; i++) {
        var m = measurements[i];
        var systemDeltaA = m.deltaA != null ? m.deltaA.toFixed(4) : '\u2014';

        calcRowStates.push({
            correct: null,
            userValue: null,
            systemValue: parseFloat(m.deltaA)
        });

        var tr = document.createElement('tr');
        tr.style.animationDelay = (i * 0.05) + 's';
        tr.innerHTML =
            '<td>' + (i + 1) + '</td>' +
            '<td>' + (m.concentration != null ? m.concentration.toFixed(4) : '\u2014') + '</td>' +
            '<td>' + (m.A0 != null ? m.A0.toFixed(4) : '\u2014') + '</td>' +
            '<td>' + (m.A != null ? m.A.toFixed(4) : '\u2014') + '</td>' +
            '<td class="col-input"><input type="text" class="calc-input pending" data-row="' + i + '" placeholder="\u2014" autocomplete="off"></td>' +
            '<td class="col-highlight">' + systemDeltaA + '</td>' +
            '<td class="calc-status-cell" id="calcStatus_' + i + '">\u2014</td>';

        tbody.appendChild(tr);
    }

    // 为每个输入框绑定 blur 事件（单行实时验证）
    var inputs = tbody.querySelectorAll('.calc-input');
    inputs.forEach(function(input) {
        input.addEventListener('blur', function() {
            var rowIdx = parseInt(this.getAttribute('data-row'), 10);
            var val = this.value.trim();
            verifySingleRow(rowIdx, val);
        });

        // 回车触发验证
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    });
}

/**
 * 单行实时验证（input blur 时触发）
 * @param {number} rowIndex - 行号（从0开始）
 * @param {string} inputVal - 用户输入值字符串
 */
function verifySingleRow(rowIndex, inputVal) {
    if (rowIndex < 0 || rowIndex >= calcRowStates.length) return;

    var input = document.querySelector('.calc-input[data-row="' + rowIndex + '"]');
    var statusCell = document.getElementById('calcStatus_' + rowIndex);

    if (!input || !statusCell) return;

    if (inputVal === '' || inputVal == null) {
        // 未填写
        input.className = 'calc-input pending';
        statusCell.innerHTML = '<span class="status-icon status-icon-pending">\u25CB</span>';
        calcRowStates[rowIndex].correct = null;
        calcRowStates[rowIndex].userValue = null;
        updateCalcVerifyMsg();
        return;
    }

    var parsedVal = parseFloat(inputVal);
    if (isNaN(parsedVal)) {
        input.className = 'calc-input wrong';
        statusCell.innerHTML = '<span class="status-icon status-icon-wrong">&#10007;</span>';
        calcRowStates[rowIndex].correct = false;
        calcRowStates[rowIndex].userValue = NaN;
        updateCalcVerifyMsg();
        return;
    }

    var systemVal = calcRowStates[rowIndex].systemValue;
    var diff = Math.abs(parsedVal - systemVal);
    var tolerance = 0.05;

    calcRowStates[rowIndex].userValue = parsedVal;

    if (diff <= tolerance) {
        input.className = 'calc-input correct';
        statusCell.innerHTML = '<span class="status-icon status-icon-correct">&#10003;</span>';
        calcRowStates[rowIndex].correct = true;
    } else {
        input.className = 'calc-input wrong';
        statusCell.innerHTML = '<span class="status-icon status-icon-wrong">&#10007;</span>';
        calcRowStates[rowIndex].correct = false;
    }

    updateCalcVerifyMsg();
    refreshRadarChart(); // 更新雷达图中的实操分数
}

/**
 * 更新验证消息区统计文本
 */
function updateCalcVerifyMsg() {
    var msgEl = document.getElementById('calcVerifyMsg');
    if (!msgEl) return;

    var total = calcRowStates.length;
    var correctCount = 0;
    var verifiedCount = 0;

    for (var i = 0; i < calcRowStates.length; i++) {
        if (calcRowStates[i].correct !== null) verifiedCount++;
        if (calcRowStates[i].correct === true) correctCount++;
    }

    if (verifiedCount === 0) {
        msgEl.textContent = '请逐行填写你计算的旋光角，然后点击验证。';
        msgEl.className = 'calc-verify-msg';
    } else if (correctCount === total) {
        msgEl.textContent = '\u2705 全部正确！' + correctCount + '/' + total + ' 行验证通过（容差 \u00B10.05\u00B0）';
        msgEl.className = 'calc-verify-msg success flash-success';
        // 移除 flash 类以便下次可重新触发
        setTimeout(function() { msgEl.classList.remove('flash-success'); }, 400);
    } else {
        msgEl.textContent = '\uD83D\uDCA1 ' + correctCount + '/' + total + ' 行正确，请检查标红的行。';
        msgEl.className = 'calc-verify-msg error';
    }
}

/**
 * 验证全部计算（逐行比对 |A-A0| 与系统值，容差 ±0.05°）
 * 挂载到 window 供 HTML onclick 调用
 */
window.verifyAllCalculations = function() {
    var inputs = document.querySelectorAll('.calc-input');
    var allEmpty = true;

    for (var i = 0; i < inputs.length; i++) {
        var val = inputs[i].value.trim();
        if (val !== '' && val != null) {
            allEmpty = false;
            var rowIdx = parseInt(inputs[i].getAttribute('data-row'), 10);
            verifySingleRow(rowIdx, val);
        }
    }

    if (allEmpty) {
        var msgEl = document.getElementById('calcVerifyMsg');
        if (msgEl) {
            msgEl.textContent = '\u26A0\ufe0f 尚未填写任何数据，请先完成各行的 \u0394A 计算。';
            msgEl.className = 'calc-verify-msg error';
        }
    }

    console.log('[数据分析] 验证全部计算完成');
};

/**
 * 自动填入参考值（用于演示/跳过）
 * 挂载到 window 供 HTML onclick 调用
 */
window.autoFillCalculations = function() {
    var inputs = document.querySelectorAll('.calc-input');

    for (var i = 0; i < inputs.length; i++) {
        var rowIdx = parseInt(inputs[i].getAttribute('data-row'), 10);
        if (rowIdx >= 0 && rowIdx < calcRowStates.length && calcRowStates[rowIdx] !== undefined) {
            var sysVal = calcRowStates[rowIdx].systemValue;
            if (!isNaN(sysVal)) {
                inputs[i].value = sysVal.toFixed(4);
                verifySingleRow(rowIdx, sysVal.toFixed(4));
            }
        }
    }

    console.log('[数据分析] 已自动填入参考值');
};

// ==================== 五、线性回归计算 ====================

/**
 * 最小二乘法线性回归
 * @param {number[]} xArr - 自变量数组
 * @param {number[]} yArr - 因变量数组
 * @returns {{ k:number, b:number, r2:number, predict:function, stdError:number }}
 */
function linearRegression(xArr, yArr) {
    var n = xArr.length;

    if (n < 2) {
        return { k: 0, b: 0, r2: 0, predict: function(x) { return 0; }, stdError: 0 };
    }

    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (var i = 0; i < n; i++) {
        sumX += xArr[i];
        sumY += yArr[i];
        sumXY += xArr[i] * yArr[i];
        sumX2 += xArr[i] * xArr[i];
        sumY2 += yArr[i] * yArr[i];
    }

    var denominator = n * sumX2 - sumX * sumX;

    var k = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    var b = (sumY - k * sumX) / n;

    var meanY = sumY / n;
    var ssRes = 0, ssTot = 0;

    for (var j = 0; j < n; j++) {
        var predicted = k * xArr[j] + b;
        ssRes += (yArr[j] - predicted) * (yArr[j] - predicted);
        ssTot += (yArr[j] - meanY) * (yArr[j] - meanY);
    }

    var r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;
    var stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

    return {
        slope: k,
        intercept: b,
        rSquared: r2,
        stdError: stdError,
        predict: function(x) { return k * x + b; }
    };
}

/**
 * 执行线性回归并缓存结果
 * @param {Array} measurements - 测量数组
 * @returns {Object} 回归结果
 */
function computeRegression(measurements) {
    if (!measurements || measurements.length < 2) {
        cachedRegression = { slope: 0, intercept: 0, rSquared: 0, stdError: 0 };
        return cachedRegression;
    }

    var xData = measurements.map(function(m) { return m.concentration; });
    var yData = measurements.map(function(m) { return m.deltaA != null ? m.deltaA : m.rotationAngle; });

    var result = linearRegression(xData, yData);

    // 兼容字段名
    result.k = result.slope;
    result.b = result.intercept;

    cachedRegression = result;

    console.log('[数据分析] 回归完成: k=' + result.slope.toFixed(5) +
        ' b=' + result.intercept.toFixed(5) + ' R\u00B2=' + result.rSquared.toFixed(6));

    return result;
}

/**
 * 获取缓存的回归结果
 * @returns {Object}
 */
function getRegressionResult() {
    if (!cachedRegression && experimentData && experimentData.measurements) {
        return computeRegression(experimentData.measurements);
    }
    return cachedRegression || { slope: 0, intercept: 0, rSquared: 0, stdError: 0, k: 0, b: 0 };
}

// ==================== 六、模块二：经典物理图表 ====================

/**
 * 渲染拟合散点图（坐标纸风格）
 * Chart.js scatter 类型，三图层：置信区间(order:0) → 拟合线(order:1) → 散点(order:2)
 */
function renderFitChart() {
    try {
        var canvas = document.getElementById('fitChart');
        if (!canvas) {
            console.error('[数据分析] fitChart Canvas 不存在');
            return;
        }
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (typeof Chart === 'undefined') {
            console.error('[数据分析] Chart.js 未定义');
            return;
        }

        var reg = getRegressionResult();
        var measurements = experimentData.measurements;

        // 散点数据
        var scatterData = measurements.map(function(m) {
            return { x: m.concentration, y: m.deltaA != null ? m.deltaA : m.rotationAngle };
        });

        // 拟合直线（延伸至数据范围外 5%）
        var xVals = measurements.map(function(m) { return m.concentration; });
        var xMin = Math.min.apply(null, xVals);
        var xMax = Math.max.apply(null, xVals);
        var xRange = xMax - xMin || 0.1;
        var xPad = xRange * 0.05;
        var lineData = [
            { x: xMin - xPad, y: reg.slope * (xMin - xPad) + reg.intercept },
            { x: xMax + xPad, y: reg.slope * (xMax + xPad) + reg.intercept }
        ];

        // 置信区间带（±2*stdError）
        var stdErr = reg.stdError || 0;
        var bandTop = [
            { x: xMin - xPad, y: reg.slope * (xMin - xPad) + reg.intercept + 2 * stdErr },
            { x: xMax + xPad, y: reg.slope * (xMax + xPad) + reg.intercept + 2 * stdErr }
        ];
        var bandBottom = [
            { x: xMax + xPad, y: reg.slope * (xMax + xPad) + reg.intercept - 2 * stdErr },
            { x: xMin - xPad, y: reg.slope * (xMin - xPad) + reg.intercept - 2 * stdErr }
        ];

        // 销毁旧实例
        if (fitChartInstance) {
            fitChartInstance.destroy();
        }

        fitChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: '95% \u7F6E\u4FE1\u533A\u95F4',
                        data: bandTop.concat(bandBottom),
                        type: 'line',
                        backgroundColor: 'rgba(6,182,212,0.05)',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        fill: true,
                        pointRadius: 0,
                        order: 0,
                        tension: 0
                    },
                    {
                        label: '\u7EBF\u6027\u62DF\u5408  R\u00B2 = ' + reg.rSquared.toFixed(5),
                        data: lineData,
                        type: 'line',
                        borderColor: '#475569',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [],
                        pointRadius: 0,
                        tension: 0,
                        order: 1
                    },
                    {
                        label: '\u5B9E\u6D4B\u6570\u636E\u70B9',
                        data: scatterData,
                        backgroundColor: DA_COLORS.cyan,
                        borderColor: 'rgba(255,255,255,0.3)',
                        borderWidth: 1,
                        pointRadius: 6,
                        hoverRadius: 8,
                        hoverBorderColor: DA_COLORS.cyanLight,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 500,
                    easing: 'linear'
                },
                interaction: {
                    intersect: true,
                    mode: 'nearest'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: FONT_MONO, size: 11 },
                            color: DA_COLORS.textSecondary,
                            boxWidth: 12,
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        titleColor: '#1E293B',
                        bodyColor: '#475569',
                        cornerRadius: 4,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 2) {
                                    return '\u25CF  c = ' + context.parsed.x.toFixed(4) + ' g/mL   |   \u0394A = ' + context.parsed.y.toFixed(4) + '\u00B0';
                                }
                                return context.dataset.label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: '\u6D53\u5EA6 c  (g/mL)',
                            font: { family: FONT_SANS, size: 12, weight: '600' },
                            color: '#64748B',
                            padding: { top: 10, bottom: 6 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)',
                            drawBorder: false,
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#475569',
                            font: { family: FONT_MONO, size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '\u65CB\u5149\u89D2 \u0394A  (\u00B0)',
                            font: { family: FONT_SANS, size: 12, weight: '600' },
                            color: '#64748B',
                            padding: { top: 10, bottom: 6 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)',
                            drawBorder: false,
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#475569',
                            font: { family: FONT_MONO, size: 11 }
                        }
                    }
                }
            }
        });
    } catch(e) {
        console.error('[数据分析] renderFitChart 异常:', e.message || e);
    }
}

/**
 * 渲染误差分布直方图（全新函数）
 * Chart.js bar 类型，展示每个测量点的残差值
 * 残差 > 0 的柱子颜色 cyan(#06B6D4)，残差 < 0 的柱子颜色 slate(#475569)
 */
function renderHistogramChart() {
    try {
        var canvas = document.getElementById('histogramChart');
        if (!canvas) {
            console.error('[数据分析] histogramChart Canvas 不存在');
            return;
        }
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (typeof Chart === 'undefined') {
            console.error('[数据分析] Chart.js 未定义');
            return;
        }

        var reg = getRegressionResult();
        var measurements = experimentData.measurements;

        // 计算残差
        var residuals = [];
        var labels = [];
        var bgColors = [];
        var borderColors = [];

        measurements.forEach(function(m, i) {
            var actual = m.deltaA != null ? m.deltaA : m.rotationAngle;
            var predicted = reg.slope * m.concentration + reg.intercept;
            var resid = actual - predicted;
            residuals.push(resid);
            labels.push(String(i + 1));

            if (resid >= 0) {
                bgColors.push(DA_COLORS.cyan);
                borderColors.push(DA_COLORS.cyan);
            } else {
                bgColors.push('#475569');
                borderColors.push('#475569');
            }
        });

        // 零参考线数据
        var xVals = measurements.map(function(m) { return m.concentration; });
        var xMin = Math.min.apply(null, xVals);
        var xMax = Math.max.apply(null, xVals);
        var xRange = xMax - xMin || 0.1;
        var xPad = xRange * 0.08;
        var zeroLineData = [{ x: 0.5 - xPad, y: 0 }, { x: measurements.length - 0.5 + xPad, y: 0 }];

        // 销毁旧实例
        if (histogramChartInstance) {
            histogramChartInstance.destroy();
        }

        histogramChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '\u96F6\u53C2\u8003\u7EBF',
                        data: new Array(measurements.length).fill(0),
                        borderColor: 'rgba(244,244,245,0.2)',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [5, 3],
                        type: 'line',
                        pointRadius: 0,
                        order: 0
                    },
                    {
                        label: '\u6B8B\u5DEE (\u00B0)',
                        data: residuals,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 2,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 400,
                    easing: 'linear'
                },
                interaction: {
                    intersect: true,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: FONT_MONO, size: 11 },
                            color: DA_COLORS.textSecondary,
                            boxWidth: 12,
                            padding: 14
                        }
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        titleColor: '#1E293B',
                        bodyColor: '#475569',
                        cornerRadius: 4,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 1) {
                                    var sign = context.parsed.y >= 0 ? '+' : '';
                                    return '\u25CF  #' + context.dataLabel + '  \u6B8B\u5DEE = ' + sign + context.parsed.y.toFixed(5) + '\u00B0';
                                }
                                return context.dataset.label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '\u6D4B\u91CF\u5E8F\u53F7',
                            font: { family: FONT_SANS, size: 12, weight: '600' },
                            color: '#64748B',
                            padding: { top: 10, bottom: 6 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#475569',
                            font: { family: FONT_MONO, size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '\u6B8B\u5DEE  (\u00B0)',
                            font: { family: FONT_SANS, size: 12, weight: '600' },
                            color: '#64748B',
                            padding: { top: 10, bottom: 6 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)',
                            drawBorder: false,
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#475569',
                            font: { family: FONT_MONO, size: 11 },
                            callback: function(val) {
                                return typeof val === 'number' ? val.toFixed(3) : val;
                            }
                        }
                    }
                }
            }
        });
    } catch(e) {
        console.error('[数据分析] renderHistogramChart 异常:', e.message || e);
    }
}

/**
 * 渲染动态公式黑板
 * 参数来自全局缓存的回归结果
 */
function renderFormulaBoard() {
    var formulaDisplayEl = document.getElementById('formulaDisplay');
    if (!formulaDisplayEl) {
        console.warn('[公式黑板] formulaDisplay 元素不存在');
        return;
    }

    var reg = getRegressionResult();
    var tubeLength = parseFloat(experimentData.tubeLength) || 2.0;
    var specificRotation = Math.abs(reg.slope / tubeLength);

    var slopeStr = reg.slope.toFixed(2);
    var tubeLenStr = tubeLength.toFixed(1);
    var alphaStr = specificRotation.toFixed(3);
    var absIntercept = Math.abs(reg.intercept).toFixed(4);
    var sign = reg.intercept >= 0 ? '+' : '-';

    var html =
        '$$[\\alpha]_T^\\lambda = \\frac{k}{L} = \\frac{\\mathbf{' + slopeStr +
        '}}{\\mathbf{' + tubeLenStr +
        '}} = \\mathbf{' + alphaStr +
        '}^\\circ \\cdot \\mathrm{mL}/(\\mathrm{g} \\cdot \\mathrm{dm})$$' +
        '<div style="margin-top:14px;font-size:0.84rem;line-height:1.8;">' +
        '<span style="color:#475569;">其中 </span><span style="color:#1E293B;font-weight:700;">k</span><span style="color:#475569;"> = </span>' +
        '<span style="color:#1E293B;font-weight:700;">' + reg.slope.toFixed(4) +
        '</span><span style="color:#475569;"> \u00B7(g/mL)&nbsp;&nbsp;</span>' +
        '<span style="color:#1E293B;font-weight:700;">b</span><span style="color:#475569;"> = </span>' +
        '<span style="color:#1E293B;font-weight:700;">' + absIntercept +
        '</span><span style="color:#475569;"> \u00B0&nbsp;&nbsp;\u62DF\u5408\u65B9\u7A0B: </span>' +
        '<span style="color:#1E293B;font-weight:700;">\u0394A = ' + reg.slope.toFixed(4) + '\u00b7c ' + sign + ' ' + absIntercept + '</span>' +
        '</div>';

    formulaDisplayEl.innerHTML = html;

    // 触发公式黑板淡入动画
    formulaDisplayEl.classList.remove('formula-ready');
    void formulaDisplayEl.offsetWidth; // 强制 reflow 以重启动画
    formulaDisplayEl.classList.add('formula-ready');

    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([formulaDisplayEl]).catch(function(err) {
            console.warn('[公式黑板] MathJax 渲染失败:', err);
        });
    }
}

/**
 * 填充拟合摘要四格：#fitSumK, #fitSumB, #fitSumR2, #fitSumAlpha
 */
function renderFitSummary() {
    var reg = getRegressionResult();
    var tubeLength = parseFloat(experimentData.tubeLength) || 2.0;
    var specificRotation = Math.abs(reg.slope / tubeLength);

    // 填充值并触发数字跳动动画
    var ids = ['fitSumK', 'fitSumB', 'fitSumR2', 'fitSumAlpha'];
    var vals = [reg.slope.toFixed(5), reg.intercept.toFixed(5), reg.rSquared.toFixed(6), specificRotation.toFixed(3)];

    ids.forEach(function(id, idx) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = vals[idx];
            el.classList.remove('updated');
            void el.offsetWidth;
            el.classList.add('updated');
        }
    });
}

// ==================== 七、模块三：误差自我剖析 ====================

/**
 * 检查误差是否超过阈值(5%)，决定是否显示触发横幅
 */
function checkErrorTrigger() {
    var banner = document.getElementById('errorTriggerBanner');
    var triggerValEl = document.getElementById('triggerErrorVal');
    if (!banner) return;

    var reg = getRegressionResult();
    var tubeLength = parseFloat(experimentData.tubeLength) || 2.0;
    var specificRotation = Math.abs(reg.slope / tubeLength);
    var errorPercent = Math.abs((specificRotation - STANDARD_SPECIFIC_ROTATION) / STANDARD_SPECIFIC_ROTATION * 100);

    if (errorPercent > 5) {
        banner.classList.add('visible');
        if (triggerValEl) triggerValEl.textContent = errorPercent.toFixed(1) + '%';
    } else {
        banner.classList.remove('visible');
    }
}

/**
 * 初始化 checklist 事件监听
 * 每个 checkbox change 时显示对应解析面板
 * 任一被勾选时显示提交栏
 */
function initSelfCheckListeners() {
    var checkboxes = document.querySelectorAll('.self-check-cb');
    var submitBar = document.getElementById('selfCheckSubmitBar');

    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
            var idx = this.getAttribute('data-index');
            var analysisPanel = document.querySelector('.self-check-analysis[data-index="' + idx + '"]');

            if (analysisPanel) {
                if (this.checked) {
                    analysisPanel.style.display = 'block';
                } else {
                    analysisPanel.style.display = 'none';
                }
            }

            // 检查是否有任何勾选项
            var anyChecked = false;
            checkboxes.forEach(function(c) {
                if (c.checked) anyChecked = true;
            });

            if (anyChecked && submitBar) {
                submitBar.classList.add('visible');
            } else if (submitBar) {
                submitBar.classList.remove('visible');
            }
        });
    });
}

/**
 * 提交自查报告
 * 收集所有勾选项 index，显示反馈消息到 #selfCheckResult
 * 挂载到 window 供 HTML onclick 调用
 */
window.submitSelfReflection = function() {
    var checkboxes = document.querySelectorAll('.self-check-cb:checked');
    var resultEl = document.getElementById('selfCheckResult');
    if (!resultEl) return;

    if (checkboxes.length === 0) {
        resultEl.textContent = '\u26A0\ufe0f 请至少勾选一项后再提交。';
        resultEl.style.color = DA_COLORS.amber;
        return;
    }

    var selectedItems = [];
    checkboxes.forEach(function(cb) {
        selectedItems.push(parseInt(cb.getAttribute('data-index'), 10));
    });

    var errorLabels = [
        '\u96F6\u70B9\u6821\u51C6\u4E0D\u51C6',
        '\u65CB\u5149\u7BA1\u6C14\u6CE1',
        '\u6E29\u5EA6\u8865\u507F\u7F3A\u5931',
        '\u6D53\u5EA6\u914D\u5236\u8BEF\u5DEE',
        '\u89C6\u5DEE/\u4F30\u8BFB\u504F\u5DEE'
    ];

    var selectedLabels = selectedItems.map(function(idx) {
        return errorLabels[idx] || ('\u9879\u76EE' + (idx + 1));
    });

    resultEl.innerHTML = '\u2705 已提交自查报告，共识别 ' + selectedItems.length + ' 项可能原因：' +
        '<span style="color:' + DA_COLORS.amberLight + ';font-weight:600;">' + selectedLabels.join('、') + '</span>';
    resultEl.style.color = DA_COLORS.success;

    console.log('[数据分析] 自查报告已提交，勾选项:', selectedItems);
};

// ==================== 八、模块四：课后思考与成绩评定 ====================

/**
 * 切换思考题（多题模式）
 * @param {number} idx - 题目索引 0~3
 */
window.switchQuestion = function(idx) {
    if (idx < 0 || idx >= THEORY_QUESTIONS.length) return;

    var qTextEl = document.getElementById('questionText');
    var answerEl = document.getElementById('questionAnswer');
    var hintBox = document.getElementById('questionHintBox');
    var hintTxt = document.getElementById('questionHintText');
    if (!qTextEl) return;

    // 先保存当前题作答
    saveCurrentAnswerSilent();

    // 切换到目标题
    currentQuestionIndex = idx;
    var q = THEORY_QUESTIONS[idx];

    // 更新题签激活态
    var tabs = document.querySelectorAll('.q-tab');
    for (var t = 0; t < tabs.length; t++) {
        tabs[t].classList.remove('q-tab-active');
        if (parseInt(tabs[t].getAttribute('data-qidx')) === idx) {
            tabs[t].classList.add('q-tab-active');
        }
    }

    // 渲染题目
    qTextEl.innerHTML = q.question;

    // 恢复该题作答（如有）
    if (answerEl) {
        answerEl.value = questionAnswers[idx] || '';
    }

    // 隐藏提示区
    if (hintBox) hintBox.style.display = 'none';

    // 更新字数提示
    updateQuestionCharCount();

    console.log('[数据分析] 已切换到思考题 Q' + (idx + 1));
};

/**
 * 静默保存当前题目答案（切换时调用，无UI反馈）
 */
function saveCurrentAnswerSilent() {
    var answerEl = document.getElementById('questionAnswer');
    if (!answerEl) return;
    var text = answerEl.value.trim();
    if (text) {
        questionAnswers[currentQuestionIndex] = text;
        // 更新题签已答标记
        markTabAsAnswered(currentQuestionIndex);
    }
}

/**
 * 标记某题签为已答状态
 */
function markTabAsAnswered(idx) {
    var tabs = document.querySelectorAll('.q-tab');
    for (var t = 0; t < tabs.length; t++) {
        if (parseInt(tabs[t].getAttribute('data-qidx')) === idx) {
            tabs[t].classList.add('answered');
        }
    }
}

/**
 * 切换提示显示/隐藏
 */
window.toggleQuestionHint = function() {
    var hintBox = document.getElementById('questionHintBox');
    var hintTxt = document.getElementById('questionHintText');
    if (!hintBox || !hintTxt) return;

    var q = THEORY_QUESTIONS[currentQuestionIndex];
    if (!q || !q.hint) return;

    if (hintBox.style.display === 'none') {
        hintTxt.textContent = q.hint;
        hintBox.style.display = 'flex';
    } else {
        hintBox.style.display = 'none';
    }
};

/**
 * 更新思考题字数提示
 */
function updateQuestionCharCount() {
    var answerEl = document.getElementById('questionAnswer');
    var countEl = document.getElementById('questionCharCount');
    if (!answerEl || !countEl) return;
    var len = answerEl.value.trim().length;
    if (len >= 80) {
        countEl.textContent = '已写 ' + len + ' 字 \u2705';
        countEl.style.color = '#16A34A';
    } else {
        countEl.textContent = '已写 ' + len + ' / 80 字';
        countEl.style.color = '';
    }
}

// 监听思考题输入字数变化
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        var qa = document.getElementById('questionAnswer');
        if (qa) qa.addEventListener('input', updateQuestionCharCount);
    }, 100);
});

/**
 * 保存当前题作答（按钮触发）
 * 挂载到 window 供 HTML onclick 调用
 */
window.saveQuestionAnswer = function() {
    var answerEl = document.getElementById('questionAnswer');
    if (!answerEl) return;

    var answerText = answerEl.value.trim();
    if (!answerText) {
        alert('请先填写作答内容');
        return;
    }

    // 保存到内存
    questionAnswers[currentQuestionIndex] = answerText;

    try {
        // 全量持久化所有题目的作答
        localStorage.setItem('polarimeter_question_answers', JSON.stringify({
            answers: questionAnswers,
            savedAt: new Date().toISOString()
        }));

        // 标记题签
        markTabAsAnswered(currentQuestionIndex);

        // 视觉反馈
        var btn = event.target;
        if (btn) {
            var origText = btn.textContent;
            btn.textContent = '\u2705 \u5DF2\u4FDD\u5B58';
            btn.style.color = DA_COLORS.success;
            setTimeout(function() { btn.textContent = origText; btn.style.color = ''; }, 2000);
        }

        refreshRadarChart();
        console.log('[数据分析] 思考题 Q' + (currentQuestionIndex + 1) + ' 作答已保存，字数:', answerText.length);
    } catch(e) {
        console.error('[数据分析] 作答保存失败:', e);
    }
};

/**
 * 从 localStorage 恢复所有作答
 */
function restoreAllQuestionAnswers() {
    try {
        var saved = localStorage.getItem('polarimeter_question_answers');
        if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed.answers) {
                questionAnswers = parsed.answers;
                // 标记所有已答题签
                for (var idx in questionAnswers) {
                    if (questionAnswers[idx]) markTabAsAnswered(parseInt(idx));
                }
            }
        }
    } catch(e) {}
}

/**
 * 填充实验数据摘要卡片
 */
function populateSummaryCard() {
    var reg = getRegressionResult();

    // 样品名称
    setSummaryVal('sum-sample', '\u8518\u7CD6\u6EB4\u6DB2');

    // 测量组数
    var count = calcRowStates.length;
    setSummaryVal('sum-count', count > 0 ? count + ' \u7EC4' : '\u2014');

    // 比旋光度 [α]
    if (reg.slope !== null && reg.slope !== undefined) {
        setSummaryVal('sum-alpha', reg.slope.toFixed(2) + '\xB0\u00B7mL/(dm\u00B7g)');
    }

    // R²
    if (reg.rSquared !== null && reg.rSquared !== undefined) {
        setSummaryVal('sum-r2', reg.rSquared.toFixed(4));
    }

    // 相对误差
    if (reg.slope !== null && reg.slope !== undefined) {
        var theoreticalAlpha = 66.37; // 蔗糖标准比旋光度
        var relError = Math.abs((reg.slope - theoreticalAlpha) / theoreticalAlpha * 100);
        var errEl = document.getElementById('sum-error');
        if (errEl) {
            errEl.textContent = relError.toFixed(1) + '%';
            errEl.style.color = relError < 5 ? '#16A34A' : (relError < 15 ? '#D97706' : '#DC2626');
        }
    }

    // 综合等级
    var scores = computeRadarScores();
    var total = scores.operation + scores.dataProcessing + scores.theory;
    var gradeLabel, gradeClass;
    var avg = total / 3;
    if (avg >= 90) { gradeLabel = 'A \u4F18\u79C0'; gradeClass = 'grade-A'; }
    else if (avg >= 75) { gradeLabel = 'B \u826F\u597D'; gradeClass = 'grade-B'; }
    else if (avg >= 60) { gradeLabel = 'C \u53CA\u683C'; gradeClass = 'grade-C'; }
    else { gradeLabel = 'D \u5F85\u52AA\u529B'; gradeClass = 'grade-D'; }

    var gradeEl = document.getElementById('sum-grade');
    if (gradeEl) {
        gradeEl.innerHTML = '<span class="grade-badge ' + gradeClass + '">' + gradeLabel + '</span>';
    }
}

function setSummaryVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || '\u2014';
}

/**
 * 初始化知识点自评表交互
 */
function initSelfCheck() {
    var checkboxes = document.querySelectorAll('#selfcheckList input[type="checkbox"]');
    // 恢复已保存状态
    try {
        var saved = localStorage.getItem('polarimeter_selfcheck');
        if (saved) {
            var checkedSet = JSON.parse(saved);
            checkboxes.forEach(function(cb) {
                var skill = cb.getAttribute('data-skill');
                if (checkedSet.indexOf(skill) !== -1) cb.checked = true;
            });
        }
    } catch(e) {}

    // 绑定事件 + 更新进度条
    updateSelfCheckProgress();
    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
            updateSelfCheckProgress();
            saveSelfCheckState();
        });
    });
}

function updateSelfCheckProgress() {
    var checkboxes = document.querySelectorAll('#selfcheckList input[type="checkbox"]');
    var checked = document.querySelectorAll('#selfcheckList input[type="checkbox"]:checked');
    var total = checkboxes.length;
    var count = checked.length;

    var progressEl = document.getElementById('selfcheckProgress');
    var barFill = document.getElementById('selfcheckBarFill');

    if (progressEl) progressEl.textContent = '\u5DF2\u638C\u63E1 ' + count + ' / ' + total + ' \u9879';
    if (barFill) barFill.style.width = (total > 0 ? (count / total * 100) : 0) + '%';
}

function saveSelfCheckState() {
    var checked = [];
    document.querySelectorAll('#selfcheckList input[type="checkbox"]:checked').forEach(function(cb) {
        checked.push(cb.getAttribute('data-skill'));
    });
    localStorage.setItem('polarimeter_selfcheck', JSON.stringify(checked));
}

/**
 * 保存心得体会
 */
window.saveReflection = function() {
    var el = document.getElementById('reflectionText');
    if (!el) return;
    var text = el.value.trim();
    if (!text) {
        alert('请先填写心得体会内容');
        return;
    }

    try {
        localStorage.setItem('polarimeter_reflection', JSON.stringify({
            text: text,
            savedAt: new Date().toISOString(),
            charCount: text.length
        }));

        var btn = event.target;
        if (btn) {
            var origText = btn.textContent;
            btn.textContent = '\u2705 \u5DF2\u4FDD\u5B58';
            btn.style.color = DA_COLORS.success;
            setTimeout(function() { btn.textContent = origText; btn.style.color = ''; }, 2000);
        }

        console.log('[数据分析] 心得体会已保存，字数:', text.length);
    } catch(e) {
        console.error('[数据分析] 心得保存失败:', e);
    }
};

/**
 * 更新心得字数统计
 */
function updateReflectionCharCount() {
    var el = document.getElementById('reflectionText');
    var countEl = document.getElementById('reflectionCharCount');
    if (!el || !countEl) return;
    var len = el.value.trim().length;
    if (len >= 100) {
        countEl.textContent = '已写 ' + len + ' 字 \u2705';
        countEl.style.color = '#16A34A';
    } else {
        countEl.textContent = '已写 ' + len + ' / 100 \u5B57';
        countEl.style.color = '';
    }
}

/**
 * 从 localStorage 恢复心得体会
 */
function restoreReflection() {
    try {
        var saved = localStorage.getItem('polarimeter_reflection');
        if (saved) {
            var parsed = JSON.parse(saved);
            var el = document.getElementById('reflectionText');
            if (el && parsed.text) el.value = parsed.text;
        }
    } catch(e) {}
}

/**
 * 绑定心得输入框字数监听
 */
function bindReflectionInput() {
    var el = document.getElementById('reflectionText');
    if (el) {
        el.addEventListener('input', updateReflectionCharCount);
        updateReflectionCharCount(); // 初始更新
    }
}

/**
 * 计算三个维度的分数
 * @returns {{ operation: number, dataProcessing: number, theory: number }}
 */
function computeRadarScores() {
    // 1. 仪器实操：基于 calcTable 验证正确率 × 100
    var totalRows = calcRowStates.length;
    var correctRows = 0;
    var verifiedRows = 0;
    for (var i = 0; i < calcRowStates.length; i++) {
        if (calcRowStates[i].correct !== null) verifiedRows++;
        if (calcRowStates[i].correct === true) correctRows++;
    }
    var operationScore = totalRows > 0 ? Math.round((correctRows / totalRows) * 100) : 0;

    // 2. 数据处理(R²)：R² × 100
    var reg = getRegressionResult();
    var dataProcessingScore = Math.round(reg.rSquared * 100);

    // 3. 理论探究：基于所有已答思考题的总字数（多题模式）
    var theoryScore = 0;
    var totalChars = 0;
    var answeredCount = 0;
    for (var qi = 0; qi < THEORY_QUESTIONS.length; qi++) {
        if (questionAnswers[qi]) {
            totalChars += questionAnswers[qi].trim().length;
            answeredCount++;
        }
    }
    // 基础分：每答一题得20分（最多4题×20=80分）
    // 加分：总字数超过320字(80×4)后，每40字+1分，上限+20
    theoryScore = Math.min(answeredCount * 20, 80);
    if (totalChars >= 320) {
        theoryScore += Math.min(Math.floor((totalChars - 320) / 40), 20);
    }

    return {
        operation: operationScore,
        dataProcessing: dataProcessingScore,
        theory: theoryScore
    };
}

/**
 * 渲染三维雷达图成绩评定（全新函数）
 * 使用 Chart.js radar 类型
 */
function initRadarChart() {
    renderRadarChartInner();
}

/**
 * 内部渲染/更新雷达图的实现
 */
function renderRadarChartInner() {
    try {
        var canvas = document.getElementById('radarChart');
        if (!canvas) {
            console.error('[数据分析] radarChart Canvas 不存在');
            return;
        }
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (typeof Chart === 'undefined') return;

        var scores = computeRadarScores();

        // 销毁旧实例
        if (radarChartInstance) {
            radarChartInstance.destroy();
        }

        radarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['\u4eea\u5668\u5b9e\u64cd', '\u6570\u636e\u5904\u7406(R\u00b2)', '\u7406\u8bba\u63a2\u7a76'],
                datasets: [{
                    label: '\u80FD\u529B\u8bc4\u5206',
                    data: [scores.operation, scores.dataProcessing, scores.theory],
                    backgroundColor: 'rgba(139,92,246,0.12)',
                    borderColor: DA_COLORS.purple,
                    borderWidth: 2,
                    pointBackgroundColor: DA_COLORS.purple,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBorderColor: DA_COLORS.purpleLight
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 500,
                    easing: 'linear'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        titleColor: '#1E293B',
                        bodyColor: '#475569',
                        cornerRadius: 4,
                        padding: 10
                    }
                },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 20,
                            color: '#475569',
                            font: { family: FONT_MONO, size: 10 },
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.08)'
                        },
                        angleLines: {
                            color: 'rgba(0,0,0,0.08)'
                        },
                        pointLabels: {
                            font: { family: FONT_MONO, size: 11 },
                            color: '#475569'
                        }
                    }
                }
            }
        });

        // 同时生成 #radarScoreTable 的 HTML 内容
        renderRadarScoreTable(scores);

    } catch(e) {
        console.error('[数据分析] renderRadarChartInner 异常:', e.message || e);
    }
}

/**
 * 刷新雷达图（不销毁重建，用于分数更新后调用）
 */
function refreshRadarChart() {
    if (!radarChartInstance) return;

    var scores = computeRadarScores();

    radarChartInstance.data.datasets[0].data = [scores.operation, scores.dataProcessing, scores.theory];
    radarChartInstance.update('none'); // 无动画快速更新

    renderRadarScoreTable(scores);
}

/**
 * 渲染 #radarScoreTable 的 HTML 内容（3行分数 + 总分行）
 * @param {{ operation: number, dataProcessing: number, theory: number }} scores
 */
function renderRadarScoreTable(scores) {
    var tableEl = document.getElementById('radarScoreTable');
    if (!tableEl) return;

    var total = Math.round((scores.operation + scores.dataProcessing + scores.theory) / 3);
    var gradeClass, gradeLabel;

    if (total >= 90)      { gradeClass = 'grade-A'; gradeLabel = 'A'; }
    else if (total >= 75) { gradeClass = 'grade-B'; gradeLabel = 'B'; }
    else if (total >= 60) { gradeClass = 'grade-C'; gradeLabel = 'C'; }
    else                  { gradeClass = 'grade-D'; gradeLabel = 'D'; }

    var opColor = scores.operation >= 80 ? DA_COLORS.success : (scores.operation >= 60 ? DA_COLORS.purple : DA_COLORS.error);
    var dpColor = scores.dataProcessing >= 80 ? DA_COLORS.success : (scores.dataProcessing >= 60 ? DA_COLORS.purple : DA_COLORS.error);
    var thColor = scores.theory >= 80 ? DA_COLORS.success : (scores.theory >= 60 ? DA_COLORS.purple : DA_COLORS.error);

    var html =
        '<div class="radar-score-row">' +
            '<span class="radar-score-label">\u4eea\u5668\u5b9e\u64cd</span>' +
            '<div style="flex:1;max-width:120px;margin-left:12px;">' +
                '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + scores.operation + '%;background:' + opColor + ';"></div></div>' +
            '</div>' +
            '<span class="radar-score-val" style="color:' + opColor + ';margin-left:8px;">' + scores.operation + '</span>' +
        '</div>' +
        '<div class="radar-score-row">' +
            '<span class="radar-score-label">\u6570\u636e\u5904\u7406(R\u00b2)</span>' +
            '<div style="flex:1;max-width:120px;margin-left:12px;">' +
                '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + scores.dataProcessing + '%;background:' + dpColor + ';"></div></div>' +
            '</div>' +
            '<span class="radar-score-val" style="color:' + dpColor + ';margin-left:8px;">' + scores.dataProcessing + '</span>' +
        '</div>' +
        '<div class="radar-score-row">' +
            '<span class="radar-score-label">\u7406\u8bba\u63a2\u7a76</span>' +
            '<div style="flex:1;max-width:120px;margin-left:12px;">' +
                '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + scores.theory + '%;background:' + thColor + ';"></div></div>' +
            '</div>' +
            '<span class="radar-score-val" style="color:' + thColor + ';margin-left:8px;">' + scores.theory + '</span>' +
        '</div>' +
        '<div class="radar-score-row radar-total-row">' +
            '<span class="radar-score-label">\u7efc\u5408\u6210\u7ee9</span>' +
            '<span class="radar-total-val">' + total + ' / 100<span class="grade-badge ' + gradeClass + '">' + gradeLabel + '</span></span>' +
        '</div>';

    tableEl.innerHTML = html;
}

// ==================== 九、报告导出功能 ====================

/**
 * 生成并打开完整实验报告预览
 */
function generateReport() {
    if (!experimentData) {
        alert('\u6ca1\u6709\u53ef\u751f\u6210\u62a5\u544a\u7684\u5b9e\u9a8c\u6570\u636e\uff01\u8bf7\u5148\u5b8c\u6210\u5b9e\u9a8c\u3002');
        return;
    }

    try {
        var reg = getRegressionResult();
        var tubeLength = parseFloat(experimentData.tubeLength) || 2.0;
        var specificRotation = Math.abs(reg.slope / tubeLength);
        var relError = Math.abs((specificRotation - STANDARD_SPECIFIC_ROTATION) / STANDARD_SPECIFIC_ROTATION * 100);

        var scores = computeRadarScores();
        var totalScore = Math.round((scores.operation + scores.dataProcessing + scores.theory) / 3);

        // 收集自查项
        var selfChecks = [];
        var checkedCBs = document.querySelectorAll('.self-check-cb:checked');
        checkedCBs.forEach(function(cb) {
            var idx = parseInt(cb.getAttribute('data-index'), 10);
            var panel = document.querySelector('.self-check-analysis[data-index="' + idx + '"]');
            selfChecks.push('\u9879\u76ee' + (idx + 1) + ': ' + (panel ? panel.textContent.replace(/[\s\n]+/g, ' ').trim() : ''));
        });

        // 思考题作答
        var answerEl = document.getElementById('questionAnswer');
        var answerText = answerEl ? answerEl.value.trim() : '';

        var reportHTML = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
            '<title>\u65cb\u5149\u5b9e\u9a8c\u62a5\u544a</title>' +
            '<style>' +
            'body{font-family:"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;max-width:850px;margin:40px auto;padding:20px;line-height:1.8;color:#e4e4e7;background:#18181b;}' +
            'h1{text-align:center;color:#f4f4f5;border-bottom:2px solid #3B82F6;padding-bottom:15px;font-size:1.35rem;}' +
            'h2{color:#3B82F6;margin-top:28px;border-left:3px solid #3B82F6;padding-left:12px;font-size:1.05rem;}' +
            'table{width:100%;border-collapse:collapse;margin:14px 0;}' +
            'th,td{border:1px solid #3f3f46;padding:10px 14px;text-align:center;font-size:0.88rem;color:#d4d4d8;}' +
            'th{background:#27272a;color:#f4f4f5;font-weight:700;}' +
            'tr:nth-child(even){background:rgba(255,255,255,0.02);}' +
            '.equation{display:block;text-align:center;font-size:1.15rem;font-weight:bold;color:#3B82F6;margin:18px 0;' +
            'padding:16px;background:#27272a;border-radius:8px;border:1px solid #3f3f46;}' +
            '.score-card{display:inline-block;padding:6px 16px;margin:4px;background:rgba(59,130,246,0.1);border-radius:6px;color:#f4f4f5;font-family:monospace;}' +
            '.footer{text-align:center;color:#71717a;margin-top:40px;font-size:0.82rem;padding-top:20px;border-top:1px solid #3f3f46;}' +
            '.qa-section{background:#27272a;border:1px solid #3f3f46;border-radius:8px;padding:16px;margin:14px 0;}' +
            '.qa-q{color:#3B82F6;font-weight:700;margin-bottom:8px;}' +
            '.qa-a{color:#d4d4d8;white-space:pre-wrap;line-height:1.7;}' +
            '</style></head><body>' +

            '<h1>\ud83e\uddea \u6db2\u76f8\u65cb\u5149\u865a\u62df\u4eff\u771f\u5b9e\u9a8c\u62a5\u544a</h1>' +

            '<h2>\u4e00\u3001\u57fa\u672c\u4fe1\u606f</h2><table>' +
            '<tr><th>\u9879\u76ee</th><th>\u5185\u5bb9</th></tr>' +
            '<tr><td>\u5b66\u751f\u59d3\u540d</td><td>' + (experimentData.studentName || '\u672a\u586b\u5199') + '</td></tr>' +
            '<tr><td>\u5b66\u53f7</td><td>' + (experimentData.studentId || '\u672a\u586b\u5199') + '</td></tr>' +
            '<tr><td>\u5b9e\u9a8e\u65e5\u671f</td><td>' + (experimentData.date || new Date().toLocaleDateString('zh-CN')) + '</td></tr>' +
            '<tr><td>\u5149\u6e90\u6ce2\u957f</td><td>' + (experimentData.wavelength || '589.3') + ' nm(\u94a0 D \u7ebf)</td></tr>' +
            '<tr><td>\u534a\u8367\u7247\u5939\u89d2</td><td>\u03b4 = ' + (experimentData.halfShadeAngle || 4.0) + '\u00b0</td></tr>' +
            '<tr><td>\u7ba1\u957f L</td><td>' + (experimentData.tubeLength || '2.0') + ' dm</td></tr>' +
            '<tr><td>\u6d4b\u91cf\u7ec4\u6570</td><td>' + (experimentData.measurements ? experimentData.measurements.length : 0) + ' \u7ec4</td></tr>' +
            '</table>' +

            '<h2>\u4e8c\u3001\u539f\u59cb\u6d4b\u91cf\u6570\u636e\u4e0e\u6f14\u7b97\u6838\u5bf9</h2><table>' +
            '<tr><th>\u5e8f\u53f7</th><th>\u6d53\u5ea6 c<br>(g/mL)</th><th>A\u2080 (\u00b0)</th><th>A (\u00b0)</th><th>\u4f60\u7684 \u0394A (\u00b0)</th><th>\u7cfb\u7edf\u503c (\u00b0)</th><th>\u72b6\u6001</th></tr>';

        experimentData.measurements.forEach(function(m, i) {
            var userVal = (calcRowStates[i] && calcRowStates[i].userValue != null) ? calcRowStates[i].userValue.toFixed(4) : '\u2014';
            var isCorrect = (calcRowStates[i] && calcRowStates[i].correct === true);
            var statusText = isCorrect ? '\u2713' : ((calcRowStates[i] && calcRowStates[i].correct === false) ? '\u2717' : '\u2014');
            var statusColor = isCorrect ? '#16a34a' : ((calcRowStates[i] && calcRowStates[i].correct === false) ? '#dc2626' : '');

            reportHTML += '<tr><td>' + (i+1) + '</td><td>' + m.concentration.toFixed(4) +
                '</td><td>' + (m.A0 != null ? m.A0.toFixed(4) : '\u2014') +
                '</td><td>' + (m.A != null ? m.A.toFixed(4) : '\u2014') +
                '</td><td>' + userVal +
                '</td><td style="color:#3B82F6;font-weight:700;">' + (m.deltaA != null ? m.deltaA.toFixed(4) : '\u2014') +
                '</td><td style="color:' + statusColor + ';font-weight:700;">' + statusText + '</td></tr>';
        });

        reportHTML += '</table>';

        var sign = reg.intercept >= 0 ? '+' : '-';
        reportHTML +=
            '<h2>\u4e09\u3001\u7ebf\u6027\u62df\u5408\u5206\u6790</h2>' +
            '<table>' +
            '<tr><th>\u53c2\u6570</th><th>\u6570\u503c</th><th>\u5355\u4f4d</th></tr>' +
            '<tr><td>\u659c\u7387 k</td><td style="font-weight:700;">' + reg.slope.toFixed(5) + '</td><td>\u00b1/(g/mL)</td></tr>' +
            '<tr><td>\u622a\u8ddd b</td><td style="font-weight:700;">' + reg.intercept.toFixed(5) + '</td><td>\u00b0</td></tr>' +
            '<tr><td>\u51b3\u5b9a\u7cfb\u6570 R\u00b2</td><td style="font-weight:700;color:#3B82F6;">' + reg.rSquared.toFixed(6) + '</td><td>\u2014</td></tr>' +
            '<tr><td>\u8ba1\u7b97\u6bd4\u65cb\u5149\u5ea6 [\u03b1]</td><td style="font-weight:700;color:#3B82F6;"><strong>' + specificRotation.toFixed(3) + '</strong></td><td>\u00b1\u00b7mL/(dm\u00b7g)</td></tr>' +
            '<tr><td>\u6807\u51c6\u6bd4\u65cb\u5149\u5ea6</td><td>' + STANDARD_SPECIFIC_ROTATION + '</td><td>\u00b1\u00b7mL/(dm\u00b7g)</td></tr>' +
            '<tr><td>\u76f8\u5bf9\u8bef\u5dee</td><td style="color:' + (relError < 5 ? '#16a34a' : '#dc2626') + ';font-weight:700;">' + relError.toFixed(2) + '%</td><td>\u2014</td></tr>' +
            '</table>' +
            '<span class="equation">[\u03b1]<sub>T</sub><sup>&lambda;</sup> = k/L = ' + reg.slope.toFixed(2) + '/' + tubeLength.toFixed(1) + ' = ' + specificRotation.toFixed(3) + '\u00b0\u00b7mL/(g\u00b7dm)</span>' +
            '<span class="equation" style="margin-top:8px;font-size:0.95rem;color:#a1a1aa;">\u0394A = ' + reg.slope.toFixed(4) + ' \u00b7 c ' + sign + ' ' + Math.abs(reg.intercept).toFixed(4) + '</span>';

        reportHTML += '<h2>\u56db\u3001\u8bef\u5dee\u81ea\u6211\u5256\u6790</h2>';
        if (selfChecks.length > 0) {
            reportHTML += '<ul style="color:#d4d4d8;padding-left:20px;">';
            selfChecks.forEach(function(item) { reportHTML += '<li style="margin:6px 0;">' + item + '</li>'; });
            reportHTML += '</ul>';
        } else {
            reportHTML += '<p style="color:#71717a;">(\u672a\u9009\u62e9\u8bef\u5dee\u9879)</p>';
        }

        reportHTML += '<h2>\u4e94\u3001\u8bfe\u540e\u601d\u8003\u4e0e\u6210\u7ee9\u8bc4\u5b9a</h2>';

        // 思考题（全部已答题目）
        var hasAnyAnswer = false;
        for (var qi = 0; qi < THEORY_QUESTIONS.length; qi++) {
            if (questionAnswers[qi] && questionAnswers[qi].trim()) {
                hasAnyAnswer = true;
                var qObj = THEORY_QUESTIONS[qi];
                reportHTML += '<div class="qa-section" style="margin-bottom:12px;">' +
                    '<div class="qa-q">Q' + (qi + 1) + '. ' + qObj.question.replace(/<[^>]+>/g, '') + '</div>' +
                    '<div class="qa-a">' + questionAnswers[qi].trim() + '</div>' +
                    '</div>';
            }
        }
        if (!hasAnyAnswer) {
            reportHTML += '<p style="color:#71717a;">(\u672a\u4f5c\u7b54\u601d\u8003\u9898)</p>';
        }

        // 知识点自评
        var selfcheckItems = [];
        document.querySelectorAll('#selfcheckList input[type="checkbox"]').forEach(function(cb) {
            var label = cb.parentElement.querySelector('span');
            selfcheckItems.push({
                skill: cb.getAttribute('data-skill'),
                text: label ? label.textContent.trim() : '',
                checked: cb.checked
            });
        });
        if (selfcheckItems.length > 0) {
            reportHTML += '<h3 style="color:#8B5CF6;margin-top:20px;font-size:0.95rem;">\u77e5\u8bc6\u70b9\u638c\u63e1\u81ea\u8bc4</h3><ul style="color:#d4d4d8;padding-left:20px;">';
            selfcheckItems.forEach(function(item) {
                reportHTML += '<li style="margin:4px 0;">' + (item.checked ? '\u2705' : '\u25CB') + ' ' + item.text + '</li>';
            });
            reportHTML += '</ul>';
        }

        // 心得体会
        var reflectionEl = document.getElementById('reflectionText');
        var reflectionText = reflectionEl ? reflectionEl.value.trim() : '';
        if (reflectionText) {
            reportHTML += '<h3 style="color:#8B5CF6;margin-top:20px;font-size:0.95rem;">\u5b9e\u9a8c\u603b\u7ed3\u4e0e\u5fc3\u5f97</h3>' +
                '<div class="qa-section"><div class="qa-a">' + reflectionText + '</div></div>';
        }

        // 成绩
        reportHTML += '<div style="margin-top:16px;text-align:center;">' +
            '<span class="score-card">\u4eea\u5668\u5b9e\u64cd: ' + scores.operation + '</span> ' +
            '<span class="score-card">\u6570\u636e\u5904\u7406: ' + scores.dataProcessing + '</span> ' +
            '<span class="score-card">\u7406\u8bba\u63a2\u7a76: ' + scores.theory + '</span> ' +
            '<span class="score-card" style="background:rgba(59,130,246,0.2);color:#3B82F6;font-weight:700;">\u7efc\u5408: ' + totalScore + '</span>' +
            '</div>';

        reportHTML += '<div class="footer">\u672c\u62a5\u544a\u7531\u300c\u6db2\u76f8\u65cb\u5149\u865a\u62df\u4eff\u771f\u5b9e\u9a8e\u5e73\u53f0\u300d\u81ea\u52a8\u751f\u6210 | ' + new Date().toLocaleString('zh-CN') + '</div></body></html>';

        var win = window.open('', '_blank');
        if (win) {
            win.document.write(reportHTML);
            win.document.close();
        } else {
            alert('\u65e0\u6cd5\u6253\u5f00\u65b0\u7a97\u53e3\uff0c\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u662f\u5426\u963b\u6b62\u4e86\u5f39\u7a97\u3002');
        }

        console.log('[数据分析] 实验报告已生成');

    } catch(e) {
        console.error('[数据分析] generateReport 出错:', e.message || e);
        alert('\u751f\u6210\u62a5\u544a\u5931\u8d25\uff1a' + (e.message || e));
    }
}

/**
 * 导出实验数据为 JSON 文件下载
 */
function exportToJSON() {
    if (!experimentData) {
        alert('\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u5b9e\u9a8c\u6570\u636e\uff01');
        return;
    }

    try {
        var reg = getRegressionResult();
        var scores = computeRadarScores();

        var exportObj = {
            meta: {
                exportTime: new Date().toISOString(),
                platform: '\u6db2\u76f8\u65cb\u5149\u865a\u62df\u4eff\u771f\u5b9e\u9a8c\u5e73\u53f0 v4',
                version: '4.0-textbook-style'
            },
            studentInfo: {
                name: experimentData.studentName || '\u672a\u586b\u5199',
                id: experimentData.studentId || '\u672a\u586b\u5199',
                date: experimentData.date || new Date().toLocaleDateString('zh-CN')
            },
            parameters: {
                halfShadeAngle: experimentData.halfShadeAngle,
                wavelength: experimentData.wavelength,
                tubeLength: experimentData.tubeLength
            },
            regression: {
                slope: reg.slope,
                intercept: reg.intercept,
                rSquared: reg.rSquared,
                specificRotation: Math.abs(reg.slope / (parseFloat(experimentData.tubeLength) || 2.0))
            },
            measurements: experimentData.measurements,
            calculationVerification: calcRowStates.map(function(s, i) {
                return {
                    rowIndex: i,
                    userInput: s.userValue,
                    systemValue: s.systemValue,
                    correct: s.correct
                };
            }),
            assessment: {
                operationScore: scores.operation,
                dataProcessingScore: scores.dataProcessing,
                theoryScore: scores.theory,
                totalScore: Math.round((scores.operation + scores.dataProcessing + scores.theory) / 3)
            },
            selfReflection: {
                knowledgeCheck: (function() {
                    var items = [];
                    document.querySelectorAll('#selfcheckList input[type="checkbox"]:checked').forEach(function(cb) {
                        var label = cb.parentElement.querySelector('span');
                        items.push(label ? label.textContent.trim() : cb.getAttribute('data-skill'));
                    });
                    return items;
                })(),
                reflectionText: (function() {
                    var el = document.getElementById('reflectionText');
                    return el ? el.value.trim() : '';
                })()
            },
            questionAnswers: (function() {
                var result = {};
                for (var qi = 0; qi < THEORY_QUESTIONS.length; qi++) {
                    if (questionAnswers[qi]) {
                        result['Q' + (qi + 1)] = questionAnswers[qi].trim();
                    }
                }
                return result;
            })()
        };

        var jsonStr = JSON.stringify(exportObj, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        var url = URL.createObjectURL(blob);

        var link = document.createElement('a');
        link.href = url;
        link.download = '\u65cb\u5149\u5b9e\u9a8c\u6570\u636e_' + (experimentData.studentName || '\u672a\u77e5') + '_' + new Date().toISOString().slice(0, 10) + '.json';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('[数据分析] JSON 导出成功');
    } catch(e) {
        console.error('[数据分析] 导出失败:', e);
        alert('\u5bfc\u51fa\u5931\u8d25\uff1a' + (e.message || e));
    }
}
