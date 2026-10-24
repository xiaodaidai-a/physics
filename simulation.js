/**
 * 夫琅禾费单缝衍射仿真实验（按《夫琅禾费单缝衍射仿真实验方案》实现）
 * 强度 I/I₀=(sinβ/β)²，β=πax/(λf)；暗纹 y_k≈kλf/a，Δy≈λf/a，中央明纹宽度 Δx₀≈2λf/a
 */

let ringsCanvas = null;
let ringsContext = null;
/** @type {{k:number, yMm:number, intensity:number}[]} */
let measurementData = [];
/** 最近一次点击判定的暗纹候选（用于竖线标记与「添加暗纹点」） */
let lastDarkSample = null;
let scale = 1;
let offsetPanMm = 0;
let isDragging = false;
let dragStartBmpX = 0;
let dragStartPan = 0;
let panCandidate = false;
const dragThreshold = 4;

/** 鼠标在画布位图像素中的位置（用于探测线与动态刷新）；null 表示已离开画布 */
let cursorBmpX = null;
let cursorBmpY = null;
/** rAF 时间戳，用于接收屏条纹的轻微“相干”动态调制（类似 Desmos 中随参数/时间连续变化） */
let diffractionAnimT = 0;
let diffractionRafId = null;
/** 合并鼠标移动触发的重绘，避免每像素多次全画布绘制 */
let diffractionHoverRaf = null;

function scheduleDiffractionHoverRedraw() {
    if (diffractionHoverRaf != null) return;
    diffractionHoverRaf = requestAnimationFrame(function() {
        diffractionHoverRaf = null;
        updateDiffraction();
    });
}

/** 将屏幕坐标换算为 canvas 内部像素（避免 CSS 缩放后曲线与条纹、点击错位） */
function clientToCanvasPixel(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const rw = Math.max(1e-6, rect.width);
    const rh = Math.max(1e-6, rect.height);
    return {
        x: (clientX - rect.left) * (canvas.width / rw),
        y: (clientY - rect.top) * (canvas.height / rh)
    };
}

function startDiffractionLiveLoop() {
    if (diffractionRafId != null) return;
    let last = 0;
    function frame(t) {
        if (document.hidden) {
            diffractionRafId = null;
            return;
        }
        diffractionRafId = requestAnimationFrame(frame);
        if (t - last < 28) return;
        last = t;
        diffractionAnimT = t;
        updateDiffraction();
    }
    diffractionRafId = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', function() {
    if (document.hidden && diffractionRafId != null) {
        cancelAnimationFrame(diffractionRafId);
        diffractionRafId = null;
    } else if (!document.hidden && ringsCanvas) {
        startDiffractionLiveLoop();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initCanvas();

    const calcLeft = document.getElementById('calculate-btn');
    if (calcLeft) calcLeft.addEventListener('click', computeSlitWidthFromMeasurements);

    bindSliderPair('wavelength', 'wavelength-slider', () => {
        updateDiffraction();
        updateTheoryResultCard();
        updateSelectedColorBand(document.getElementById('wavelength')?.value || 632);
    });
    bindSliderPair('focal-length', 'focal-length-slider', () => {
        updateDiffraction();
        updateTheoryResultCard();
    });
    bindSlitWidthControls();

    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const resetView = document.getElementById('reset-view');
    if (zoomIn) {
        zoomIn.addEventListener('click', function() {
            scale = Math.min(8, scale * 1.2);
            updateDiffraction();
        });
    }
    if (zoomOut) {
        zoomOut.addEventListener('click', function() {
            scale = Math.max(0.35, scale / 1.2);
            updateDiffraction();
        });
    }
    if (resetView) {
        resetView.addEventListener('click', function() {
            scale = 1;
            offsetPanMm = 0;
            updateDiffraction();
        });
    }

    document.querySelectorAll('.color-band').forEach(band => {
        band.addEventListener('click', function() {
            let wavelength = 632;
            if (this.classList.contains('violet')) wavelength = 420;
            if (this.classList.contains('blue')) wavelength = 470;
            if (this.classList.contains('green')) wavelength = 530;
            if (this.classList.contains('yellow')) wavelength = 580;
            if (this.classList.contains('orange')) wavelength = 600;
            if (this.classList.contains('red')) wavelength = 650;
            const wi = document.getElementById('wavelength');
            const ws = document.getElementById('wavelength-slider');
            if (wi) wi.value = wavelength;
            if (ws) ws.value = wavelength;
            updateDiffraction();
            updateTheoryResultCard();
            updateSelectedColorBand(wavelength);
        });
    });

    bindMeasurementButtons();
    updateDiffraction();
    updateTheoryResultCard();

    const initialWl = document.getElementById('wavelength')?.value || 632;
    updateSelectedColorBand(initialWl);

    function removeIndicators() {
        const selectors = [
            'body > div', '[id*="indicator"]', '[class*="indicator"]',
            '[id*="dot"]', '[class*="dot"]', '[id*="point"]', '[class*="point"]',
            '[id*="status"]', '[class*="status"]', '[id*="live"]', '[class*="live"]',
            '#__bs_notify__'
        ];
        document.querySelectorAll(selectors.join(', ')).forEach(function(el) {
            try {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (
                    (style.position === 'fixed' || style.position === 'absolute') &&
                    (rect.top < 50 && rect.left < 50) ||
                    (rect.width < 30 && rect.height < 30 && rect.width > 0)
                ) {
                    el.style.display = 'none';
                    el.style.opacity = '0';
                    el.style.visibility = 'hidden';
                    el.style.pointerEvents = 'none';
                    if (el.parentNode) el.parentNode.removeChild(el);
                }
            } catch (e) { /* ignore */ }
        });
    }
    removeIndicators();
    setTimeout(removeIndicators, 500);
    setTimeout(removeIndicators, 2000);

    if (window.MathJax && window.MathJax.typesetPromise) {
        const nodes = [
            document.querySelector('.diffraction-intro-panel'),
            document.querySelector('.table-formula-notes')
        ].filter(Boolean);
        if (nodes.length) window.MathJax.typesetPromise(nodes).catch(function() { /* ignore */ });
    }
});

