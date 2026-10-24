/**
 * 夫琅禾费单缝衍射实验报告生成功能
 */
(function () {
    'use strict';

    function initReportGeneration() {
        console.log('初始化实验报告生成功能...');

        const previewBtn = document.getElementById('preview-report-btn');
        const printBtn = document.getElementById('print-report-btn');
        const downloadBtn = document.getElementById('download-report-btn');
        const modal = document.getElementById('report-modal');
        const closeBtn = document.querySelector('.report-close');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalPrintBtn = document.getElementById('modal-print-btn');
        const modalDownloadBtn = document.getElementById('modal-download-btn');

        if (!previewBtn || !printBtn || !downloadBtn || !modal) {
            console.error('报告生成功能所需的DOM元素未找到');
            return;
        }
    
    // 实验数据集（单缝衍射暗纹位置测量示例，无实测数据时使用）
    const presetData = [
        { index: 1, type: '暗纹', position: 3.16, deltaY: 3.16 },
        { index: 2, type: '暗纹', position: 6.32, deltaY: 3.16 },
        { index: 3, type: '暗纹', position: 9.48, deltaY: 3.16 },
        { index: 4, type: '暗纹', position: -3.16, deltaY: 3.16 },
        { index: 5, type: '暗纹', position: -6.32, deltaY: 3.16 },
        { index: 6, type: '暗纹', position: -9.48, deltaY: 3.16 }
    ];

    function loadExperimentData() {
        try {
            const raw = sessionStorage.getItem('experimentData');
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return null;
    }

    function getReportMeasurements() {
        const saved = loadExperimentData();
        if (saved && Array.isArray(saved.measurements) && saved.measurements.length > 0) {
            return saved.measurements.map(function (row, index) {
                const y = row.yMm != null ? row.yMm : (row.y_mm != null ? row.y_mm : 0);
                return {
                    index: row.k != null ? row.k : index + 1,
                    type: '暗纹',
                    position: y,
                    deltaY: row.deltaY_mm != null ? row.deltaY_mm : null
                };
            });
        }
        return presetData;
    }

    function getReportParameters() {
        const saved = loadExperimentData();
        const params = saved && saved.parameters ? saved.parameters : {};
        return {
            lambdaNm: params.wavelength || 632,
            focalMm: params.focalLengthMm || 500,
            slitMm: params.slitWidthMm || 0.10
        };
    }
    
    function getReportStyles() {
        return `
        .diffraction-report { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; line-height: 1.75; color: #2c3e50; background: #f4f7fb; padding: 24px; border-radius: 16px; }
        .diffraction-report .report-topbar { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#7f8c8d; margin-bottom:10px; }
        .diffraction-report .report-title { text-align:center; font-size:30px; font-weight:800; margin:8px 0 18px; background:linear-gradient(90deg,#1565c0,#7b1fa2,#e65100); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .diffraction-report .info-bar { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; background:linear-gradient(135deg,#eef4ff,#f7f0ff); border:1px solid #c5d7f2; border-radius:12px; padding:14px 18px; margin-bottom:22px; }
        .diffraction-report .info-bar span { font-size:14px; }
        .diffraction-report .score-banner { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#fff8e8,#ffe8cc); border:3px solid #ff9800; border-radius:14px; padding:18px 24px; margin-bottom:26px; box-shadow:0 8px 24px rgba(255,152,0,.15); }
        .diffraction-report .score-banner .score-value { font-size:42px; font-weight:800; color:#ef6c00; }
        .diffraction-report .score-badge { display:inline-block; background:#ff9800; color:#fff; padding:4px 14px; border-radius:999px; font-size:13px; font-weight:700; margin-left:10px; }
        .diffraction-report .section-title { font-size:20px; font-weight:700; color:#1a237e; border-left:5px solid #3f51b5; padding-left:12px; margin:28px 0 16px; }
        .diffraction-report .principle-box { background:linear-gradient(135deg,#e8f4fd,#f3e8ff); border:1px solid #b3d4fc; border-radius:12px; padding:18px 20px; }
        .diffraction-report .formula-card { text-align:center; background:#fff; border:2px dashed #5c6bc0; border-radius:10px; padding:14px; margin:14px 0; font-size:18px; color:#283593; font-weight:600; }
        .diffraction-report .steps-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:16px 0; }
        .diffraction-report .step-card { background:#fff; border-radius:12px; padding:16px 12px; text-align:center; box-shadow:0 4px 14px rgba(0,0,0,.06); border-top:4px solid var(--accent,#3f51b5); }
        .diffraction-report .step-card .num { display:inline-flex; width:28px; height:28px; border-radius:50%; align-items:center; justify-content:center; color:#fff; font-weight:700; margin-bottom:8px; background:var(--accent,#3f51b5); }
        .diffraction-report .step-card h4 { margin:0 0 6px; font-size:15px; color:#1a237e; }
        .diffraction-report .step-card p { margin:0; font-size:12px; color:#607d8b; line-height:1.5; }
        .diffraction-report table { width:100%; border-collapse:collapse; margin:14px 0; font-size:13px; }
        .diffraction-report th { color:#fff; padding:10px 8px; text-align:center; }
        .diffraction-report td { border:1px solid #e0e6ef; padding:9px 8px; text-align:center; background:#fff; }
        .diffraction-report tr:nth-child(even) td { background:#f8fbff; }
        .diffraction-report .tbl-blue th { background:linear-gradient(135deg,#1976d2,#42a5f5); }
        .diffraction-report .tbl-purple th { background:linear-gradient(135deg,#7b1fa2,#ab47bc); }
        .diffraction-report .tbl-orange th { background:linear-gradient(135deg,#ef6c00,#ffb74d); color:#4e342e; }
        .diffraction-report .calc-box { background:linear-gradient(135deg,#fff3e0,#ffe0b2); border:2px solid #ff9800; border-radius:12px; padding:16px 18px; margin:16px 0; }
        .diffraction-report .calc-box h4 { margin:0 0 12px; color:#e65100; }
        .diffraction-report .graph-wrap { background:#fff; border:1px solid #dce4f2; border-radius:12px; padding:16px; text-align:center; margin:16px 0; box-shadow:0 4px 16px rgba(0,0,0,.05); }
        .diffraction-report .graph-caption { margin-top:10px; font-size:13px; color:#607d8b; font-style:italic; }
        .diffraction-report .score-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:16px 0; }
        .diffraction-report .score-card { border-radius:12px; padding:16px; color:#fff; text-align:center; box-shadow:0 6px 18px rgba(0,0,0,.12); }
        .diffraction-report .score-card.blue { background:linear-gradient(135deg,#1976d2,#64b5f6); }
        .diffraction-report .score-card.green { background:linear-gradient(135deg,#2e7d32,#66bb6a); }
        .diffraction-report .score-card.orange { background:linear-gradient(135deg,#ef6c00,#ffb74d); }
        .diffraction-report .score-card .val { font-size:28px; font-weight:800; margin:6px 0; }
        .diffraction-report .score-card .sub { font-size:12px; opacity:.9; }
        .diffraction-report .conclusion-box { background:linear-gradient(135deg,#e8f5e9,#f1f8e9); border-left:5px solid #43a047; border-radius:12px; padding:18px 20px; margin:16px 0; }
        .diffraction-report .error-box { background:linear-gradient(135deg,#fce4ec,#f8bbd0); border-left:5px solid #e91e63; border-radius:12px; padding:18px 20px; margin:16px 0; }
        .diffraction-report .question-card { background:#fff; border-left:4px solid #7e57c2; border-radius:10px; padding:14px 16px; margin:12px 0; box-shadow:0 3px 10px rgba(0,0,0,.04); }
        .diffraction-report .question-card strong { color:#5e35b1; }
        .diffraction-report .tag { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; color:#fff; margin-right:6px; }
        .diffraction-report .tag-red { background:#e53935; }
        .diffraction-report .tag-green { background:#43a047; }
        .diffraction-report ul, .diffraction-report ol { padding-left:22px; }
        .diffraction-report li { margin-bottom:6px; }
        @media (max-width:800px) { .diffraction-report .steps-grid, .diffraction-report .score-cards { grid-template-columns:1fr 1fr; } }
        `;
    }

    function buildLinearFitGraph(measurements, params, color, label) {
        const pts = measurements.map(function (m, i) {
            const k = m.index || i + 1;
            const y = Math.abs(m.position);
            return { k: k, y: y };
        });
        if (!pts.length) return '';
        const maxK = Math.max.apply(null, pts.map(function (p) { return p.k; }));
        const maxY = Math.max.apply(null, pts.map(function (p) { return p.y; })) * 1.15;
        const x0 = 60, y0 = 240, w = 360, h = 180;
        const circles = pts.map(function (p) {
            const cx = x0 + (p.k / maxK) * w;
            const cy = y0 - (p.y / maxY) * h;
            return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="' + color + '"></circle>';
        }).join('');
        const x1 = x0, y1 = y0 - (pts[0].y / maxY) * h;
        const x2 = x0 + w, y2 = y0 - (pts[pts.length - 1].y / maxY) * h;
        return '<svg width="100%" height="280" viewBox="0 0 480 280" style="max-width:520px;">' +
            '<rect x="0" y="0" width="480" height="280" fill="#fafcff" rx="8"></rect>' +
            '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + (x0 + w) + '" y2="' + y0 + '" stroke="#90a4ae" stroke-width="2"></line>' +
            '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x0 + '" y2="' + (y0 - h) + '" stroke="#90a4ae" stroke-width="2"></line>' +
            '<text x="250" y="268" text-anchor="middle" font-size="13" fill="#546e7a">暗纹级次 k</text>' +
            '<text x="18" y="140" font-size="13" fill="#546e7a" transform="rotate(-90 18 140)">位置 |y| (mm)</text>' +
            circles +
            '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="2.5" opacity=".7"></line>' +
            '<rect x="300" y="18" width="160" height="28" fill="#fff" stroke="#dce4f2" rx="6"></rect>' +
            '<circle cx="316" cy="32" r="5" fill="' + color + '"></circle>' +
            '<text x="328" y="36" font-size="12" fill="#37474f">' + label + ' (λ=' + params.lambdaNm + 'nm)</text>' +
            '</svg>';
    }

    function buildDualWavelengthData(baseMeasurements, baseLambda) {
        const greenLambda = 532;
        const ratio = baseLambda / greenLambda;
        return baseMeasurements.map(function (row) {
            return {
                index: row.index,
                type: row.type,
                position: row.position / ratio,
                deltaY: row.deltaY != null ? row.deltaY / ratio : null
            };
        });
    }

    function buildDataTable(measurements, tableClass, wavelengthLabel) {
        const rows = measurements.map(function (row) {
            return '<tr><td>' + row.index + '</td><td>' + row.type + '</td><td>' +
                Math.abs(row.position).toFixed(3) + '</td><td>' +
                (row.deltaY != null ? row.deltaY.toFixed(3) : '—') + '</td></tr>';
        }).join('');
        return '<h4 style="margin:14px 0 8px;color:#37474f;">' + wavelengthLabel + '</h4>' +
            '<table class="' + tableClass + '"><thead><tr>' +
            '<th>序号</th><th>条纹类型</th><th>位置 |y| (mm)</th><th>相邻间距 Δy (mm)</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function computeReportScores(measurements, params, calcSlit) {
        const count = measurements.length;
        const relErr = Math.abs(calcSlit - params.slitMm) / params.slitMm * 100;
        const opScore = count >= 6 ? 20 : (count >= 3 ? 16 : 10);
        const measScore = relErr < 3 ? 40 : (relErr < 8 ? 32 : (relErr < 15 ? 24 : 12));
        const calcScore = relErr < 5 ? 40 : (relErr < 12 ? 30 : 20);
        const total = opScore + measScore + calcScore;
        let level = '不及格';
        if (total >= 90) level = '优秀';
        else if (total >= 80) level = '良好';
        else if (total >= 70) level = '中等';
        else if (total >= 60) level = '及格';
        return { total: total, level: level, opScore: opScore, measScore: measScore, calcScore: calcScore, relErr: relErr };
    }

    /**
     * 生成实验报告内容
     * @returns {string} HTML格式的报告内容
     */
    function generateReportContent() {
        const studentName = document.getElementById('student-name').value || '未填写';
        const studentId = document.getElementById('student-id').value || '未填写';
        const includeData = document.getElementById('include-data').checked;
        const includeError = document.getElementById('include-error-analysis').checked;
        const includeQuestions = document.getElementById('include-thinking-questions').checked;
        const measurements = getReportMeasurements();
        const greenMeasurements = buildDualWavelengthData(measurements, getReportParameters().lambdaNm);
        const params = getReportParameters();
        const greenParams = { lambdaNm: 532, focalMm: params.focalMm, slitMm: params.slitMm };
        const deltaYValues = measurements.map(function (row) { return row.deltaY; }).filter(function (v) { return v != null && !isNaN(v); });
        const avgDeltaY = deltaYValues.length
            ? deltaYValues.reduce(function (a, b) { return a + b; }, 0) / deltaYValues.length
            : 3.16;
        const calcSlit = params.lambdaNm * 1e-6 * params.focalMm / avgDeltaY;
        const calcSlitGreen = greenParams.lambdaNm * 1e-6 * greenParams.focalMm / (avgDeltaY * params.lambdaNm / greenParams.lambdaNm);
        const scores = computeReportScores(measurements, params, calcSlit);
        const currentDate = new Date().toLocaleDateString('zh-CN');

        let html = '<style>' + getReportStyles() + '</style>' +
            '<div class="diffraction-report">' +
            '<div class="report-topbar"><span>夫琅禾费单缝衍射虚拟仿真实验平台</span><span>物理实验报告</span></div>' +
            '<div class="report-title">夫琅禾费单缝衍射实验报告</div>' +
            '<div class="info-bar">' +
            '<span><strong>姓名：</strong>' + studentName + '</span>' +
            '<span><strong>学号：</strong>' + studentId + '</span>' +
            '<span><strong>日期：</strong>' + currentDate + '</span>' +
            '</div>' +
            '<div class="score-banner">' +
            '<div><strong style="font-size:18px;color:#e65100;">实验总分</strong></div>' +
            '<div><span class="score-value">' + scores.total.toFixed(1) + ' 分</span>' +
            '<span class="score-badge">' + scores.level + '</span></div>' +
            '</div>' +

            '<div class="section-title">一、实验原理</div>' +
            '<div class="principle-box">' +
            '<p>夫琅禾费衍射要求光源、单缝、透镜与接收屏满足远场条件。平行光通过宽度为 <em>a</em> 的单缝后，在透镜焦平面上形成衍射图样。单缝各点发出的子波相干叠加，强度分布为：</p>' +
            '<div class="formula-card">I/I₀ = (sinβ/β)²，β = πax/(λf)</div>' +
            '<p>第 <em>k</em> 级暗纹位置：y<sub>k</sub> ≈ kλf/a；相邻暗纹间距 Δy ≈ λf/a；中央明纹宽度 Δx₀ ≈ 2λf/a。</p>' +
            '<p>因此，测量暗纹间距即可反推缝宽：<strong>a ≈ λf/Δy</strong>。缝宽越小或波长越长，衍射条纹越宽，现象越明显。</p>' +
            '</div>' +

            '<div class="section-title">二、实验步骤</div>' +
            '<div class="steps-grid">' +
            '<div class="step-card" style="--accent:#1976d2"><div class="num">1</div><h4>调节光路</h4><p>使激光器、单缝、透镜与接收屏共轴，满足夫琅禾费条件</p></div>' +
            '<div class="step-card" style="--accent:#7b1fa2"><div class="num">2</div><h4>放置单缝</h4><p>选择合适缝宽，保证衍射条纹清晰可辨</p></div>' +
            '<div class="step-card" style="--accent:#00897b"><div class="num">3</div><h4>观察图样</h4><p>在接收屏上观察中央明纹与两侧对称暗纹、次级明纹</p></div>' +
            '<div class="step-card" style="--accent:#ef6c00"><div class="num">4</div><h4>测量暗纹</h4><p>记录各级暗纹位置，计算 Δy 并反推缝宽 a</p></div>' +
            '</div>' +

            '<div class="section-title">三、实验仪器与参数</div>' +
            '<div class="principle-box" style="background:linear-gradient(135deg,#e0f7fa,#e8eaf6);">' +
            '<ul style="margin:0;">' +
            '<li><span class="tag tag-red">He-Ne 激光</span>波长 λ = ' + params.lambdaNm + ' nm</li>' +
            '<li><span class="tag tag-green">半导体激光</span>对比波长 λ = 532 nm（拓展测量）</li>' +
            '<li>单缝宽度设定值 a = ' + params.slitMm.toFixed(3) + ' mm</li>' +
            '<li>透镜焦距 f = ' + params.focalMm + ' mm</li>' +
            '<li>接收屏：观察夫琅禾费衍射条纹分布</li>' +
            '</ul></div>';

        if (includeData) {
            html += '<div class="section-title">四、数据采集与处理</div>' +
                buildDataTable(measurements, 'tbl-blue', '【He-Ne 红光】暗纹位置测量数据') +
                buildDataTable(greenMeasurements, 'tbl-purple', '【绿光拓展】暗纹位置测量数据（同缝宽对比）') +

                '<div class="calc-box">' +
                '<h4>【He-Ne 红光】缝宽反推详细计算</h4>' +
                '<table class="tbl-orange"><thead><tr>' +
                '<th>计算步骤</th><th>公式</th><th>代入数值</th><th>结果</th>' +
                '</tr></thead><tbody>' +
                '<tr><td>① 求平均间距</td><td>Δy = mean(Δy<sub>k</sub>)</td><td>多组暗纹</td><td>' + avgDeltaY.toFixed(3) + ' mm</td></tr>' +
                '<tr><td>② 反推缝宽</td><td>a = λf/Δy</td><td>' + params.lambdaNm + 'nm, ' + params.focalMm + 'mm</td><td>' + calcSlit.toFixed(4) + ' mm</td></tr>' +
                '<tr><td>③ 与设定值比较</td><td>相对误差</td><td>设定 a=' + params.slitMm.toFixed(3) + 'mm</td><td>' + scores.relErr.toFixed(2) + '%</td></tr>' +
                '<tr><td>④ 绿光验证</td><td>a = λf/Δy</td><td>532nm</td><td>' + calcSlitGreen.toFixed(4) + ' mm</td></tr>' +
                '</tbody></table></div>' +

                '<div class="section-title">五、|y|–k 关系曲线</div>' +
                '<div class="graph-wrap">' +
                buildLinearFitGraph(measurements, params, '#e53935', 'He-Ne 红光') +
                '<p class="graph-caption">图1：暗纹位置 |y| 随级次 k 的线性关系（理论斜率 ≈ λf/a）</p>' +
                '</div>';
        }

        html += '<div class="section-title">六、评分详情</div>' +
            '<div class="score-cards">' +
            '<div class="score-card blue"><div>操作规范得分</div><div class="val">' + scores.opScore.toFixed(1) + '</div><div class="sub">满分 20</div></div>' +
            '<div class="score-card green"><div>测量精度得分</div><div class="val">' + scores.measScore.toFixed(1) + '</div><div class="sub">满分 40</div></div>' +
            '<div class="score-card orange"><div>计算准确得分</div><div class="val">' + scores.calcScore.toFixed(1) + '</div><div class="sub">满分 40</div></div>' +
            '</div>' +
            '<table class="tbl-blue"><thead><tr><th>评分维度</th><th>得分</th><th>满分</th><th>说明</th></tr></thead><tbody>' +
            '<tr><td>操作规范</td><td>' + scores.opScore.toFixed(1) + '</td><td>20</td><td>共记录 ' + measurements.length + ' 个暗纹测量点</td></tr>' +
            '<tr><td>测量精度</td><td>' + scores.measScore.toFixed(1) + '</td><td>40</td><td>反推缝宽相对误差 ' + scores.relErr.toFixed(2) + '%</td></tr>' +
            '<tr><td>计算准确</td><td>' + scores.calcScore.toFixed(1) + '</td><td>40</td><td>双波长验证与公式应用</td></tr>' +
            '</tbody></table>';

        if (includeError) {
            html += '<div class="section-title">七、误差分析</div>' +
                '<div class="error-box">' +
                '<p><strong>系统误差：</strong>入射光未完全准直；单缝边缘不规则；透镜焦距标定偏差；接收屏未严格位于焦平面。</p>' +
                '<p><strong>随机误差：</strong>暗纹中心判读主观性；条纹对比度不足；光路微调引起条纹漂移。</p>' +
                '<p><strong>改进措施：</strong>保证缝与光轴垂直；多次测量取平均；用 y<sub>k</sub> 对 k 线性拟合；对比红/绿光结果验证。</p>' +
                '</div>';
        }

        html += '<div class="section-title">八、实验结论</div>' +
            '<div class="conclusion-box">' +
            '<p><strong>1. 测量结果：</strong>由 Δy = ' + avgDeltaY.toFixed(3) + ' mm 反推缝宽 a ≈ ' + calcSlit.toFixed(4) + ' mm，与设定值 ' + params.slitMm.toFixed(3) + ' mm 相比，相对误差 ' + scores.relErr.toFixed(2) + '%。</p>' +
            '<p><strong>2. 双波长验证：</strong>同一缝宽下，绿光条纹间距小于红光，符合 Δy ∝ λ 的关系。</p>' +
            '<p><strong>3. 线性关系：</strong>|y| 与 k 近似成正比，验证了 y<sub>k</sub> = kλf/a 的夫琅禾费单缝衍射规律。</p>' +
            '<p><strong>4. 物理结论：</strong>光的衍射是波动性的直接证据；缝宽越小，衍射越显著，体现了孔径对光波传播的调制作用。</p>' +
            '</div>';

        if (includeQuestions) {
            html += '<div class="section-title">九、拓展思考题</div>' +
                '<div class="question-card"><p><strong>1. 缝宽减小时，衍射条纹如何变化？</strong></p>' +
                '<p>缝宽 a 减小 → Δy = λf/a 增大，中央明纹变宽，次级条纹间距变大，衍射现象更显著。</p></div>' +
                '<div class="question-card"><p><strong>2. 夫琅禾费衍射实验为何需要透镜？</strong></p>' +
                '<p>透镜将不同衍射角的光会聚到焦平面，焦面强度分布等价于远场夫琅禾费图样，便于观察和测量。</p></div>' +
                '<div class="question-card"><p><strong>3. 圆孔与单缝衍射图样有何不同？</strong></p>' +
                '<p>圆孔形成轴对称艾里斑；单缝在垂直于缝的方向呈条纹状分布，为一维 sinc² 调制。</p></div>';
        }

        html += '</div>';
        return html;
    }

    function buildFullReportDocument(content, title) {
        return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
            '<title>' + title + '</title><style>' +
            'body{margin:0;padding:20px;background:#eef2f7;}' +
            getReportStyles() +
            '.diffraction-report{max-width:920px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,.08);}' +
            '@media print{body{background:#fff;padding:0}.diffraction-report{box-shadow:none;padding:12px}}' +
            '</style></head><body>' + content + '</body></html>';
    }
    
    /**
     * 显示报告预览模态框
     */
    function showReportPreview() {
        try {
            console.log('显示报告预览...');
            const content = generateReportContent();
            const reportContent = document.getElementById('report-content');
            
            if (reportContent) {
                reportContent.innerHTML = content;
                modal.style.display = 'block';
            } else {
                console.error('未找到报告内容容器');
                alert('无法显示报告预览，请刷新页面重试。');
            }
        } catch (error) {
            console.error('预览报告时发生错误:', error);
            alert('预览报告失败: ' + error.message);
        }
    }
    
    /**
     * 打印实验报告
     */
    function printReport() {
        try {
            console.log('打印报告...');
            const content = generateReportContent();
            
            // 创建打印窗口
            const printWindow = window.open('', '_blank', 'height=900,width=1000');
            
            if (!printWindow) {
                throw new Error('无法创建打印窗口，请允许弹出窗口');
            }
            
            printWindow.document.write(buildFullReportDocument(content, '夫琅禾费单缝衍射实验报告'));
            
            printWindow.document.close();
            
            // 等待页面加载后打印
            printWindow.onload = function() {
                setTimeout(() => {
                    try {
                        printWindow.print();
                        printWindow.close();
                    } catch (error) {
                        console.error('打印过程中发生错误:', error);
                        alert('打印过程中发生错误: ' + error.message);
                    }
                }, 500);
            };
        } catch (error) {
            console.error('打印报告时发生错误:', error);
            alert('打印报告失败: ' + error.message);
        }
    }
    
    /**
     * 下载实验报告
     */
    function downloadReport() {
        try {
            console.log('下载报告...');
            const studentName = document.getElementById('student-name').value || '未命名';
            const studentId = document.getElementById('student-id').value || '无学号';
            const currentDate = new Date().toLocaleDateString('zh-CN').replace(/\/\//g, '-');
            const content = generateReportContent();
            const fullHtml = buildFullReportDocument(content, '夫琅禾费单缝衍射实验报告');
            
            // 创建Blob对象
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            
            // 文件名
            const filename = `夫琅禾费单缝衍射实验报告_${studentName}_${studentId}_${currentDate}.html`;
            
            // 浏览器兼容性处理
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                // 用于Internet Explorer
                window.navigator.msSaveOrOpenBlob(blob, filename);
                console.log('使用IE下载方式');
            } else {
                // 为现代浏览器创建下载链接
                console.log('使用现代浏览器下载方式');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                
                // 添加到文档并触发点击
                document.body.appendChild(a);
                a.click();
                
                // 延迟移除元素
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    console.log('下载完成，资源已清理');
                }, 100);
            }
        } catch (error) {
            console.error('下载报告时发生错误:', error);
            alert('下载报告失败: ' + error.message);
        }
    }
    
    // 绑定按钮事件
    previewBtn.addEventListener('click', showReportPreview);
    printBtn.addEventListener('click', printReport);
    downloadBtn.addEventListener('click', downloadReport);

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (modalPrintBtn) {
        modalPrintBtn.addEventListener('click', printReport);
    }

    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', downloadReport);
    }

    window.previewDiffractionReport = showReportPreview;
    window.printDiffractionReport = printReport;
    window.downloadDiffractionReport = downloadReport;

    console.log('实验报告生成功能初始化完成');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportGeneration);
    } else {
        initReportGeneration();
    }
})(); 