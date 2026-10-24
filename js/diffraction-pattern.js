/**
 * 夫琅禾费单缝衍射图样 - 共享绘制模块
 * I/I0 = (sinβ/β)², β = π a x /(λ f), Δy ≈ λf/a
 */
(function () {
    'use strict';

    const REF_SLIT_MM = 0.10; // 视场半宽按参考缝宽定标，缝宽变化时图样才会在屏上缩放

    function wavelengthToRGB(nm) {
        let r = 0, g = 0, b = 0;
        if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
        else if (nm >= 440 && nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
        else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
        else if (nm >= 510 && nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
        else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
        else if (nm >= 645 && nm <= 780) { r = 1; }
        let factor = 1;
        if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
        else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);
        const gamma = 0.8;
        const adj = (c) => c <= 0 ? 0 : Math.round(255 * Math.pow(c * factor, gamma));
        return { r: adj(r), g: adj(g), b: adj(b) };
    }

    function normParams(options) {
        return {
            lambdaNm: options.lambdaNm || 632,
            slitMm: options.slitMm || 0.10,
            focalMm: options.focalMm || 500
        };
    }

    function intensity(xMm, p) {
        const lambda_m = p.lambdaNm * 1e-9;
        const a_m = p.slitMm * 1e-3;
        const f_m = p.focalMm * 1e-3;
        const beta = (Math.PI * a_m * (xMm * 1e-3)) / (lambda_m * f_m);
        if (Math.abs(beta) < 1e-9) return 1;
        const s = Math.sin(beta) / beta;
        return s * s;
    }

    /** 第一类贝塞尔函数 J1(x) */
    function besselJ1(x) {
        const ax = Math.abs(x);
        if (ax < 8) {
            const y = x * x;
            const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))));
            const den = 144725884886.0 + y * (2300535178.0 + y * (1858330.474 + y * (99447.43394 + y * (376.9991397 + y))));
            return num / den;
        }
        const z = 8 / ax;
        const y = z * z;
        const xx = ax - 2.356194491;
        const p1 = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
        const p2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
        return x < 0 ? -ans : ans;
    }

    /** 圆孔夫琅禾费衍射（艾里斑）轴上剖面 I/I0 = [2J1(u)/u]² */
    function intensityCircular(xMm, p) {
        const lambda_m = p.lambdaNm * 1e-9;
        const D_m = p.slitMm * 1e-3;
        const f_m = p.focalMm * 1e-3;
        const u = (Math.PI * D_m * Math.abs(xMm * 1e-3)) / (lambda_m * f_m);
        if (u < 1e-9) return 1;
        const v = 2 * besselJ1(u) / u;
        return v * v;
    }

    function getIntensity(xMm, p, apertureType) {
        return apertureType === 'circular' ? intensityCircular(xMm, p) : intensity(xMm, p);
    }

    function deltaYmm(p) {
        return (p.lambdaNm * 1e-9 * p.focalMm * 1e-3) / (p.slitMm * 1e-3) * 1e3;
    }

    /** 固定视场半宽(mm)：不随当前缝宽缩放，缝宽改变时条纹疏密才会变化 */
    function computeHalfSpanMm(p, apertureType) {
        const lambda_m = p.lambdaNm * 1e-9;
        const f_m = p.focalMm * 1e-3;
        const ref_m = REF_SLIT_MM * 1e-3;
        let deltaRef;
        if (apertureType === 'circular') {
            deltaRef = 1.22 * lambda_m * f_m / ref_m * 1e3;
        } else {
            deltaRef = lambda_m * f_m / ref_m * 1e3;
        }
        return Math.min(48, Math.max(1.5, 5.5 * deltaRef));
    }

    function xMmFromPx(px, plotLeft, plotW, halfSpan, centerMm) {
        const t = ((px - plotLeft) / plotW) * 2 - 1;
        return centerMm + t * halfSpan;
    }

    function mixWhiteToColor(v, rgb) {
        return 'rgb(' +
            Math.round(255 * (1 - v) + rgb.r * v) + ',' +
            Math.round(255 * (1 - v) + rgb.g * v) + ',' +
            Math.round(255 * (1 - v) + rgb.b * v) + ')';
    }

    /** 圆孔：保持现有映射 */
    function colorFromIntensity(I, rgb) {
        if (!Number.isFinite(I) || I < 0) I = 0;
        let v = Math.pow(I, 0.12);
        v = Math.min(1, v * 2.65);
        return mixWhiteToColor(v, rgb);
    }

    /**
     * 单缝条纹的光强→颜色映射（仅视觉）：
     * - 暗纹（I→0）接近背景白，间隙自然淡出，不再反白成细线
     * - 亮纹随 I 升高才显色，主极大核心窄、不比物理分布更粗
     * - 温和 gamma 保留次级极大的层次（越远越窄越暗）
     */
    function slitIntensityToBlend(I) {
        if (!Number.isFinite(I) || I < 0) I = 0;
        // 单缝条纹光强增大至 3 倍（仅影响视觉显色，使过浅的条纹更清晰）
        I = I * 3;
        let v = Math.pow(I, 0.28) * 1.45;
        return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    /**
     * 单缝：细腻竖向光带——中间亮、向左右渐淡，间隙平滑淡出。
     * 逐像素着色 + 轻微横向柔化，去掉色块/锯齿感；竖直方向保持均匀（与一维单缝物理一致）。
     */
    function drawSlitFringeBand(ctx, plotLeft, fringeTop, plotW, fringeBandH, halfSpan, centerMm, p, rgb) {
        const cols = Math.max(1, Math.floor(plotW));
        const rows = Math.max(1, Math.floor(fringeBandH));
        const left = Math.round(plotLeft);
        const top = Math.round(fringeTop);

        // 1) 每列物理光强（与上方 sinc² 曲线同一来源，不改公式）
        const Iarr = new Float32Array(cols);
        for (let col = 0; col < cols; col++) {
            const xMm = xMmFromPx(left + col + 0.5, left, plotW, halfSpan, centerMm);
            Iarr[col] = intensity(xMm, p);
        }

        // 2) 轻微横向柔化（仅抗锯齿，不移动条纹位置/疏密）
        const blend = new Float32Array(cols);
        for (let col = 0; col < cols; col++) {
            const l = Iarr[col > 0 ? col - 1 : 0];
            const c = Iarr[col];
            const r = Iarr[col < cols - 1 ? col + 1 : cols - 1];
            const Is = l * 0.25 + c * 0.5 + r * 0.25;
            blend[col] = slitIntensityToBlend(Is);
        }

        // 3) 逐像素着色：背景白 → 波长色，按 blend 混合（竖直均匀）
        const img = ctx.createImageData(cols, rows);
        const data = img.data;
        for (let col = 0; col < cols; col++) {
            const v = blend[col];
            const cr = Math.round(255 * (1 - v) + rgb.r * v);
            const cg = Math.round(255 * (1 - v) + rgb.g * v);
            const cb = Math.round(255 * (1 - v) + rgb.b * v);
            for (let row = 0; row < rows; row++) {
                const idx = (row * cols + col) * 4;
                data[idx] = cr;
                data[idx + 1] = cg;
                data[idx + 2] = cb;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(img, left, top);

        // 4) 极轻柔光：仅在较亮处叠加一层很淡的横向光晕，增加“光斑”柔和感
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let col = 0; col < cols; col++) {
            const v = blend[col];
            if (v < 0.12) continue;
            const a = (v - 0.12) * 0.18;
            ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a.toFixed(3) + ')';
            ctx.fillRect(left + col, top, 1, rows);
        }
        ctx.restore();
    }

    /** 圆孔：二维艾里斑同心环 */
    function drawCircularFringeBand(ctx, plotLeft, fringeTop, plotW, fringeBandH, halfSpan, p, rgb) {
        const mmPerPx = (2 * halfSpan) / plotW;
        const cols = Math.max(1, Math.floor(plotW));
        const rows = Math.max(1, Math.floor(fringeBandH));
        const step = plotW > 800 ? 2 : 1;

        for (let row = 0; row < rows; row += step) {
            for (let col = 0; col < cols; col += step) {
                const xMm = (col - cols / 2) * mmPerPx;
                const yMm = (row - rows / 2) * mmPerPx;
                const rMm = Math.sqrt(xMm * xMm + yMm * yMm);
                const I = intensityCircular(rMm, p);
                ctx.fillStyle = colorFromIntensity(I, rgb);
                ctx.fillRect(plotLeft + col, fringeTop + row, step, step);
            }
        }
    }

    /** 白底 + 光强曲线 + 衍射条纹（虚拟实验室大屏/接收屏） */
    function drawLabDisplay(canvas, options) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        const p = normParams(options);
        const apertureType = options.apertureType || 'slit';
        const rgb = wavelengthToRGB(p.lambdaNm);
        const halfSpan = options.halfSpanMm || computeHalfSpanMm(p, apertureType);
        const centerMm = 0;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        const margin = Math.max(16, Math.round(w * 0.025));
        const plotLeft = margin;
        const plotRight = w - margin;
        const plotW = plotRight - plotLeft;

        const gapH = Math.round(h * 0.012);
        const fringeBandH = Math.round(h * 0.60);
        const topPad = Math.round(h * 0.02);
        const chartBottom = h - fringeBandH - gapH;
        const chartTop = topPad;
        const chartH = chartBottom - chartTop;
        const fringeTop = chartBottom + gapH;

        // 网格
        ctx.strokeStyle = 'rgba(180,190,210,0.55)';
        ctx.lineWidth = 1;
        const gridN = 10;
        for (let i = 0; i <= gridN; i++) {
            const gx = plotLeft + (plotW * i) / gridN;
            ctx.beginPath();
            ctx.moveTo(gx, chartTop);
            ctx.lineTo(gx, chartBottom);
            ctx.stroke();
        }
        for (let j = 0; j <= 4; j++) {
            const gy = chartTop + (chartH * j) / 4;
            ctx.beginPath();
            ctx.moveTo(plotLeft, gy);
            ctx.lineTo(plotRight, gy);
            ctx.stroke();
        }

        // 光强曲线
        const lineR = rgb.r;
        const lineG = rgb.g;
        const lineB = rgb.b;
        const nPts = Math.min(900, Math.floor(plotW));

        function tracePath() {
            ctx.beginPath();
            for (let i = 0; i <= nPts; i++) {
                const px = plotLeft + (plotW * i) / nPts;
                const xMm = xMmFromPx(px, plotLeft, plotW, halfSpan, centerMm);
                const I = getIntensity(xMm, p, apertureType);
                const py = chartBottom - I * (chartH - 8);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        }

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(80,80,90,0.25)';
        ctx.lineWidth = 5;
        tracePath();
        ctx.stroke();

        ctx.strokeStyle = 'rgb(' + lineR + ',' + lineG + ',' + lineB + ')';
        ctx.lineWidth = Math.max(2, w / 400);
        tracePath();
        ctx.stroke();

        // 衍射图样区（白底）：单缝=竖条纹，圆孔=艾里斑同心环
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(plotLeft, fringeTop, plotW, fringeBandH);

        if (apertureType === 'circular') {
            drawCircularFringeBand(ctx, plotLeft, fringeTop, plotW, fringeBandH, halfSpan, p, rgb);
        } else {
            drawSlitFringeBand(ctx, plotLeft, fringeTop, plotW, fringeBandH, halfSpan, centerMm, p, rgb);
        }

        ctx.strokeStyle = 'rgba(160,170,185,0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(plotLeft, fringeTop, plotW, fringeBandH);
    }

    /** 仅条纹（白底），用于小尺寸纹理 */
    function drawSingleSlit(canvas, options) {
        drawLabDisplay(canvas, options);
    }

    function drawStandby(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawBlank(canvas) {
        drawStandby(canvas);
    }

    window.DiffractionPattern = {
        wavelengthToRGB: wavelengthToRGB,
        intensity: intensity,
        intensityCircular: intensityCircular,
        getIntensity: getIntensity,
        deltaYmm: deltaYmm,
        computeHalfSpanMm: computeHalfSpanMm,
        drawSingleSlit: drawSingleSlit,
        drawLabDisplay: drawLabDisplay,
        drawStandby: drawStandby,
        drawBlank: drawBlank
    };
})();