function bindSliderPair(inputId, sliderId, onChange) {
    const input = document.getElementById(inputId);
    const slider = document.getElementById(sliderId);
    if (!input || !slider) return;

    input.addEventListener('input', function() {
        slider.value = this.value;
        onChange();
    });
    slider.addEventListener('input', function() {
        input.value = this.value;
        onChange();
    });

    const clamp = () => {
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        let v = parseFloat(input.value);
        if (isNaN(v)) v = parseFloat(slider.value);
        v = Math.max(min, Math.min(max, v));
        input.value = v;
        slider.value = v;
        onChange();
    };
    input.addEventListener('blur', clamp);
}

/** 滑块 2–50 表示 0.02–0.50 mm */
function bindSlitWidthControls() {
    const input = document.getElementById('slit-width');
    const slider = document.getElementById('slit-width-slider');
    if (!input || !slider) return;

    const syncFromSlider = () => {
        const mm = parseInt(slider.value, 10) / 100;
        input.value = mm.toFixed(2);
        updateDiffraction();
        updateTheoryResultCard();
    };
    const syncFromInput = () => {
        let v = parseFloat(input.value);
        if (isNaN(v)) v = 0.1;
        v = Math.max(0.02, Math.min(0.5, v));
        input.value = v.toFixed(2);
        slider.value = String(Math.round(v * 100));
        updateDiffraction();
        updateTheoryResultCard();
    };

    slider.addEventListener('input', syncFromSlider);
    input.addEventListener('input', syncFromInput);
    input.addEventListener('blur', syncFromInput);
}

function getDiffractionParams() {
    const wavelength_nm = parseFloat(document.getElementById('wavelength')?.value || 632);
    const slit_mm = parseFloat(document.getElementById('slit-width')?.value || 0.1);
    const focal_mm = parseFloat(document.getElementById('focal-length')?.value || 500);
    return {
        wavelength_nm,
        lambda_m: wavelength_nm * 1e-9,
        slit_mm,
        a_m: slit_mm * 1e-3,
        focal_mm,
        f_m: focal_mm * 1e-3
    };
}

/** 相邻暗纹间距 Δy (mm) */
function deltaY_mm(p) {
    return (p.lambda_m * p.f_m / p.a_m) * 1000;
}

/** 中央明纹宽度 Δx₀ (mm) */
function deltaX0_mm(p) {
    return 2 * deltaY_mm(p);
}

function intensityRatio(xMm, p) {
    const x_m = xMm * 1e-3;
    if (Math.abs(x_m) < 1e-20) return 1;
    const beta = (Math.PI * p.a_m * x_m) / (p.lambda_m * p.f_m);
    const sb = Math.sin(beta) / beta;
    return sb * sb;
}

/** 视场半宽定标用参考缝宽 (m)，与当前 a 解耦，使改变缝宽时条纹在屏上的疏密与中央亮区宽度随之变化 */
const VIEWPORT_REF_SLIT_M = 0.1e-3;

function computeHalfWidthMm(p) {
    const deltaRef_mm = (p.lambda_m * p.f_m / VIEWPORT_REF_SLIT_M) * 1000;
    const raw = 5.5 * deltaRef_mm;
    return Math.min(48, Math.max(1.5, raw)) / scale;
}

function pixelToXMm(px, canvasWidth, halfW, centerMm) {
    const t = (px / canvasWidth - 0.5) * 2;
    return centerMm + t * halfW;
}

/** 与光强曲线、接收屏条纹共用：绘图区左右边距（像素） */
const DIFFRACTION_PLOT_MARGIN_PX = 38;

function diffractionPlotLayout(canvasWidth) {
    const plotLeft = DIFFRACTION_PLOT_MARGIN_PX;
    const plotRight = canvasWidth - DIFFRACTION_PLOT_MARGIN_PX;
    const plotW = Math.max(1, plotRight - plotLeft);
    return { plotLeft, plotRight, plotW };
}

/** 画布 x 像素 → 物理 x(mm)，按绘图区宽度线性映射到 [center−halfW, center+halfW] */
function xMmFromPlotPixelPx(px, canvasWidth, halfW, centerMm) {
    const { plotLeft, plotW } = diffractionPlotLayout(canvasWidth);
    const t = ((px - plotLeft) / plotW) * 2 - 1;
    return centerMm + t * halfW;
}

