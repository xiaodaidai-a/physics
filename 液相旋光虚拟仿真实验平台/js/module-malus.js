/**
 * 模块一：马吕斯定律验证 - JavaScript 逻辑
 *
 * 功能：
 * 1. 绘制单圆光场 Canvas（亮度随 cos²θ 变化，钠黄光着色）
 * 2. 初始化 Chart.js 散点图 + 理论曲线
 * 3. 滑块/快捷按钮控制检偏器角度
 * 4. 数据记录到表格与图表
 * 5. 自动采集（每10°一次）
 * 6. 验证 I 与 cos²θ 的线性关系（R²）
 */

(function() {
    'use strict';

    // ==================== 全局状态 ====================
    let currentAngle = 0;              // 当前检偏器角度 (度)，整数
    let recordedData = [];             // 已记录的数据点 [{angle, intensity, ratio, cos2theta}]
    let malusChart = null;             // Chart.js 实例

    // 常量
    const I0 = 255;                    // 入射光强（最大值）
    const CANVAS_SIZE = 450;
    const FIELD_RADIUS = 200;

    // DOM 元素引用（延迟初始化）
    let elements = {};

    // ==================== 初始化 ====================

    /**
     * 页面初始化入口
     */
    function initMalusModule() {
        // 缓存 DOM 元素
        cacheElements();

        // 初始化光场 Canvas
        drawMalusField(currentAngle);

        // 初始化图表
        initChart();

        // 绑定事件
        bindEvents();

        // 更新数值显示
        updateDisplay();

        console.log('[malus] 马吕斯定律验证模块初始化完成');
    }

    /**
     * 缓存常用 DOM 元素引用
     */
    function cacheElements() {
        elements = {
            slider: document.getElementById('malusAngleSlider'),
            angleLarge: document.getElementById('malusAngleLarge'),
            angleValueDisplay: document.getElementById('malusAngleValueDisplay'),
            intensityRaw: document.getElementById('malusIntensityRaw'),
            intensityPercent: document.getElementById('malusIntensityPercent'),
            tableBody: document.getElementById('malusDataTableBody'),
            btnRecord: document.getElementById('btnRecordPoint'),
            btnClear: document.getElementById('btnClearData'),
            btnAutoCollect: document.getElementById('btnAutoCollect'),
            btnVerify: document.getElementById('btnVerifyLinearity'),
            fieldCanvas: document.getElementById('malusField'),
            chartCanvas: document.getElementById('malusChart')
        };
    }

    // ==================== 光场绘制 ====================

    /**
     * 绘制马吕斯光场（单圆视场）
     * @param {number} angle - 检偏器角度 (度)
     */
    function drawMalusField(angle) {
        const canvas = elements.fieldCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // 清空画布
        ctx.clearRect(0, 0, w, h);

        // 计算当前亮度值 (马吕斯定律)
        const intensity = calculateIntensity(angle);
        const brightness = Math.round(intensity);

        // ---- 绘制圆形视场 ----
        // 外圈暗色背景
        ctx.beginPath();
        ctx.arc(cx, cy, FIELD_RADIUS + 10, 0, Math.PI * 2);
        ctx.fillStyle = '#E2E8F0';
        ctx.fill();

        // 主视场 - 钠黄光色调 rgb(B, B, 0) 并带暗角效果
        // 使用径向渐变实现暗角
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, FIELD_RADIUS);

        // 中心亮度最高，边缘逐渐变暗（暗角）
        const centerB = brightness;
        const edgeB = Math.round(brightness * 0.35); // 边缘保留35%亮度作为暗角

        // 钠黄光着色: rgb(B, B*0.86, 0) 近似钠黄光色调
        const centerR = centerB;
        const centerG = Math.round(centerB * 0.86);
        const edgeR = edgeB;
        const edgeG = Math.round(edgeB * 0.86);

        gradient.addColorStop(0, 'rgb(' + centerR + ',' + centerG + ',0)');
        gradient.addColorStop(0.6, 'rgb(' + Math.round(centerR * 0.85) + ',' + Math.round(centerG * 0.85) + ',0)');
        gradient.addColorStop(1, 'rgb(' + edgeR + ',' + edgeG + ',0)');

        ctx.beginPath();
        ctx.arc(cx, cy, FIELD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 视场边框
        ctx.beginPath();
        ctx.arc(cx, cy, FIELD_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 200, 66, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 内圈装饰线
        ctx.beginPath();
        ctx.arc(cx, cy, FIELD_RADIUS - 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 200, 66, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ---- 中心标注当前角度 ----
        ctx.save();
        ctx.font = '600 22px "JetBrains Mono", monospace';
            ctx.fillStyle = brightness > 60 ? 'rgba(30,41,59,0.85)' : 'rgba(59,130,246,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 文字背景（提高可读性）
        const text = angle.toFixed(1) + '\u00B0';
        const textMetrics = ctx.measureText(text);
        const textPadding = 12;

        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        const rx = textMetrics.width / 2 + textPadding;
        const ry = 18;
        ctx.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, 6);
        ctx.fill();

        // 绘制文字
        ctx.font = '600 22px "JetBrains Mono", monospace';
        ctx.fillStyle = '#3B82F6';
        ctx.fillText(text, cx, cy);
        ctx.restore();

        // ---- 绘制偏振方向指示线 ----
        drawPolarizationIndicator(ctx, cx, cy, angle);
    }

    /**
     * 在光场中心绘制偏振方向指示线
     */
    function drawPolarizationIndicator(ctx, cx, cy, angle) {
        const lineLength = 50;
        const rad = (angle - 90) * Math.PI / 180; // 0度对应水平向右

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);

        // 指示线
        ctx.beginPath();
        ctx.moveTo(-lineLength, 0);
        ctx.lineTo(lineLength, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 端点标记
        ctx.beginPath();
        ctx.arc(lineLength, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();

        ctx.restore();
    }

    // ==================== 物理计算 ====================

    /**
     * 根据马吕斯定律计算光强 I = I0 * cos^2(theta)
     * @param {number} angle - 检偏器角度 (度)
     * @returns {number} 光强值 (0~255)
     */
    function calculateIntensity(angle) {
        // 使用 physics-engine.js 的马吕斯定律函数
        if (typeof PhysicsEngine !== 'undefined' && PhysicsEngine.malusLaw) {
            return PhysicsEngine.malusLaw(I0, angle);
        }
        // 降级方案：自行计算
        const rad = angle * Math.PI / 180;
        return Math.round(I0 * Math.pow(Math.cos(rad), 2));
    }

    /**
     * 计算 cos^2(theta)
     * @param {number} angle - 角度 (度)
     * @returns {number}
     */
    function calcCosSquared(angle) {
        const rad = angle * Math.PI / 180;
        return Math.pow(Math.cos(rad), 2);
    }

    // ==================== 图表初始化 ====================

    /**
     * 初始化 Chart.js 散点图
     */
    function initChart() {
        const ctx = elements.chartCanvas.getContext('2d');

        // 生成理论曲线数据点（平滑曲线用密集点模拟）
        const theoryData = [];
        for (let a = 0; a <= 180; a += 1) {
            theoryData.push({ x: a, y: calculateIntensity(a) });
        }

        malusChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: '实测数据',
                        data: [],
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        showLine: false
                    },
                    {
                        label: '理论曲线 I=I\u2080cos\u00b2\u03b8',
                        data: theoryData,
                        type: 'line',
                        borderColor: 'rgba(245, 158, 11, 0.7)',
                        borderWidth: 2,
                        borderDash: [6, 4],
                        fill: false,
                        pointRadius: 0,
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: '\u68C0\u504F\u5668\u89D2\u5EA6 \u03B8 (\u00B0)',
                            color: '#475569',
                            font: { size: 13, family: '"Source Sans Pro", "Noto Sans SC", sans-serif' }
                        },
                        min: 0,
                        max: 180,
                        ticks: {
                            stepSize: 30,
                            color: '#94A3B8'
                        },
                        grid: {
                            color: 'rgba(148,163,184,0.12)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '\u5149\u5F3A I',
                            color: '#475569',
                            font: { size: 13, family: '"Source Sans Pro", "Noto Sans SC", sans-serif' }
                        },
                        min: 0,
                        max: 260,
                        ticks: {
                            color: '#94A3B8'
                        },
                        grid: {
                            color: 'rgba(148,163,184,0.12)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#475569',
                            font: { size: 12 },
                            usePointStyle: true,
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        titleColor: '#3B82F6',
                        bodyColor: '#475569',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                var label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += '\u03B8=' + context.parsed.x.toFixed(0) + '\u00B0, I=' + context.parsed.y.toFixed(0);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // ==================== UI 更新 ====================

    /**
     * 更新所有数值显示
     */
    function updateDisplay() {
        const intensity = calculateIntensity(currentAngle);
        const ratio = intensity / I0;

        // 角度显示
        const angleStr = currentAngle.toFixed(1) + '\u00B0';
        if (elements.angleLarge) elements.angleLarge.textContent = angleStr;
        if (elements.angleValueDisplay) elements.angleValueDisplay.textContent = angleStr;

        // 光强显示
        if (elements.intensityRaw) elements.intensityRaw.textContent = Math.round(intensity);
        if (elements.intensityPercent) elements.intensityPercent.textContent = (ratio * 100).toFixed(1) + '%';
    }

    /**
     * 设置角度并刷新全部视图
     * @param {number} value - 新角度值 (度)
     */
    function setAngle(value) {
        currentAngle = Math.max(0, Math.min(180, Math.round(value)));
        if (elements.slider) elements.slider.value = currentAngle;

        // 更新光场
        drawMalusField(currentAngle);
        // 更新数值
        updateDisplay();
    }

    // ==================== 数据记录 ====================

    /**
     * 记录当前数据点到表格和图表
     */
    function recordDataPoint() {
        const intensity = Math.round(calculateIntensity(currentAngle));
        const ratio = intensity / I0;
        const cos2theta = calcCosSquared(currentAngle);

        const record = {
            index: recordedData.length + 1,
            angle: currentAngle,
            intensity: intensity,
            ratio: ratio,
            cos2theta: cos2theta
        };

        recordedData.push(record);

        // 更新表格
        appendTableRow(record);

        // 更新图表散点
        updateChartScatter();

        showToast('success', '已记录第 ' + record.index + ' 组数据: \u03B8=' + currentAngle + '\u00B0, I=' + intensity);
    }

    /**
     * 向表格追加一行数据
     * @param {Object} record - 数据记录对象
     */
    function appendTableRow(record) {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + record.index + '</td>' +
            '<td>' + record.angle + '</td>' +
            '<td>' + record.intensity + '</td>' +
            '<td>' + (record.ratio * 100).toFixed(1) + '%</td>' +
            '<td>' + record.cos2theta.toFixed(3) + '</td>';

        // 最新行高亮
        tr.classList.add('highlight-row');
        elements.tableBody.appendChild(tr);

        // 自动滚动到底部
        const container = elements.tableBody.parentElement;
        if (container) container.scrollTop = container.scrollHeight;
    }

    /**
     * 更新图表中的散点数据集
     */
    function updateChartScatter() {
        if (!malusChart) return;

        const scatterData = recordedData.map(function(d) {
            return { x: d.angle, y: d.intensity };
        });

        malusChart.data.datasets[0].data = scatterData;
        malusChart.update();
    }

    // ==================== 自动采集 ====================

    /**
     * 自动采集：每10度从0度到180度自动记录一次
     */
    function autoCollect() {
        if (recordedData.length > 0) {
            if (!confirm('已有 ' + recordedData.length + ' 条数据，自动采集将清空后重新采集。是否继续？')) {
                return;
            }
        }

        // 清空现有数据
        clearDataInternal();

        // 逐条记录（带动画延迟感）
        let angles = [];
        for (let a = 0; a <= 180; a += 10) {
            angles.push(a);
        }

        let idx = 0;
        function collectNext() {
            if (idx >= angles.length) {
                showToast('success', '自动采集完成！共记录 ' + recordedData.length + ' 组数据');
                return;
            }

            const angle = angles[idx];
            setAngle(angle);
            // 直接记录，不重复调用 recordDataPoint 的 toast
            const intensity = Math.round(calculateIntensity(angle));
            const ratio = intensity / I0;
            const cos2theta = calcCosSquared(angle);

            const record = {
                index: recordedData.length + 1,
                angle: angle,
                intensity: intensity,
                ratio: ratio,
                cos2theta: cos2theta
            };
            recordedData.push(record);
            appendTableRow(record);

            idx++;
            setTimeout(collectNext, 120); // 间隔120ms
        }

        collectNext();

        // 所有数据点添加完毕后再更新图表（避免频繁更新）
        setTimeout(function() {
            updateChartScatter();
        }, angles.length * 120 + 50);
    }

    // ==================== 线性验证 ====================

    /**
     * 验证 I 与 cos^2(theta) 的线性关系
     * 使用最小二乘法计算 R^2 决定系数
     */
    function verifyLinearity() {
        if (recordedData.length < 3) {
            showToast('warning', '请至少记录 3 个数据点后再进行验证');
            return;
        }

        // 准备数据：(x = cos^2theta, y = I/I0 归一化光强)
        const dataPoints = recordedData.map(function(d) {
            return { x: d.cos2theta, y: d.ratio };
        });

        // 调用 PhysicsEngine 的线性拟合函数
        let result;
        if (typeof PhysicsEngine !== 'undefined' && PhysicsEngine.linearRegression) {
            result = PhysicsEngine.linearRegression(dataPoints);
        } else {
            result = linearRegressionFallback(dataPoints);
        }

        // 显示结果
        var r2Str = result.rSquared.toFixed(4);
        var slopeStr = result.slope.toFixed(4);
        var interceptStr = result.intercept.toFixed(6);

        var msg = '线性拟合结果:\n' +
                  '斜率 k = ' + slopeStr + ' (理论值 1.0000)\n' +
                  '截距 b = ' + interceptStr + ' (理论值 0)\n' +
                  '决定系数 R\u00B2 = ' + r2Str;

        if (result.rSquared > 0.99) {
            showToast('success', msg + ' -- 数据高度吻合马吕斯定律！');
        } else if (result.rSquared > 0.95) {
            showToast('info', msg + ' -- 数据基本符合马吕斯定律');
        } else {
            showToast('warning', msg + ' -- 偏差较大，建议增加测量点或检查操作');
        }
    }

    /**
     * 降级线性回归实现（当 PhysicsEngine 不可用时使用）
     */
    function linearRegressionFallback(dataPoints) {
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

        // 计算 R^2
        const meanY = sumY / n;
        let ssTotal = 0, ssResidual = 0;
        for (const pt of dataPoints) {
            const predicted = slope * pt.x + intercept;
            ssTotal += (pt.y - meanY) ** 2;
            ssResidual += (pt.y - predicted) ** 2;
        }
        const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

        return {
            slope: Math.round(slope * 10000) / 10000,
            intercept: Math.round(intercept * 100000) / 100000,
            rSquared: Math.round(rSquared * 10000) / 10000,
            stdError: n > 2 ? Math.sqrt(ssResidual / (n - 2)) : 0
        };
    }

    // ==================== 数据管理 ====================

    /**
     * 清空所有已记录数据
     */
    function clearAllData() {
        if (recordedData.length === 0) {
            showToast('info', '当前没有数据需要清空');
            return;
        }
        if (!confirm('确定要清空全部 ' + recordedData.length + ' 条记录吗？')) {
            return;
        }
        clearDataInternal();
        showToast('warning', '数据已清空');
    }

    /**
     * 内部清空方法（无确认弹窗）
     */
    function clearDataInternal() {
        recordedData = [];
        elements.tableBody.innerHTML = '';
        updateChartScatter();
    }

    // ==================== 事件绑定 ====================

    /**
     * 绑定所有控件事件
     */
    function bindEvents() {
        // 滑块拖动
        elements.slider.addEventListener('input', function(e) {
            setAngle(parseFloat(e.target.value));
        });

        // 快捷角度按钮
        document.querySelectorAll('.quick-angle-btns button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const angle = parseFloat(this.dataset.angle);
                setAngle(angle);
            });
        });

        // 记录数据点按钮
        elements.btnRecord.addEventListener('click', function() {
            recordDataPoint();
        });

        // 清空数据按钮
        elements.btnClear.addEventListener('click', function() {
            clearAllData();
        });

        // 自动采集按钮
        elements.btnAutoCollect.addEventListener('click', function() {
            autoCollect();
        });

        // 验证线性关系按钮
        elements.btnVerify.addEventListener('click', function() {
            verifyLinearity();
        });
    }

    // ==================== Toast 提示系统 ====================

    /**
     * 显示 Toast 提示消息
     * @param {string} type - 类型: success / error / warning / info
     * @param {string} message - 提示内容
     */
    function showToast(type, message) {
        var container = document.getElementById('toastContainer');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(function() {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3200);
    }

    // ==================== 移动端菜单切换（复用 experiment.html 逻辑） ====================
    window.toggleMobileMenu = function() {
        var navLinks = document.getElementById('navLinks');
        var toggle = document.getElementById('navToggle');

        navLinks.classList.toggle('mobile-open');
        toggle.classList.toggle('active');

        if (navLinks.classList.contains('mobile-open')) {
            navLinks.style.display = 'flex';
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '64px';
            navLinks.style.left = '0';
            navLinks.style.right = '0';
            navLinks.style.background = 'rgba(255,255,255,0.95)';
            navLinks.style.padding = '1rem';
            navLinks.style.gap = '4px';
            navLinks.style.backdropFilter = 'blur(20px)';
            navLinks.style.borderBottom = '1px solid var(--border-color)';
        } else {
            navLinks.style.display = '';
            navLinks.style.flexDirection = '';
            navLinks.style.position = '';
            navLinks.style.top = '';
            navLinks.style.left = '';
            navLinks.style.right = '';
            navLinks.style.background = '';
            navLinks.style.padding = '';
            navLinks.style.gap = '';
            navLinks.style.backdropFilter = '';
            navLinks.style.borderBottom = '';
        }
    };

    // 点击导航链接关闭移动菜单
    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            var navLinks = document.getElementById('navLinks');
            if (navLinks && navLinks.classList.contains('mobile-open')) {
                window.toggleMobileMenu();
            }
        });
    });

    // 导航栏滚动效果
    var navbarEl = document.getElementById('navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 20) {
            navbarEl.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1)';
        } else {
            navbarEl.style.boxShadow = 'none';
        }
    }, { passive: true });

    // ==================== 启动 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMalusModule);
    } else {
        initMalusModule();
    }

})();
