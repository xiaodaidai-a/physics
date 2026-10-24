/**
 * 液相旋光实验 - 报告生成器
 *
 * 基于实验数据和配置，生成专业格式的 HTML 双轨报告（物理实验报告 + 课程思政报告）。
 * 报告采用内联样式设计，确保打印和 PDF 导出效果一致。
 *
 * @module experiment-report-generator
 * @version 1.0.0
 */

const ReportGenerator = {
    // ==================== 公开接口：生成物理实验报告 ====================

    /**
     * 生成完整的物理实验报告 HTML 字符串
     *
     * 报告结构：
     * 1. 封面信息（学生信息、实验名称、日期）
     * 2. 实验目的
     * 3. 实验原理（含公式）
     * 4. 实验仪器
     * 5. 原始数据记录表
     * 6. 数据处理（拟合结果、计算过程）
     * 7. 误差分析（如有）
     * 8. 实验结论
     *
     * @public
     * @param {Object} data - 完整的实验数据对象
     * @param {Object} [config] - 可选的配置覆盖项
     * @returns {string} 完整的 HTML 文档字符串
     */
    generatePhysicsReport(data, config = {}) {
        const cfg = typeof ReportConfig !== 'undefined'
            ? ReportConfig.mergeOptions(config)
            : this._getDefaultConfig(config);

        const studentInfo = data.studentInfo || {};
        const measurements = (data.measurements || []).filter(m => m.deltaA !== null && m.deltaA !== undefined);
        const calibration = data.calibration || {};
        const template = (typeof ReportConfig !== 'undefined' && ReportConfig.templates)
            ? ReportConfig.templates.physics
            : null;

        // 执行线性拟合
        const fitResult = measurements.length >= 2 ? this._performLinearFit(measurements) : null;

        // 构建各章节内容
        const sections = [];

        // 封面
        sections.push(this._buildCoverSection(studentInfo, cfg, template));

        // 一、实验目的
        sections.push(this._buildPurposeSection(template));

        // 二、实验原理
        sections.push(this._buildPrincipleSection(template));

        // 三、实验仪器
        sections.push(this._buildApparatusSection(template, data.config));

        // 四、原始数据记录
        sections.push(this._buildDataSection(measurements, calibration, cfg));

        // 五、数据处理
        sections.push(this._buildProcessingSection(measurements, fitResult, cfg));

        // 六、误差分析
        if (cfg.includeErrorAnalysis) {
            sections.push(this._buildErrorAnalysisSection(cfg));
        }

        // 七、实验结论
        sections.push(this._buildConclusionSection(fitResult, measurements, template));

        return this._wrapHTML(sections.join('\n'), template ? template.title : '液相旋光法测定蔗糖溶液比旋光度 -- 实验报告', cfg);
    },

    // ==================== 公开接口：生成课程思政报告 ====================

    /**
     * 生成课程思政学习报告 HTML 字符串
     *
     * 报告结构：
     * 1. 思政主题阐述
     * 2. 应用案例摘要
     * 3. 思考题答案 / 学习心得
     * 4. 总结与展望
     *
     * @public
     * @param {Object} data - 实验数据（用于提取基本信息）
     * @param {Object} answers - 学生提交的思政作答
     * @returns {string} 完整的 HTML 文档字符串
     */
    generateIdeologicalReport(data, answers = {}) {
        const cfg = typeof ReportConfig !== 'undefined'
            ? ReportConfig.mergeOptions({})
            : this._getDefaultConfig({});
        const template = (typeof ReportConfig !== 'undefined' && ReportConfig.templates)
            ? ReportConfig.templates.ideological
            : null;
        const studentInfo = data.studentInfo || {};

        const sections = [];

        // 封面
        sections.push(this._buildIdeologicalCover(studentInfo, cfg, template));

        // 一、思政主题
        sections.push(this._buildIdeologicalThemeSection(template));

        // 二、应用案例
        sections.push(this._buildApplicationCasesSection(template));

        // 三、学习心得与思考
        sections.push(this._buildReflectionSection(answers, template));

        // 四、总结与展望
        sections.push(this._buildIdeologicalConclusionSection(answers, template));

        return this._wrapHTML(
            sections.join('\n'),
            template ? template.title : '国计民生中的测量精度与工匠精神 -- 课程思政学习报告',
            cfg,
            true // 标记为思政报告样式
        );
    },

    // ==================== 公开接口：预览报告 ====================

    /**
     * 在新窗口中预览生成的报告
     *
     * 支持两种模式：
     * - 新窗口模式（默认）：打开浏览器新标签页显示完整报告
     * - 模态框模式：将内容写入指定的 DOM 元素中
     *
     * @public
     * @param {string} htmlContent - 报告 HTML 内容
     * @param {string} title - 报告标题（用于窗口标题）
     * @param {HTMLElement|string} [target] - 模态框目标元素或选择器（可选）
     */
    previewReport(htmlContent, title, target) {
        if (target) {
            // 模态框/容器模式
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            if (el) {
                el.innerHTML = htmlContent;
                // 触发打印样式的应用
                const printStyle = this._getPreviewStyles();
                const styleEl = document.createElement('style');
                styleEl.textContent = printStyle;
                el.insertBefore(styleEl, el.firstChild);
            } else {
                console.warn('[ReportGenerator] 未找到目标元素:', target);
            }
        } else {
            // 新窗口模式
            try {
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(htmlContent);
                    win.document.close();
                } else {
                    console.warn('[ReportGenerator] 弹窗被阻止，请允许弹出窗口后重试');
                    alert('报告预览窗口被浏览器阻止，请允许弹出窗口后重试。');
                }
            } catch (e) {
                console.error('[ReportGenerator] 预览失败:', e);
            }
        }
    },

    // ==================== 物理报告章节构建方法 ====================

    /**
     * 构建封面信息章节
     * @private
     */
    _buildCoverSection(studentInfo, cfg, template) {
        const title = template ? template.title : '液相旋光法测定蔗糖溶液比旋光度 -- 实验报告';
        const now = new Date();
        const dateStr = studentInfo.date || now.toISOString().split('T')[0];
        const timeStr = cfg.showTimestamp ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}` : '';

        let schoolInfo = '';
        if (cfg.schoolName) schoolInfo += `<div class="cover-school">${this._escapeHtml(cfg.schoolName)}</div>`;
        if (cfg.departmentName) schoolInfo += `<div class="cover-department">${this._escapeHtml(cfg.departmentName)}</div>`;

        return `
        <div class="page-cover">
            ${schoolInfo}
            <h1 class="cover-title">${title}</h1>
            <div class="cover-info-table">
                <table>
                    <tr><td class="info-label">姓　　名</td><td class="info-value">${this._escapeHtml(studentInfo.name || '____________')}</td></tr>
                    <tr><td class="info-label">学　　号</td><td class="info-value">${this._escapeHtml(studentInfo.studentId || '____________')}</td></tr>
                    <tr><td class="info-label">班　　级</td><td class="info-value">${this._escapeHtml(studentInfo.className || '____________')}</td></tr>
                    <tr><td class="info-label">实验日期</td><td class="info-value">${dateStr}</td></tr>
                </table>
            </div>
            ${timeStr ? `<div class="cover-timestamp">报告生成时间: ${timeStr}</div>` : ''}
        </div>`;
    },

    /**
     * 构建"一、实验目的"章节
     * @private
     */
    _buildPurposeSection(template) {
        const items = (template && template.defaultContent && template.defaultContent.purpose)
            || [
                '1. 了解旋光现象的基本原理，掌握旋光仪的使用方法。',
                '2. 测定蔗糖溶液在不同浓度下的旋光度，绘制旋光度-浓度关系曲线。',
                '3. 利用最小二乘法拟合直线，计算蔗糖溶液的比旋光度。',
                '4. 理解温度对旋光度的影响，学会温度修正方法。'
            ];

        const listItems = items.map(item => `<li>${item}</li>`).join('\n');

        return `
        <div class="section" id="section-purpose">
            <h2 class="section-title">一、实验目的</h2>
            <div class="section-body">
                <ol class="purpose-list">
                    ${listItems}
                </ol>
            </div>
        </div>`;
    },

    /**
     * 构建"二、实验原理"章节（含公式）
     * @private
     */
    _buildPrincipleSection(template) {
        const content = (template && template.defaultContent && template.defaultContent.principle)
            || `当线偏振光通过某些物质（如蔗糖溶液）时，其振动面会发生旋转，
               这种现象称为<strong>旋光现象</strong>。旋转的角度称为<strong>旋光度</strong>，用 &alpha; 表示。

               对于溶液体系，旋光度遵循以下规律：

               <div class="formula-block">
                   &alpha; = [&alpha;]<sub>t</sub><sup>&lambda;</sup> &middot; c &middot; L
               </div>

               其中：
               <ul class="formula-legend">
                   <li>&alpha; 为测得的旋光度（度）</li>
                   <li>[&alpha;]<sub>t</sub><sup>&lambda;</sup> 为比旋光度（&deg;&middot;mL/(dm&middot;g)），是物质的特性常数</li>
                   <li>c 为溶液浓度（g/mL）</li>
                   <li>L 为旋光管长度（dm）</li>
               </ul>

               比旋光度随温度变化的经验公式为：

               <div class="formula-block">
                   [&alpha;]<sub>t</sub> = [&alpha;]<sub>20</sub> &minus; k(t &minus; 20)
               </div>

               其中 k 为温度系数（对于蔗糖约为 0.00014 &deg;/(&deg;C)）。`;

        return `
        <div class="section" id="section-principle">
            <h2 class="section-title">二、实验原理</h2>
            <div class="section-body principle-content">
                ${content}
            </div>
        </div>`;
    },

    /**
     * 构建"三、实验仪器"章节
     * @private
     */
    _buildApparatusSection(template, expConfig) {
        const items = (template && template.defaultContent && template.defaultContent.apparatus)
            || [
                'WXG-4 型圆盘旋光仪',
                '钠光灯（波长 &lambda; = 589.3 nm）',
                '旋光管（L = 1 dm / 2 dm）',
                '蔗糖溶液（多种浓度）',
                '蒸馏水（用于零点校准）'
            ];

        // 补充本次实验的实际参数
        let paramInfo = '';
        if (expConfig) {
            paramInfo = `
                <div class="apparatus-params">
                    <strong>本次实验参数：</strong>
                    <ul>
                        ${expConfig.wavelength ? `<li>光源波长: ${expConfig.wavelength} nm</li>` : ''}
                        ${expConfig.deltaAngle !== undefined ? `<li>半荫片夹角: ${expConfig.deltaAngle}&deg;</li>` : ''}
                        ${expConfig.alpha20 !== undefined ? `<li>参考比旋光度 [α]<sub>20</sub>: ${expConfig.alpha20} &deg;&middot;mL/(dm&middot;g)</li>` : ''}
                    </ul>
                </div>`;
        }

        const listItems = items.map(item => `<li>${item}</li>`).join('\n');

        return `
        <div class="section" id="section-apparatus">
            <h2 class="section-title">三、实验仪器</h2>
            <div class="section-body">
                <ul class="apparatus-list">
                    ${listItems}
                </ul>
                ${paramInfo}
            </div>
        </div>`;
    },

    /**
     * 构建"四、原始数据记录"章节
     * @private
     */
    _buildDataSection(measurements, calibration, cfg) {
        if (measurements.length === 0) {
            return `
            <div class="section" id="section-data">
                <h2 class="section-title">四、原始数据记录</h2>
                <div class="section-body">
                    <p class="no-data-warning">暂无有效测量数据。</p>
                </div>
            </div>`;
        }

        // 零点校准信息
        let calibRow = '';
        if (calibration.A0 !== null) {
            calibRow = `
                <tr class="calibration-row">
                    <td colspan="7" class="calibration-cell">
                        <strong>零点校准读数 A<sub>0</sub>:</strong> ${calibration.A0.toFixed(2)}&deg;
                    </td>
                </tr>`;
        }

        // 数据表格行
        const rows = measurements.map((m, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${m.concentration.toFixed(4)}</td>
                <td>${m.temperature.toFixed(1)}</td>
                <td>${m.tubeLength}</td>
                <td>${(m.A0 !== null ? m.A0.toFixed(2) : '--')}</td>
                <td>${(m.A !== null ? m.A.toFixed(2) : '--')}</td>
                <td>${(m.deltaA !== null ? m.deltaA.toFixed(4) : '--')}</td>
            </tr>
        `).join('');

        return `
        <div class="section" id="section-data">
            <h2 class="section-title">四、原始数据记录</h2>
            <div class="section-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th rowspan="2">序号</th>
                            <th rowspan="2">浓度 c<br/>(g/mL)</th>
                            <th rowspan="2">温度 t<br/>(&deg;C)</th>
                            <th rowspan="2">管长 L<br/>(dm)</th>
                            <th colspan="3">旋光度 (&deg;)</th>
                        </tr>
                        <tr>
                            <th>A<sub>0</sub></th>
                            <th>A</th>
                            <th>&Delta;A = A &minus; A<sub>0</sub></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${calibRow}
                        ${rows}
                    </tbody>
                </table>
                <p class="table-note">注: A<sub>0</sub> 为零点校准读数; A 为放入溶液后的读数; &Delta;A 为旋光度。</p>
            </div>
        </div>`;
    },

    /**
     * 构建"五、数据处理"章节
     * @private
     */
    _buildProcessingSection(measurements, fitResult, cfg) {
        if (!fitResult || measurements.length < 2) {
            return `
            <div class="section" id="section-processing">
                <h2 class="section-title">五、数据处理</h2>
                <div class="section-body">
                    <p class="no-data-warning">测量数据不足，无法进行数据处理（至少需要 2 组有效数据）。</p>
                </div>
            </div>`;
        }

        const alpha = fitResult.slope;
        const r2 = fitResult.rSquared;
        const theoreticalAlpha = 66.37;
        const relError = Math.abs((alpha - theoreticalAlpha) / theoreticalAlpha) * 100;

        // 计算结果表格
        const resultRows = fitResult.residuals.map(r => `
            <tr>
                <td>${r.x.toFixed(4)}</td>
                <td>${r.y.toFixed(4)}</td>
                <td>${r.predicted.toFixed(4)}</td>
                <td>${r.residual.toFixed(4)}</td>
            </tr>
        `).join('');

        return `
        <div class="section" id="section-processing">
            <h2 class="section-title">五、数据处理</h2>
            <div class="section-body">
                <h3 class="subsection-title">5.1 最小二乘法线性拟合</h3>
                <p>根据公式 &alpha; = [&alpha;] &middot; c &middot; L，令 x = c &middot; L, y = &Delta;A，进行过原点的线性拟合 y = kx：</p>

                <div class="fit-result-box">
                    <div class="fit-formula">
                        <strong>拟合方程:</strong> &Delta;A = (${alpha.toFixed(4)}) &times; (c &times; L)
                    </div>
                    <div class="fit-results-grid">
                        <div class="result-item">
                            <span class="result-label">测得比旋光度 [&alpha;]</span>
                            <span class="result-value">${alpha.toFixed(2)} &deg;&middot;mL/(dm&middot;g)</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">理论值 [&alpha;]<sub>20</sub></span>
                            <span class="result-value">${theoreticalAlpha.toFixed(2)} &deg;&middot;mL/(dm&middot;g)</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">相对误差 E<sub>r</sub></span>
                            <span class="result-value ${relError > 8 ? 'error-high' : relError > 5 ? 'error-medium' : ''}">${relError.toFixed(2)}%</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">拟合优度 R&sup2;</span>
                            <span class="result-value ${r2 >= 0.95 ? 'r2-good' : r2 >= 0.85 ? 'r2-ok' : 'r2-poor'}">${r2.toFixed(4)}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">数据组数 n</span>
                            <span class="result-value">${measurements.length}</span>
                        </div>
                    </div>
                </div>

                <h3 class="subsection-title">5.2 各测量点残差分析</h3>
                <table class="data-table residual-table">
                    <thead>
                        <tr>
                            <th>x = c &times; L<br/>(g&middot;dm/mL)</th>
                            <th>y = &Delta;A<br/>(&deg;)</th>
                            <th>y<sub>预测</sub><br/>(&deg;)</th>
                            <th>残差<br/>(&deg;)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resultRows}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    /**
     * 构建"六、误差分析"章节
     * @private
     */
    _buildErrorAnalysisSection(cfg) {
        // 获取参考误差源
        const errorSources = (typeof ReportConfig !== 'undefined') ? ReportConfig.errorSources : [];
        const hasSources = errorSources && errorSources.length > 0;

        let sourceList = '';
        if (hasSources) {
            sourceList = errorSources.map(cat => `
                <div class="error-category">
                    <h4 class="error-cat-title">${cat.category}</h4>
                    <ul class="error-items">
                        ${cat.items.map(item => `
                            <li>
                                <strong>${item.name}</strong>: ${item.detail}
                                ${item.typicalValue ? `<span class="typical-value">(典型值: ${item.typicalValue})</span>` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('');
        }

        return `
        <div class="section" id="section-error-analysis">
            <h2 class="section-title">六、误差分析</h2>
            <div class="section-body">
                <p>本实验的主要误差来源包括以下几个方面：</p>
                ${sourceList || '<p class="placeholder-text">请结合实验操作过程，从仪器误差、操作误差、环境误差和样品误差四个方面进行分析。</p>'}

                <div class="analysis-prompt">
                    <p><strong>思考方向提示：</strong></p>
                    <ol>
                        <li>哪些因素会导致系统误差？如何减小或消除？</li>
                        <li>哪些因素属于随机误差？其分布特点是什么？</li>
                        <li>能否对主要误差来源进行不确定度的定量估算？</li>
                        <li>有哪些改进措施可以提高测量精度？</li>
                    </ol>
                </div>
            </div>
        </div>`;
    },

    /**
     * 构建"七、实验结论"章节
     * @private
     */
    _buildConclusionSection(fitResult, measurements, template) {
        if (!fitResult) {
            return `
            <div class="section" id="section-conclusion">
                <h2 class="section-title">七、实验结论</h2>
                <div class="section-body">
                    <p class="no-data-warning">由于缺少有效的测量数据和拟合结果，无法给出实验结论。</p>
                </div>
            </div>`;
        }

        const alpha = fitResult.slope;
        const r2 = fitResult.rSquared;
        const theoreticalAlpha = 66.37;
        const relError = Math.abs((alpha - theoreticalAlpha) / theoreticalAlpha) * 100;

        // 浓度范围
        const concentrations = measurements.map(m => m.concentration);
        const minC = Math.min(...concentrations).toFixed(3);
        const maxC = Math.max(...concentrations).toFixed(3);

        // 使用模板或自动生成结论文本
        let conclusionText;
        if (template && template.defaultContent && template.defaultContent.conclusionTemplate) {
            conclusionText = template.defaultContent.conclusionTemplate
                .replace('{concentrationRange}', `${minC} ~ ${maxC} g/mL`)
                .replace('{measuredAlpha}', alpha.toFixed(2))
                .replace('{theoreticalAlpha}', theoreticalAlpha.toFixed(2))
                .replace('{relativeError}', relError.toFixed(2))
                .replace('{rSquared}', r2.toFixed(4));
        } else {
            conclusionText = `通过本次液相旋光实验，在浓度范围 ${minC} ~ ${maxC} g/mL 内测定了蔗糖溶液的旋光度，
                共完成 ${measurements.length} 组有效测量。利用过原点最小二乘法线性拟合得到蔗糖溶液的比旋光度为
                <strong>${alpha.toFixed(2)} &deg;&middot;mL/(dm&middot;g)</strong>，
                与 20°C 下标准值 ${theoreticalAlpha.toFixed(2)} &deg;&middot;mL/(dm&middot;g) 的相对误差为
                <strong>${relError.toFixed(2)}%</strong>。
                拟合优度 R&sup2; = <strong>${r2.toFixed(4)}</strong>，
                表明在实验浓度范围内，蔗糖溶液的旋光度与其浓度呈良好的线性关系，符合旋光基本定律。`;
        }

        return `
        <div class="section" id="section-conclusion">
            <h2 class="section-title">七、实验结论</h2>
            <div class="section-body conclusion-content">
                <p>${conclusionText}</p>
            </div>
        </div>`;
    },

    // ==================== 思政报告章节构建方法 ====================

    /**
     * 构建思政报告封面
     * @private
     */
    _buildIdeologicalCover(studentInfo, cfg, template) {
        const title = template ? template.title : '国计民生中的测量精度与工匠精神 -- 课程思政学习报告';
        const dateStr = studentInfo.date || new Date().toISOString().split('T')[0];

        let schoolInfo = '';
        if (cfg.schoolName) schoolInfo += `<div class="cover-school">${this._escapeHtml(cfg.schoolName)}</div>`;
        if (cfg.departmentName) schoolInfo += `<div class="cover-department">${this._escapeHtml(cfg.departmentName)}</div>`;

        return `
        <div class="page-cover ideological-cover">
            ${schoolInfo}
            <h1 class="cover-title">${title}</h1>
            <div class="cover-info-table">
                <table>
                    <tr><td class="info-label">姓　　名</td><td class="info-value">${this._escapeHtml(studentInfo.name || '____________')}</td></tr>
                    <tr><td class="info-label">学　　号</td><td class="info-value">${this._escapeHtml(studentInfo.studentId || '____________')}</td></tr>
                    <tr><td class="info-label">班　　级</td><td class="info-value">${this._escapeHtml(studentInfo.className || '____________')}</td></tr>
                    <tr><td class="info-label">撰写日期</td><td class="info-value">${dateStr}</td></tr>
                </table>
            </div>
        </div>`;
    },

    /**
     * 构建"一、思政主题"章节
     * @private
     */
    _buildIdeologicalThemeSection(template) {
        const content = (template && template.defaultContent && template.defaultContent.theme)
            || `<p>本实验通过精密测量蔗糖溶液的旋光度来测定其比旋光度这一物理化学参数。
               这一过程看似基础，却蕴含着深刻的思政内涵。</p>

               <h4 class="ideological-subheading">工匠精神的体现</h4>
               <p>旋光仪的等亮判定需要操作者反复微调检偏器角度，直至视场中三分视野亮度完全一致。
               这种对"毫厘之差"的追求，正是工匠精神"精益求精"的核心要义。</p>

               <h4 class="ideological-subheading">国计民生的关联</h4>
               <p>旋光法广泛应用于食品工业（糖度检测）、制药行业（手性药物纯度控制）、
               医学检验（尿糖/血糖监测）等领域。每一次精准的测量都直接关系到产品质量和人民健康。</p>

               <h4 class="ideological-subheading">科学态度的培养</h4>
               <p>从零点校准到多次测量取平均，从误差分析到不确定度评定，
               完整的实验流程培养了学生严谨求实的科学态度。</p>`;

        return `
        <div class="section" id="section-theme">
            <h2 class="section-title">一、思政主题</h2>
            <div class="section-body ideological-content">
                ${content}
            </div>
        </div>`;
    },

    /**
     * 构建"二、应用案例"章节
     * @private
     */
    _buildApplicationCasesSection(template) {
        const cases = (template && template.defaultContent && template.defaultContent.applicationCases)
            || [
                { field: '食品工业', description: '制糖企业利用旋光法快速检测原料糖和成品糖的纯度，确保食品安全标准。', precisionRequirement: '糖度测量误差需控制在 0.1% 以内' },
                { field: '制药行业', description: '手性药物的旋光性检测直接关系到药效和安全性，单一对映体杂质超标可能造成严重后果。', precisionRequirement: '光学纯度检测精度要求达到 99.5% 以上' },
                { field: '医学检验', description: '临床检验中的尿糖、血糖快速筛查依赖旋光原理，为疾病诊断提供关键依据。', precisionRequirement: '检测结果重复性要求 CV < 2%' }
            ];

        const caseCards = cases.map(c => `
            <div class="case-card">
                <h4 class="case-field">${c.field}</h4>
                <p class="case-desc">${c.description}</p>
                <p class="case-precision"><strong>精度要求:</strong> ${c.precisionRequirement}</p>
            </div>
        `).join('');

        return `
        <div class="section" id="section-cases">
            <h2 class="section-title">二、应用案例</h2>
            <div class="section-body cases-container">
                ${caseCards}
            </div>
        </div>`;
    },

    /**
     * 构建"三、学习心得与思考"章节
     * @private
     */
    _buildReflectionSection(answers, template) {
        const reflectionText = answers.reflection || answers.学习心得 || answers.心得体会 || '';
        const prompt = (template && template.defaultContent && template.defaultContent.reflectionPrompt)
            || '请结合本实验的操作体验和上述应用案例，谈谈你对"测量精度与工匠精神"的理解，以及作为理工科学生应具备的科学素养和社会责任感。（建议 300 字以上）';

        return `
        <div class="section" id="section-reflection">
            <h2 class="section-title">三、学习心得与思考</h2>
            <div class="section-body">
                <div class="reflection-content">
                    ${reflectionText
                        ? `<pre class="reflection-text">${this._escapeHtml(reflectionText)}</pre>`
                        : `<p class="no-reflection-placeholder">（此处为学生填写的学习心得与思考内容）</p>`
                    }
                </div>
                <div class="reflection-prompt">
                    <p><strong>作答提示:</strong> ${prompt}</p>
                </div>
            </div>
        </div>`;
    },

    /**
     * 构建"四、总结与展望"章节
     * @private
     */
    _buildIdeologicalConclusionSection(answers, template) {
        const conclusionText = answers.ideologicalConclusion || answers.总结与展望 || '';

        return `
        <div class="section" id="section-ideological-conclusion">
            <h2 class="section-title">四、总结与展望</h2>
            <div class="section-body">
                ${conclusionText
                    ? `<pre class="reflection-text">${this._escapeHtml(conclusionText)}</pre>`
                    : `<p class="placeholder-text">（此处为学生的总结与展望内容）</p>`
                }
            </div>
        </div>`;
    },

    // ==================== 辅助方法 ====================

    /**
     * 将所有章节包装成完整的 HTML 文档
     * @private
     */
    _wrapHTML(bodyContent, title, cfg, isIdeological = false) {
        const reportClass = isIdeological ? 'ideological-report' : 'physics-report';
        const watermarkStyle = cfg.watermarkText
            ? `.report-body::after {
                content: '${this._escapeHtml(cfg.watermarkText)}';
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-30deg);
                font-size: 80px;
                color: rgba(200, 200, 200, 0.15);
                z-index: 999;
                pointer-events: none;
                white-space: nowrap;
              }`
            : '';

        return `<!DOCTYPE html>
<html lang="${cfg.language || 'zh-CN'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._escapeHtml(title)}</title>
    <style>
        /* ========== 全局基础样式 ========== */
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: "SimSun", "Songti SC", "STSong", serif;
            font-size: ${(cfg.fontSize || 14)}px;
            line-height: ${(cfg.lineHeight || 1.8)};
            color: #222;
            background: #fff;
            padding: 0;
        }

        .report-body.${reportClass} {
            max-width: 210mm;
            margin: 0 auto;
            padding: ${(cfg.pageMarginTop || 25)}mm ${(cfg.pageMarginRight || 25)}mm ${(cfg.pageMarginBottom || 20)}mm ${(cfg.pageMarginLeft || 25)}mm;
            background: #fff;
            position: relative;
        }

        /* ========== 封面样式 ========== */
        .page-cover {
            text-align: center;
            padding: 60px 40px 40px;
            page-break-after: always;
            min-height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .ideological-cover {
            border-top: 4px solid #b71c1c;
        }

        .cover-school { font-size: 18px; color: #555; margin-bottom: 8px; letter-spacing: 2px; }
        .cover-department { font-size: 15px; color: #777; margin-bottom: 40px; letter-spacing: 1px; }
        .cover-title {
            font-size: ${(cfg.titleFontSize || 22)}px;
            font-weight: bold;
            line-height: 1.6;
            margin-bottom: 50px;
            padding: 0 20px;
            color: #111;
        }
        .ideological-cover .cover-title { color: #b71c1c; }

        .cover-info-table {
            display: inline-block;
            text-align: left;
            margin: 0 auto;
        }
        .cover-info-table table {
            border-collapse: collapse;
        }
        .cover-info-table td {
            padding: 10px 20px;
            font-size: 15px;
            border: none;
        }
        .info-label {
            text-align: right;
            font-weight: bold;
            width: 100px;
            color: #333;
        }
        .info-value {
            text-align: left;
            width: 220px;
            border-bottom: 1px solid #333;
            min-height: 24px;
        }
        .cover-timestamp {
            margin-top: 40px;
            font-size: 12px;
            color: #999;
        }

        /* ========== 章节通用样式 ========== */
        .section {
            margin-bottom: 28px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: ${(cfg.headingFontSize || 16)}px;
            font-weight: bold;
            color: #111;
            border-left: 4px solid #1565c0;
            padding-left: 12px;
            margin-bottom: 16px;
            line-height: 1.4;
        }
        .ideological-report .section-title {
            border-left-color: #b71c1c;
        }
        .section-body {
            padding-left: 16px;
            text-indent: 2em;
        }
        .section-body p { margin-bottom: 10px; text-indent: 2em; }

        .subsection-title {
            font-size: 15px;
            font-weight: bold;
            color: #333;
            margin: 18px 0 10px 0;
            text-indent: 0;
        }

        /* ========== 列表样式 ========== */
        .purpose-list, .apparatus-list {
            padding-left: 2em;
            margin-top: 8px;
        }
        .purpose-list li, .apparatus-list li {
            margin-bottom: 6px;
            text-indent: 0;
        }

        /* ========== 公式样式 ========== */
        .principle-content { text-indent: 0 !important; }
        .formula-block {
            background: #f8f9fa;
            border-left: 3px solid #1565c0;
            padding: 12px 20px;
            margin: 14px 0;
            text-align: center;
            font-size: 16px;
            text-indent: 0;
        }
        .formula-legend {
            padding-left: 2em;
            margin-top: 8px;
        }
        .formula-legend li {
            margin-bottom: 4px;
            text-indent: 0;
        }

        /* ========== 表格样式 ========== */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px auto;
            font-size: 13px;
            text-indent: 0;
        }
        .data-table th {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            padding: 8px 6px;
            text-align: center;
            font-weight: bold;
            color: #1565c0;
            font-size: 13px;
        }
        .data-table td {
            border: 1px solid #ddd;
            padding: 7px 6px;
            text-align: center;
            font-size: 13px;
        }
        .data-table tbody tr:nth-child(even) { background: #fafafa; }
        .data-table tbody tr:hover { background: #e3f2fd; }

        .calibration-row td {
            background: #fff8e1;
            text-align: left;
            padding: 10px 14px;
            font-size: 14px;
        }

        .residual-table { font-size: 12px; }
        .residual-table th { background: #fce4ec; border-color: #f48fb1; color: #c62828; }

        .table-note {
            font-size: 12px;
            color: #666;
            text-align: right;
            margin-top: 6px;
            text-indent: 0;
            font-style: italic;
        }

        /* ========== 拟合结果展示 ========== */
        .fit-result-box {
            background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
            border: 1px solid #cfd8dc;
            border-radius: 8px;
            padding: 20px 24px;
            margin: 16px 0;
            text-indent: 0;
        }
        .fit-formula {
            font-size: 17px;
            text-align: center;
            margin-bottom: 16px;
            padding: 10px;
            background: rgba(255,255,255,0.7);
            border-radius: 6px;
        }
        .fit-results-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: space-around;
        }
        .result-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 140px;
            padding: 10px 16px;
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .result-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
        }
        .result-value {
            font-size: 18px;
            font-weight: bold;
            color: #1565c0;
        }
        .error-high { color: #c62828 !important; }
        .error-medium { color: #e65100 !important; }
        .r2-good { color: #2e7d32 !important; }
        .r2-ok { color: #f57c00 !important; }
        .r2-poor { color: #c62828 !important; }

        /* ========== 误差分析样式 ========== */
        .error-category { margin-bottom: 16px; }
        .error-cat-title {
            font-size: 14px;
            font-weight: bold;
            color: #fff;
            background: #455a64;
            display: inline-block;
            padding: 4px 14px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .error-items {
            padding-left: 1.5em;
            list-style-type: disc;
        }
        .error-items li {
            margin-bottom: 6px;
            text-indent: 0;
        }
        .typical-value {
            font-size: 12px;
            color: #757575;
            font-style: italic;
        }
        .analysis-prompt {
            background: #fffde7;
            border: 1px dashed #fbc02d;
            border-radius: 6px;
            padding: 14px 18px;
            margin-top: 16px;
            text-indent: 0;
        }
        .analysis-prompt ol { padding-left: 1.5em; }
        .analysis-prompt li { margin-bottom: 4px; text-indent: 0; }

        /* ========== 结论样式 ========== */
        .conclusion-content p { font-size: 14px; line-height: 2; }

        /* ========== 思政报告特有样式 ========== */
        .ideological-content { text-indent: 0 !important; }
        .ideological-subheading {
            font-size: 15px;
            font-weight: bold;
            color: #b71c1c;
            margin: 16px 0 8px 0;
        }
        .cases-container { display: flex; flex-direction: column; gap: 14px; text-indent: 0; }
        .case-card {
            border: 1px solid #ffcdd2;
            border-radius: 8px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #fff 0%, #ffebee 100%);
        }
        .case-field {
            font-size: 15px;
            font-weight: bold;
            color: #b71c1c;
            margin-bottom: 8px;
            border-bottom: 2px solid #ef9a9a;
            padding-bottom: 4px;
            display: inline-block;
        }
        .case-desc { margin-bottom: 6px; text-indent: 0; }
        .case-precision { font-size: 13px; color: #d32f2f; text-indent: 0; }

        .reflection-content {
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 18px 22px;
            margin-bottom: 14px;
            text-indent: 0;
        }
        .reflection-text {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: "SimSun", "FangSong", serif;
            font-size: 14px;
            line-height: 2;
            text-indent: 2em;
            margin: 0;
            max-height: none;
        }
        .reflection-prompt {
            background: #e8f5e9;
            border: 1px dashed #81c784;
            border-radius: 6px;
            padding: 12px 16px;
            font-size: 13px;
            text-indent: 0;
        }

        /* ========== 占位符和警告 ========== */
        .no-data-warning, .placeholder-text, .no-reflection-placeholder {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 6px;
        }

        /* ========== 页码 ========== */
        .page-footer {
            text-align: center;
            font-size: 11px;
            color: #999;
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }

        /* ========== 水印 ========== */
        ${watermarkStyle}

        /* ========== 打印优化 ========== */
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .report-body { padding: 15mm 18mm; }
            .section { page-break-inside: avoid; }
            .page-cover { page-break-after: always; height: 100vh; }
            .data-table th { background: #e3f2fd !important; -webkit-print-color-adjust: exact; }
            .data-table tbody tr:nth-child(even) { background: #fafafa !important; -webkit-print-color-adjust: exact; }
            .fit-result-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .case-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="report-body ${reportClass}">
        ${bodyContent}
        ${cfg.showPageNumber ? '<div class="page-footer">-- 第 页 / 共 页 --</div>' : ''}
    </div>
</body>
</html>`;
    },

    /**
     * 获取用于模态框预览的内联样式
     * @private
     */
    _getPreviewStyles() {
        return `
            .preview-report { max-width: 210mm; margin: 0 auto; font-family: "SimSun", serif; font-size: 14px; line-height: 1.8; }
            .preview-report table { border-collapse: collapse; width: 100%; }
            .preview-report th, .preview-report td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 13px; }
            .preview-report th { background: #e3f2fd; color: #1565c0; }
            .preview-report h2 { font-size: 16px; border-left: 4px solid #1565c0; padding-left: 12px; margin: 20px 0 12px; }
            .preview-report h3 { font-size: 15px; margin: 14px 0 8px; color: #333; }
            .preview-report .formula-block { background: #f8f9fa; border-left: 3px solid #1565c0; padding: 12px 20px; margin: 14px 0; text-align: center; }
        `;
    },

    /**
     * 执行线性拟合（供内部使用）
     * @private
     */
    _performLinearFit(measurements) {
        if (!measurements || measurements.length < 2) return null;

        const points = measurements.map(m => ({
            x: (m.concentration || 0) * (m.tubeLength || 1),
            y: m.deltaA || 0
        }));

        const n = points.length;
        let sumXY = 0, sumX2 = 0, sumY = 0, sumY2 = 0;

        points.forEach(p => {
            sumXY += p.x * p.y;
            sumX2 += p.x * p.x;
            sumY += p.y;
            sumY2 += p.y * p.y;
        });

        const slope = sumX2 > 1e-10 ? sumXY / sumX2 : null;
        if (slope === null) return null;

        const meanY = sumY / n;
        let ssTotal = 0, ssResid = 0;
        points.forEach(p => {
            const pred = slope * p.x;
            ssTotal += (p.y - meanY) ** 2;
            ssResid += (p.y - pred) ** 2;
        });

        const rSquared = ssTotal > 1e-10 ? Math.max(0, 1 - ssResid / ssTotal) : (ssResid < 1e-10 ? 1 : 0);

        return {
            slope,
            intercept: 0,
            rSquared,
            residuals: points.map(p => ({
                x: p.x, y: p.y, predicted: slope * p.x, residual: p.y - slope * p.x
            })),
            pointCount: n
        };
    },

    /**
     * HTML 特殊字符转义
     * @private
     */
    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * 获取默认配置（降级使用）
     * @private
     */
    _getDefaultConfig(overrides) {
        return {
            includeErrorAnalysis: true,
            includeChartImage: false,
            includeTheorySection: true,
            includeIdeologicalReport: true,
            paperSize: 'a4',
            language: 'zh-CN',
            fontSize: 14,
            titleFontSize: 22,
            headingFontSize: 16,
            lineHeight: 1.8,
            showPageNumber: true,
            showTimestamp: true,
            watermarkText: '',
            schoolName: '',
            departmentName: '',
            ...overrides
        };
    }
};

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportGenerator;
}