/** 判定点击是否靠近第 k 级暗纹（|x|≈kΔy），返回 {k, xMm} 或 null */
function detectDarkFringeAt(xMm, p) {
    const dY = deltaY_mm(p);
    if (dY < 1e-6) return null;
    const ax = Math.abs(xMm);
    let k = Math.round(ax / dY);
    if (k < 1) k = 1;
    const yTarget = k * dY;
    const tol = 0.22 * dY;
    if (Math.abs(ax - yTarget) > tol) return null;
    const I = intensityRatio(xMm, p);
    if (I > 0.08) return null;
    return { k, xMm };
}

function bindMeasurementButtons() {
    const addBtn = document.getElementById('add-data-point');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            if (lastDarkSample) addDarkFringeRow(lastDarkSample);
            else showSelectionToast('请先在图样上靠近暗纹处点击，再添加暗纹点');
        });
    }
    const clearBtn = document.getElementById('clear-data');
    if (clearBtn) clearBtn.addEventListener('click', clearMeasurementData);

    const calcDataBtn = document.getElementById('calculate-from-data');
    if (calcDataBtn) calcDataBtn.addEventListener('click', computeSlitWidthFromMeasurements);

    const sendBtn = document.getElementById('send-to-analysis');
    if (sendBtn) sendBtn.addEventListener('click', sendDataToAnalysisPage);
}

function initCanvas() {
    ringsCanvas = document.getElementById('diffraction-canvas');
    if (!ringsCanvas) {
        console.error('找不到衍射画布元素');
        return;
    }
    ringsContext = ringsCanvas.getContext('2d');
    setupCanvasInteraction(ringsCanvas);
    startDiffractionLiveLoop();
}

function setupCanvasInteraction(canvas) {
    if (!canvas) return;

    canvas.addEventListener('mousedown', function(e) {
        panCandidate = true;
        isDragging = false;
        dragStartPan = offsetPanMm;
        const { x, y } = clientToCanvasPixel(canvas, e.clientX, e.clientY);
        dragStartBmpX = x;
        cursorBmpX = x;
        cursorBmpY = y;
        sampleAtPixel(x, y);
    });

    canvas.addEventListener('mousemove', function(e) {
        const { x, y } = clientToCanvasPixel(canvas, e.clientX, e.clientY);
        cursorBmpX = x;
        cursorBmpY = y;
        if (!panCandidate) {
            scheduleDiffractionHoverRedraw();
            return;
        }
        if (Math.abs(x - dragStartBmpX) > dragThreshold) isDragging = true;
        if (!isDragging) {
            scheduleDiffractionHoverRedraw();
            return;
        }
        const dxBmp = x - dragStartBmpX;
        const p = getDiffractionParams();
        let halfW = computeHalfWidthMm(p);
        if (!Number.isFinite(halfW) || halfW <= 0) halfW = 10;
        const { plotW } = diffractionPlotLayout(canvas.width);
        const mmPerPx = (2 * halfW) / plotW;
        offsetPanMm = dragStartPan - dxBmp * mmPerPx;
        updateDiffraction();
    });

    canvas.addEventListener('mouseup', function() {
        panCandidate = false;
        isDragging = false;
    });
    canvas.addEventListener('mouseleave', function() {
        panCandidate = false;
        isDragging = false;
        cursorBmpX = null;
        cursorBmpY = null;
        updateDiffraction();
    });

    canvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.12 : 0.12;
        scale = Math.max(0.35, Math.min(8, scale * (1 + delta)));
        updateDiffraction();
    }, { passive: false });

    canvas.style.cursor = 'crosshair';
}

function sampleAtPixel(mx, my) {
    if (!ringsCanvas) return;
    const p = getDiffractionParams();
    let halfW = computeHalfWidthMm(p);
    if (!Number.isFinite(halfW) || halfW <= 0) halfW = 10;
    const cw = ringsCanvas.width;
    const { plotLeft, plotRight } = diffractionPlotLayout(cw);
    const xMm = mx >= plotLeft && mx <= plotRight
        ? xMmFromPlotPixelPx(mx, cw, halfW, offsetPanMm)
        : pixelToXMm(mx, cw, halfW, offsetPanMm);
    const I = intensityRatio(xMm, p);
    const dark = detectDarkFringeAt(xMm, p);

    const info = document.getElementById('ring-info');
    if (dark) {
        lastDarkSample = { k: dark.k, xMm: dark.xMm, yKmMm: dark.k * deltaY_mm(p), intensity: I };
        if (info) {
            info.textContent = `判定为第 ${dark.k} 级暗纹附近：|x|≈${Math.abs(dark.xMm).toFixed(3)} mm，I/I₀=${I.toFixed(4)} → 可点「添加暗纹点」`;
        }
    } else {
        lastDarkSample = null;
        if (info) {
            info.textContent = `x=${xMm.toFixed(3)} mm，I/I₀=${I.toFixed(4)}（请在暗纹中心附近点击）`;
        }
    }
    updateDiffraction();
}

function addDarkFringeRow(sample) {
    if (!sample || !sample.k) {
        showSelectionToast('请先在暗纹位置点击');
        return;
    }
    if (measurementData.some(d => d.k === sample.k)) {
        showSelectionToast(`第 ${sample.k} 级暗纹已记录，请勿重复添加`);
        return;
    }
    measurementData.push({
        k: sample.k,
        yMm: Math.abs(sample.xMm),
        intensity: sample.intensity
    });
    measurementData.sort((a, b) => a.k - b.k);
    recalcTableDerived();
    updateMeasurementTable();
    updateTheoryResultCard();
    saveExperimentDataForReport();
    showSelectionToast(`已记录第 ${sample.k} 级暗纹`);
}

function clearMeasurementData() {
    measurementData = [];
    lastDarkSample = null;
    window.__lastSlitInversion = null;
    const dr = document.querySelector('.data-analysis .detailed-results');
    if (dr) dr.remove();
    updateMeasurementTable();
    try {
        sessionStorage.removeItem('experimentData');
    } catch (err) { /* ignore */ }
    updateDiffraction();
    updateTheoryResultCard();
    showSelectionToast('已清除数据');
}

/** 根据 y_k 填充 Δy、a、相对误差 */
function recalcTableDerived() {
    const p = getDiffractionParams();
    const aSet = p.slit_mm;
    measurementData.sort((a, b) => a.k - b.k);
    let prevY = 0;
    measurementData.forEach(row => {
        const yk = row.yMm;
        row.deltaY_mm = row.k === 1 ? yk : yk - prevY;
        prevY = yk;
        const y_m = yk * 1e-3;
        row.aCalc_mm = (row.k * p.lambda_m * p.f_m) / y_m * 1000;
        row.relErrPercent = aSet > 0 ? (Math.abs(row.aCalc_mm - aSet) / aSet) * 100 : 0;
    });
}

function updateMeasurementTable() {
    const tableBody = document.querySelector('#measurement-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (measurementData.length === 0) {
        for (let i = 0; i < 5; i++) {
            const row = document.createElement('tr');
            row.innerHTML = '<td>--</td><td>--</td><td>--</td><td>--</td><td>--</td><td></td>';
            tableBody.appendChild(row);
        }
        return;
    }

    measurementData.forEach(item => {
        const row = document.createElement('tr');
        const dy = item.deltaY_mm != null ? item.deltaY_mm.toFixed(4) : '--';
        const ac = item.aCalc_mm != null ? item.aCalc_mm.toFixed(4) : '--';
        const re = item.relErrPercent != null ? item.relErrPercent.toFixed(2) + '%' : '--';
        row.innerHTML = `
            <td>${item.k}</td>
            <td>${item.yMm.toFixed(4)}</td>
            <td>${dy}</td>
            <td>${ac}</td>
            <td>${re}</td>
        `;
        const delCell = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.textContent = '删除';
        delBtn.className = 'delete-btn';
        const kDel = item.k;
        delBtn.onclick = () => {
            measurementData = measurementData.filter(d => d.k !== kDel);
            recalcTableDerived();
            updateMeasurementTable();
            updateTheoryResultCard();
        };
        delCell.appendChild(delBtn);
        row.appendChild(delCell);
        tableBody.appendChild(row);
    });
}

/** 根据表格反推缝宽并更新左侧结果卡 */
function computeSlitWidthFromMeasurements() {
    const p = getDiffractionParams();
    recalcTableDerived();

    const existing = document.querySelector('.data-analysis .detailed-results');
    if (existing) existing.remove();

    if (measurementData.length === 0) {
        showSelectionToast('请先添加至少一个暗纹测量点');
        updateTheoryResultCard();
        return;
    }

    const dYs = measurementData.map(d => d.deltaY_mm).filter(v => v != null && !isNaN(v));
    const meanDy = dYs.length ? dYs.reduce((a, b) => a + b, 0) / dYs.length : null;
    let aFromDy = null;
    if (meanDy && meanDy > 1e-8) {
        aFromDy = (p.lambda_m * p.f_m / (meanDy * 1e-3)) * 1000;
    }
    const aFromRows = measurementData.map(d => d.aCalc_mm).filter(v => v != null && !isNaN(v));
    const meanA = aFromRows.length ? aFromRows.reduce((a, b) => a + b, 0) / aFromRows.length : aFromDy;

    window.__lastSlitInversion = { meanA, meanDy, aFromDy };

    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'detailed-results';
    resultsDiv.innerHTML = `
        <h3>单缝宽度反推结果</h3>
        <table>
            <tr><td>由平均相邻间距反推 a</td><td>${aFromDy != null ? aFromDy.toFixed(4) + ' mm' : '—'}</td></tr>
            <tr><td>由各点 y<sub>k</sub>/k 反推 a 的平均</td><td>${meanA != null ? meanA.toFixed(4) + ' mm' : '—'}</td></tr>
            <tr><td>设定缝宽（真值）</td><td>${p.slit_mm.toFixed(4)} mm</td></tr>
        </table>
        <p>公式：由相邻间距 \(a \\approx \\lambda f/\\Delta y\)；由第 k 级位置 \(a \\approx k\\lambda f/y_k\)。</p>
    `;
    document.querySelector('.data-analysis')?.appendChild(resultsDiv);

    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([resultsDiv]).catch(function() { /* ignore */ });
    }

    updateTheoryResultCard(meanA, aFromDy);
    updateMeasurementTable();
    showSelectionToast('计算完成，结果已更新到左侧结果卡');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/** 左侧理论量 + 反推（meanA 可选，来自计算按钮） */
function updateTheoryResultCard(meanAOverride, aFromDyOverride) {
    const p = getDiffractionParams();
    const dx0 = deltaX0_mm(p);
    const dY = deltaY_mm(p);
    setText('result-delta-x0', dx0.toFixed(4) + ' mm');
    setText('result-delta-y', dY.toFixed(4) + ' mm');

    let meanA = meanAOverride;
    let aDy = aFromDyOverride;
    if (meanA === undefined && window.__lastSlitInversion) {
        meanA = window.__lastSlitInversion.meanA;
        aDy = window.__lastSlitInversion.aFromDy;
    }

    recalcTableDerived();
    const rowsA = measurementData.map(d => d.aCalc_mm).filter(v => v != null && !isNaN(v));
    const avgRowA = rowsA.length ? rowsA.reduce((a, b) => a + b, 0) / rowsA.length : null;

    let displayA = meanAOverride;
    if (displayA == null && avgRowA != null) displayA = avgRowA;
    if (displayA == null && aDy != null) displayA = aDy;
    if (displayA == null && window.__lastSlitInversion && window.__lastSlitInversion.meanA != null) {
        displayA = window.__lastSlitInversion.meanA;
    }

    if (displayA != null && !isNaN(displayA)) {
        setText('result-a-calc', displayA.toFixed(4) + ' mm');
        const err = (Math.abs(displayA - p.slit_mm) / p.slit_mm) * 100;
        setText('result-rel-err', err.toFixed(2) + '%');
    } else {
        setText('result-a-calc', '—');
        setText('result-rel-err', '—');
    }
}

function updateDiffraction() {
    if (!ringsCanvas || !ringsContext) return;

    const w = ringsCanvas.width;
    const h = ringsCanvas.height;
    const p = getDiffractionParams();
    let halfW = computeHalfWidthMm(p);
    if (!Number.isFinite(halfW) || halfW <= 0) halfW = 10;
    /* 垂直分区：光强图 | 横轴刻度带 | 衍射条纹带 | 底部说明（与参考图一致，条纹区独立且与曲线横轴对齐） */
    const topPad = 10;
    const axisBandH = 26;
    const fringeBandH = Math.max(96, Math.min(128, Math.round(h * 0.175)));
    const captionBelow = 18;
    const bottomPad = 10;
    const chartH = h - topPad - axisBandH - fringeBandH - captionBelow - bottomPad;
    const fringeTop = topPad + chartH + axisBandH;
    const fringeH = fringeBandH;
    const margin = DIFFRACTION_PLOT_MARGIN_PX;
    const plotLeft = margin;
    const plotRight = w - margin;
    const plotW = plotRight - plotLeft;
    const dY = deltaY_mm(p);

    ringsContext.fillStyle = '#0a0a0a';
    ringsContext.fillRect(0, 0, w, h);

    const { r, g, b } = wavelengthToRGB(p.wavelength_nm);
    /** 在深色背景上绘制高对比、偏亮的光强曲线（仍保留波长色调） */
    let lr = Math.min(255, Math.round(r * 1.28 + 118));
    let lg = Math.min(255, Math.round(g * 1.28 + 118));
    let lb = Math.min(255, Math.round(b * 1.28 + 122));
    const minCh = Math.min(lr, lg, lb);
    if (minCh < 155) {
        const add = 155 - minCh;
        lr = Math.min(255, lr + add);
        lg = Math.min(255, lg + add);
        lb = Math.min(255, lb + add);
    }
    const lineColor = `rgb(${lr},${lg},${lb})`;

    const chartTop = topPad;
    const chartBottom = topPad + chartH;

    ringsContext.strokeStyle = 'rgba(80,80,90,0.45)';
    ringsContext.lineWidth = 1;
    const gridN = 10;
    for (let i = 0; i <= gridN; i++) {
        const gx = plotLeft + (plotW * i) / gridN;
        ringsContext.beginPath();
        ringsContext.moveTo(gx, chartTop + 10);
        ringsContext.lineTo(gx, chartBottom - 4);
        ringsContext.stroke();
    }
    for (let j = 0; j <= 4; j++) {
        const gy = chartTop + 10 + ((chartH - 14) * j) / 4;
        ringsContext.beginPath();
        ringsContext.moveTo(plotLeft, gy);
        ringsContext.lineTo(plotRight, gy);
        ringsContext.stroke();
    }

    /* 横轴刻度带（与下方条纹区分） */
    ringsContext.fillStyle = 'rgba(12, 12, 14, 1)';
    ringsContext.fillRect(0, chartBottom, w, axisBandH);
    ringsContext.strokeStyle = 'rgba(90, 100, 120, 0.55)';
    ringsContext.lineWidth = 1;
    ringsContext.beginPath();
    ringsContext.moveTo(plotLeft, chartBottom);
    ringsContext.lineTo(plotRight, chartBottom);
    ringsContext.stroke();

    ringsContext.font = '11px sans-serif';
    ringsContext.fillStyle = 'rgba(200,200,210,0.88)';
    ringsContext.textAlign = 'center';
    const tickY = chartBottom + 18;
    for (let i = 0; i <= gridN; i++) {
        const t = -1 + (2 * i) / gridN;
        const xv = offsetPanMm + t * halfW;
        const gx = plotLeft + (plotW * i) / gridN;
        ringsContext.fillText(xv.toFixed(2), gx, tickY);
    }
    /* Y 轴刻度在绘图区左缘内侧右对齐；标题在绘图区内，避免与 1.0 水平重叠 */
    ringsContext.textAlign = 'right';
    ringsContext.fillText('1.0', plotLeft - 4, chartTop + 16);
    ringsContext.fillText('0.5', plotLeft - 4, chartTop + 10 + (chartH - 14) * 0.25);
    ringsContext.fillText('0', plotLeft - 4, chartBottom - 6);
    const titleStartX = plotLeft + 6;
    const yAxisLabelY = chartTop + 14;
    const labZh = '相对强度';
    const labEn = 'I/I₀';
    const gapPx = 10;
    ringsContext.textAlign = 'left';
    ringsContext.fillText(labZh, titleStartX, yAxisLabelY);
    ringsContext.fillText(labEn, titleStartX + gapPx + ringsContext.measureText(labZh).width, yAxisLabelY);

    const nPts = Math.min(900, Math.floor(plotW));
    function traceIntensityPath() {
        ringsContext.beginPath();
        for (let i = 0; i <= nPts; i++) {
            const px = plotLeft + (plotW * i) / nPts;
            const xMm = xMmFromPlotPixelPx(px, w, halfW, offsetPanMm);
            const I = intensityRatio(xMm, p);
            const py = chartBottom - 6 - I * (chartH - 22);
            if (i === 0) ringsContext.moveTo(px, py);
            else ringsContext.lineTo(px, py);
        }
    }

    ringsContext.lineJoin = 'round';
    ringsContext.lineCap = 'round';

    /* 底层宽描边，提高深色背景上的可见度 */
    ringsContext.strokeStyle = 'rgba(255,255,255,0.32)';
    ringsContext.lineWidth = 6;
    traceIntensityPath();
    ringsContext.stroke();

    ringsContext.strokeStyle = lineColor;
    ringsContext.lineWidth = 3;
    ringsContext.shadowColor = 'rgba(255,255,255,0.55)';
    ringsContext.shadowBlur = 8;
    traceIntensityPath();
    ringsContext.stroke();
    ringsContext.shadowBlur = 0;

    ringsContext.strokeStyle = 'rgba(100,100,120,0.55)';
    ringsContext.lineWidth = 1;
    ringsContext.beginPath();
    ringsContext.moveTo(plotLeft, chartBottom - 6);
    ringsContext.lineTo(plotRight, chartBottom - 6);
    ringsContext.stroke();

    function xMmToPlotPx(xMmVal) {
        return plotLeft + ((xMmVal - offsetPanMm + halfW) / (2 * halfW)) * plotW;
    }

    // 竖线：理论暗纹位置 ±kΔy
    ringsContext.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ringsContext.lineWidth = 1;
    for (let k = 1; k <= 6; k++) {
        for (const sgn of [-1, 1]) {
            const xv = sgn * k * dY;
            const sx = xMmToPlotPx(xv);
            if (sx >= plotLeft && sx <= plotRight) {
                ringsContext.beginPath();
                ringsContext.moveTo(sx, chartTop + 10);
                ringsContext.lineTo(sx, chartBottom - 4);
                ringsContext.stroke();
            }
        }
    }

    // 标注（仅保留中央明纹与 Δy 读数，避免与条纹区文字堆叠）
    ringsContext.font = 'bold 12px sans-serif';
    ringsContext.fillStyle = 'rgba(255, 230, 120, 0.95)';
    const cx = xMmToPlotPx(0);
    if (cx >= plotLeft && cx <= plotRight) {
        ringsContext.fillText('中央明纹', cx - 26, chartTop + 28);
    }
    ringsContext.fillStyle = 'rgba(200, 255, 200, 0.9)';
    ringsContext.font = '11px sans-serif';
    ringsContext.fillText('Δy≈' + dY.toFixed(3) + ' mm', plotRight - 108, chartTop + 42);
    ringsContext.fillText('Δx₀≈' + (2 * dY).toFixed(3) + ' mm', plotRight - 108, chartTop + 58);

    if (lastDarkSample) {
        const sx = xMmToPlotPx(lastDarkSample.xMm);
        if (sx >= plotLeft && sx <= plotRight) {
            ringsContext.strokeStyle = 'rgba(255, 220, 80, 0.9)';
            ringsContext.lineWidth = 1.5;
            ringsContext.setLineDash([5, 4]);
            ringsContext.beginPath();
            ringsContext.moveTo(sx, chartTop + 8);
            ringsContext.lineTo(sx, chartBottom - 4);
            ringsContext.stroke();
            ringsContext.setLineDash([]);
        }
    }

    /* —— 衍射条纹区域（与上图同横坐标对齐） —— */
    ringsContext.strokeStyle = 'rgba(130, 140, 160, 0.65)';
    ringsContext.lineWidth = 1;
    ringsContext.beginPath();
    ringsContext.moveTo(0, fringeTop + 0.5);
    ringsContext.lineTo(w, fringeTop + 0.5);
    ringsContext.stroke();

    const fringeTitleH = 22;
    const fringeStripTop = fringeTop + fringeTitleH;
    const fringeStripH = fringeH - fringeTitleH;

    ringsContext.fillStyle = 'rgba(10, 10, 12, 1)';
    ringsContext.fillRect(0, fringeTop, w, fringeTitleH);
    ringsContext.fillStyle = 'rgba(195, 205, 220, 0.95)';
    ringsContext.font = '12px sans-serif';
    ringsContext.textAlign = 'center';
    ringsContext.fillText('衍射条纹（接收屏示意）', w / 2, fringeTop + 15);
    ringsContext.textAlign = 'left';

    const tAnim = diffractionAnimT || performance.now();
    /** 接收屏：谱色 × I/I₀，暗纹接近纯黑；不做列间归一化，才能看到明暗相间与次级极大变弱 */
    const { r: fr, g: fg, b: fb } = wavelengthSpectrumRGB01(p.wavelength_nm);
    const fringePhase = 0.985 + 0.015 * Math.sin(tAnim * 0.0024);
    const nCols = Math.max(1, Math.floor(plotW));
    ringsContext.save();
    ringsContext.globalAlpha = 1;
    ringsContext.globalCompositeOperation = 'source-over';
    const fringeY = Math.floor(fringeStripTop);
    const fringeDrawH = Math.max(1, Math.floor(fringeStripH));
    for (let col = 0; col < nCols; col++) {
        const px = plotLeft + col;
        const xMm = xMmFromPlotPixelPx(px, w, halfW, offsetPanMm);
        let I = intensityRatio(xMm, p);
        if (!Number.isFinite(I) || I < 0) I = 0;
        let v = Math.pow(I, 0.5) * fringePhase;
        if (v < 0.015) v = 0;
        const rr = Math.min(255, Math.round(255 * fr * v));
        const gg = Math.min(255, Math.round(255 * fg * v));
        const bb = Math.min(255, Math.round(255 * fb * v));
        ringsContext.fillStyle = `rgb(${rr},${gg},${bb})`;
        ringsContext.fillRect(plotLeft + col, fringeY, 1, fringeDrawH);
    }
    ringsContext.restore();

    ringsContext.fillStyle = '#000';
    ringsContext.fillRect(0, fringeStripTop, plotLeft, fringeStripH);
    ringsContext.fillRect(plotRight, fringeStripTop, w - plotRight, fringeStripH);

    ringsContext.strokeStyle = 'rgba(70, 78, 92, 0.55)';
    ringsContext.lineWidth = 1;
    for (let i = 0; i <= gridN; i++) {
        const gx = plotLeft + (plotW * i) / gridN;
        ringsContext.beginPath();
        ringsContext.moveTo(gx, fringeStripTop + 2);
        ringsContext.lineTo(gx, fringeTop + fringeH - 2);
        ringsContext.stroke();
    }

    ringsContext.strokeStyle = 'rgba(255,255,255,0.22)';
    ringsContext.strokeRect(plotLeft + 0.5, fringeStripTop + 0.5, plotW - 1, fringeStripH - 1);

    /* 探测竖线：同一 x 上连接光强图与接收屏，随鼠标移动实时读 I/I₀（与 Desmos 中拖动/扫过联动的体验一致） */
    if (cursorBmpX != null && cursorBmpY != null) {
        const cx = cursorBmpX;
        const yProbeTop = chartTop + 8;
        const yProbeBot = fringeTop + fringeH - 4;
        if (cx >= plotLeft && cx <= plotRight && cursorBmpY >= yProbeTop && cursorBmpY <= yProbeBot) {
            const xMmProbe = xMmFromPlotPixelPx(cx, w, halfW, offsetPanMm);
            let Iprobe = intensityRatio(xMmProbe, p);
            if (!Number.isFinite(Iprobe)) Iprobe = 0;
            ringsContext.save();
            ringsContext.strokeStyle = 'rgba(255, 185, 100, 0.55)';
            ringsContext.lineWidth = 1;
            ringsContext.setLineDash([3, 5]);
            ringsContext.beginPath();
            ringsContext.moveTo(cx + 0.5, yProbeTop);
            ringsContext.lineTo(cx + 0.5, yProbeBot);
            ringsContext.stroke();
            ringsContext.setLineDash([]);
            ringsContext.font = '10px sans-serif';
            ringsContext.fillStyle = 'rgba(255, 215, 150, 0.95)';
            ringsContext.textAlign = 'center';
            const pyLab = Math.min(chartBottom - 4, Math.max(chartTop + 18, cursorBmpY));
            ringsContext.fillText('I/I₀=' + Iprobe.toFixed(3), cx, pyLab);
            ringsContext.textAlign = 'left';
            ringsContext.restore();
        }
    }

    ringsContext.fillStyle = 'rgba(200,200,210,0.78)';
    ringsContext.font = '11px sans-serif';
    ringsContext.fillText('接收屏上相对强度（明暗条纹示意）', plotLeft, fringeTop + fringeH + 14);
}

function showSelectionToast(message) {
    let toast = document.querySelector('.selection-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'selection-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 2800);
}

function wavelengthSpectrumRGB01(wavelength) {
    let r, g, b;
    wavelength = Math.min(Math.max(380, wavelength), 780);
    if (wavelength >= 380 && wavelength < 440) {
        r = -1 * (wavelength - 440) / (440 - 380);
        g = 0;
        b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
        r = 0;
        g = (wavelength - 440) / (490 - 440);
        b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
        r = 0;
        g = 1;
        b = -1 * (wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        r = (wavelength - 510) / (580 - 510);
        g = 1;
        b = 0;
    } else if (wavelength >= 580 && wavelength < 645) {
        r = 1;
        g = -1 * (wavelength - 645) / (645 - 580);
        b = 0;
    } else {
        r = 1;
        g = 0;
        b = 0;
    }
    const saturationFactor = 1.32;
    r = Math.min(1, r * saturationFactor);
    g = Math.min(1, g * saturationFactor);
    b = Math.min(1, b * saturationFactor);
    return { r, g, b };
}

function wavelengthToRGB(wavelength) {
    let { r, g, b } = wavelengthSpectrumRGB01(wavelength);
    const minBrightness = 0.3;
    const currentBrightness = 0.3 * r + 0.59 * g + 0.11 * b;
    if (currentBrightness < minBrightness) {
        const brightnessFactor = minBrightness / Math.max(0.01, currentBrightness);
        r = Math.min(1, r * brightnessFactor);
        g = Math.min(1, g * brightnessFactor);
        b = Math.min(1, b * brightnessFactor);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function updateSelectedColorBand(wavelength) {
    wavelength = parseInt(wavelength, 10);
    document.querySelectorAll('.color-band').forEach(band => {
        band.style.transform = 'scaleY(1)';
        band.style.boxShadow = 'none';
    });
    let selectedBand = null;
    if (wavelength >= 380 && wavelength < 450) selectedBand = document.querySelector('.color-band.violet');
    else if (wavelength >= 450 && wavelength < 495) selectedBand = document.querySelector('.color-band.blue');
    else if (wavelength >= 495 && wavelength < 570) selectedBand = document.querySelector('.color-band.green');
    else if (wavelength >= 570 && wavelength < 590) selectedBand = document.querySelector('.color-band.yellow');
    else if (wavelength >= 590 && wavelength < 620) selectedBand = document.querySelector('.color-band.orange');
    else if (wavelength >= 620 && wavelength <= 780) selectedBand = document.querySelector('.color-band.red');
    if (selectedBand) {
        selectedBand.style.transform = 'scaleY(1.5)';
        selectedBand.style.boxShadow = '0 0 5px rgba(255,255,255,0.8)';
        selectedBand.style.zIndex = '1';
    }
}

function sendDataToAnalysisPage() {
    const slit = document.getElementById('slit-width')?.value;
    const focal = document.getElementById('focal-length')?.value;
    const wavelength = document.getElementById('wavelength')?.value;
    if (!slit || !focal || !wavelength) {
        showSelectionToast('无法获取当前的实验参数');
        return;
    }
    recalcTableDerived();
    const simulationData = {
        experimentType: 'singleSlit',
        measurements: measurementData.map(d => ({
            k: d.k,
            y_mm: d.yMm,
            deltaY_mm: d.deltaY_mm,
            a_calc_mm: d.aCalc_mm,
            rel_err_percent: d.relErrPercent
        })),
        parameters: {
            radius: 5530,
            wavelength: parseFloat(wavelength),
            slitWidthMm: parseFloat(slit),
            focalLengthMm: parseFloat(focal)
        },
        inversion: window.__lastSlitInversion || null,
        timestamp: new Date().toISOString()
    };

    try {
        sessionStorage.setItem('simulationData', JSON.stringify(simulationData));
        showSelectionToast('已发送参数与暗纹数据，正在进入单缝衍射数据分析页');
        setTimeout(() => { window.location.href = 'ai-prediction.html'; }, 1200);
    } catch (error) {
        console.error(error);
        showSelectionToast('发送数据失败，请检查浏览器设置');
    }
}

function saveExperimentDataForReport() {
    if (measurementData.length === 0) return;
    const slit = document.getElementById('slit-width')?.value;
    const focal = document.getElementById('focal-length')?.value;
    const wavelength = document.getElementById('wavelength')?.value;
    if (!slit || !focal || !wavelength) return;
    recalcTableDerived();
    try {
        sessionStorage.setItem('experimentData', JSON.stringify({
            measurements: measurementData,
            parameters: {
                slitWidthMm: parseFloat(slit),
                focalLengthMm: parseFloat(focal),
                wavelength: parseFloat(wavelength)
            },
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('保存实验数据失败:', error);
    }
}
