/**
 * 液相旋光实验 - 报告配置模块
 *
 * 定义报告生成所需的全局配置项，包括学生信息字段、报告选项、
 * 评分权重、模板定义、误差分析选项及思政教育相关配置。
 *
 * @module experiment-report-config
 * @version 1.0.0
 */

const ReportConfig = {
    // ==================== 学生信息字段 ====================

    /**
     * 学生基本信息字段配置
     * 每个字段包含：键名、显示标签、输入类型、是否必填、占位提示、校验规则
     */
    studentFields: [
        { key: '', label: '姓名', type: 'text', required: true, placeholder: '请输入姓名' },
        { key: '', label: '学号', type: 'text', required: true, placeholder: '请输入学号' },
        { key: '', label: '班级', type: 'text', required: false, placeholder: '请输入班级（选填）' },
        { key: '', label: '实验日期', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] }
    ],

    // ==================== 报告全局选项 ====================

    /**
     * 报告生成行为控制开关与参数
     */
    options: {
        includeErrorAnalysis: true,       // 包含误差分析章节
        includeChartImage: false,         // 截图图表嵌入（暂不支持）
        includeTheorySection: true,       // 包含理论原理章节
        includeIdeologicalReport: true,   // 生成课程思政报告
        paperSize: 'a4',                 // 纸张大小 (a4 / letter)
        language: 'zh-CN',               // 报告语言
        fontSize: 14,                    // 正文字号 (px)
        titleFontSize: 22,               // 标题字号 (px)
        headingFontSize: 16,             // 章节标题字号 (px)
        lineHeight: 1.8,                 // 行高
        pageMarginTop: 25,              // 上边距 (mm)
        pageMarginBottom: 20,           // 下边距 (mm)
        pageMarginLeft: 25,             // 左边距 (mm)
        pageMarginRight: 25,            // 右边距 (mm)
        showPageNumber: true,           // 显示页码
        showTimestamp: true,            // 显示生成时间戳
        watermarkText: '',              // 水印文字（空则不显示）
        schoolName: '',                 // 学校名称（留空则不显示）
        departmentName: ''              // 院系名称（留空则不显示）
    },

    // ==================== 评分权重配置 ====================

    /**
     * 各评分维度及其权重百分比，总和应为 100
     */
    scoringWeights: {
        dataCompleteness: 25,           // 数据完整性：测量组数、每组数据齐全度
        calculationAccuracy: 30,        // 计算准确性：比旋光度相对误差、拟合优度 R²
        errorAnalysisQuality: 20,       // 误差分析质量：识别的误差来源数量与深度
        ideologicalReflection: 15,      // 思政反思：字数达标、关键词匹配、思考深度
        reportFormatting: 10            // 报告格式：排版规范、单位标注、有效数字
    },

    // ==================== 评分细则 ====================

    /**
     * 各维度的详细评分标准（分段打分规则）
     */
    scoringCriteria: {
        /**
         * 数据完整性评分细则
         */
        dataCompleteness: {
            maxScore: 25,
            rules: {
                measurementCount: {
                    weight: 12,
                    thresholds: [
                        { min: 6, score: 12, comment: '测量组数充足（>=6组）' },
                        { min: 5, score: 10, comment: '测量组数较好（5组）' },
                        { min: 4, score: 8, comment: '测量组数一般（4组）' },
                        { min: 3, score: 5, comment: '测量组数较少（3组）' },
                        { min: 0, score: 2, comment: '测量组数不足（<3组）' }
                    ]
                },
                fieldCompleteness: {
                    weight: 8,
                    thresholds: [
                        { ratio: 1.0, score: 8, comment: '所有数据字段完整' },
                        { ratio: 0.9, score: 6, comment: '数据字段基本完整' },
                        { ratio: 0.7, score: 4, comment: '部分数据缺失' },
                        { ratio: 0, score: 1, comment: '数据严重缺失' }
                    ]
                },
                concentrationDiversity: {
                    weight: 5,
                    thresholds: [
                        { count: 5, score: 5, comment: '浓度覆盖范围广（5种以上不同浓度）' },
                        { count: 4, score: 4, comment: '浓度覆盖较好（4种）' },
                        { count: 3, score: 3, comment: '浓度覆盖一般（3种）' },
                        { count: 2, score: 1, comment: '浓度覆盖窄（<=2种）' }
                    ]
                }
            }
        },

        /**
         * 计算准确性评分细则
         */
        calculationAccuracy: {
            maxScore: 30,
            rules: {
                specificRotationError: {
                    weight: 18,
                    thresholds: [
                        { maxError: 3, score: 18, comment: '比旋光度测量精度优秀（相对误差<3%）' },
                        { maxError: 5, score: 14, comment: '比旋光度测量精度良好（3%~5%）' },
                        { maxError: 8, score: 10, comment: '比旋光度测量精度一般（5%~8%）' },
                        { maxError: 12, score: 6, comment: '比旋光度测量精度较差（8%~12%）' },
                        { maxError: Infinity, score: 2, comment: '比旋光度测量精度差（>12%）' }
                    ]
                },
                linearFitQuality: {
                    weight: 12,
                    thresholds: [
                        { minR2: 0.99, score: 12, comment: '线性拟合优度优秀（R² >= 0.99）' },
                        { minR2: 0.97, score: 9, comment: '线性拟合优度良好（0.97 <= R² < 0.99）' },
                        { minR2: 0.95, score: 6, comment: '线性拟合优度一般（0.95 <= R² < 0.97）' },
                        { minR2: 0.90, score: 3, comment: '线性拟合优度较差（0.90 <= R² < 0.95）' },
                        { minR2: 0, score: 1, comment: '线性拟合优度差（R² < 0.90）' }
                    ]
                }
            }
        },

        /**
         * 误差分析质量评分细则
         */
        errorAnalysisQuality: {
            maxScore: 20,
            rules: {
                identifiedErrors: {
                    weight: 10,
                    thresholds: [
                        { count: 5, score: 10, comment: '识别出全部主要误差来源（>=5项）' },
                        { count: 4, score: 8, comment: '识别出大部分误差来源（4项）' },
                        { count: 3, score: 6, comment: '识别出部分误差来源（3项）' },
                        { count: 2, score: 4, comment: '识别出少量误差来源（2项）' },
                        { count: 1, score: 2, comment: '仅识别出个别误差来源（1项）' },
                        { count: 0, score: 0, comment: '未进行误差分析' }
                    ]
                },
                analysisDepth: {
                    weight: 6,
                    thresholds: [
                        { level: 'excellent', score: 6, comment: '误差分析深入透彻，有定量估算和改进建议' },
                        { level: 'good', score: 4, comment: '误差分析较为全面，有定性讨论' },
                        { level: 'basic', score: 2, comment: '误差分析简单罗列，缺乏深度' },
                        { level: 'none', score: 0, comment: '无误差分析内容' }
                    ]
                },
                uncertaintyCalculation: {
                    weight: 4,
                    thresholds: [
                        { hasUncertainty: true, method: 'full', score: 4, comment: '完成不确定度传递计算' },
                        { hasUncertainty: true, method: 'partial', score: 2, comment: '有不确定度概念但未完整计算' },
                        { hasUncertainty: false, score: 0, comment: '未涉及不确定度分析' }
                    ]
                }
            }
        },

        /**
         * 思政反思质量评分细则
         */
        ideologicalReflection: {
            maxScore: 15,
            rules: {
                wordCount: {
                    weight: 5,
                    thresholds: [
                        { minWords: 500, score: 5, comment: '反思篇幅充实（>=500字）' },
                        { minWords: 300, score: 4, comment: '反思篇幅适中（300~499字）' },
                        { minWords: 150, score: 2, comment: '反思篇幅偏短（150~299字）' },
                        { minWords: 0, score: 1, comment: '反思篇幅严重不足（<150字）' }
                    ]
                },
                keywordMatch: {
                    weight: 5,
                    keywords: ['工匠精神', '精益求精', '科学态度', '国计民生', '测量精度',
                               '严谨求实', '实事求是', '创新驱动', '质量控制', '社会责任'],
                    thresholds: [
                        { matchCount: 5, score: 5, comment: '思政关键词匹配度高（>=5个）' },
                        { matchCount: 3, score: 4, comment: '思政关键词匹配良好（3~4个）' },
                        { matchCount: 2, score: 2, comment: '思政关键词匹配一般（2个）' },
                        { matchCount: 1, score: 1, comment: '思政关键词匹配较少（1个）' },
                        { matchCount: 0, score: 0, comment: '未匹配到思政关键词' }
                    ]
                },
                reflectionDepth: {
                    weight: 5,
                    thresholds: [
                        { level: 'deep', score: 5, comment: '反思深刻，能结合实验谈个人感悟与社会意义' },
                        { level: 'moderate', score: 3, comment: '反思有一定深度，但结合实际不够紧密' },
                        { level: 'shallow', score: 1, comment: '反思流于表面，缺乏个人见解' }
                    ]
                }
            }
        },

        /**
         * 报告格式规范评分细则
         */
        reportFormatting: {
            maxScore: 10,
            rules: {
                unitNotation: {
                    weight: 3,
                    thresholds: [
                        { correct: true, consistent: true, score: 3, comment: '单位标注正确且全文一致' },
                        { correct: true, consistent: false, score: 2, comment: '单位正确但不统一' },
                        { correct: false, score: 0, comment: '存在单位错误或遗漏' }
                    ]
                },
                significantFigures: {
                    weight: 3,
                    thresholds: [
                        { compliant: true, score: 3, comment: '有效数字使用规范' },
                        { partial: true, score: 1, comment: '有效数字基本正确但有疏漏' },
                        { compliant: false, score: 0, comment: '有效数字不规范' }
                    ]
                },
                overallLayout: {
                    weight: 4,
                    thresholds: [
                        { level: 'excellent', score: 4, comment: '排版整洁美观，层次清晰' },
                        { level: 'good', score: 3, comment: '排版基本规范' },
                        { level: 'acceptable', score: 2, comment: '排版有待改进' },
                        { level: 'poor', score: 0, comment: '排版混乱' }
                    ]
                }
            }
        }
    },

    // ==================== 报告模板定义 ====================

    /**
     * 预置的报告模板集合
     */
    templates: {
        /**
         * 物理实验报告模板
         */
        physics: {
            title: '液相旋光法测定蔗糖溶液比旋光度 -- 实验报告',
            sections: [
                { id: 'cover', name: '封面信息', visible: true },
                { id: 'purpose', name: '一、实验目的', visible: true },
                { id: 'principle', name: '二、实验原理', visible: true },
                { id: 'apparatus', name: '三、实验仪器', visible: true },
                { id: 'data', name: '四、原始数据记录', visible: true },
                { id: 'processing', name: '五、数据处理', visible: true },
                { id: 'errorAnalysis', name: '六、误差分析', visible: true },
                { id: 'conclusion', name: '七、实验结论', visible: true }
            ],
            defaultContent: {
                purpose: [
                    '1. 了解旋光现象的基本原理，掌握旋光仪的使用方法。',
                    '2. 测定蔗糖溶液在不同浓度下的旋光度，绘制旋光度-浓度关系曲线。',
                    '3. 利用最小二乘法拟合直线，计算蔗糖溶液的比旋光度。',
                    '4. 理解温度对旋光度的影响，学会温度修正方法。'
                ],
                principle: `
                    当线偏振光通过某些物质（如蔗糖溶液）时，其振动面会发生旋转，
                    这种现象称为旋光现象。旋转的角度称为旋光度，用 &alpha; 表示。

                    对于溶液体系，旋光度遵循以下规律：

                    &alpha; = [&alpha;]<sub>t</sub><sup>&lambda;</sup> &middot; c &middot; L

                    其中：
                    &bull; &alpha; 为测得的旋光度（度）
                    &bull; [&alpha;]<sub>t</sub><sup>&lambda;</sup> 为比旋光度（&deg;&middot;mL/(dm&middot;g)），是物质的特性常数
                    &bull; c 为溶液浓度（g/mL）
                    &bull; L 为旋光管长度（dm）

                    比旋光度随温度变化的经验公式为：

                    [&alpha;]<sub>t</sub> = [&alpha;]<sub>20</sub> &minus; k(t &minus; 20)

                    其中 k 为温度系数（对于蔗糖约为 0.00014 &deg;/(&deg;C)）。
                `,
                apparatus: [
                    'WXG-4 型圆盘旋光仪',
                    '钠光灯（波长 &lambda; = 589.3 nm）',
                    '旋光管（L = 1 dm / 2 dm）',
                    '蔗糖溶液（多种浓度）',
                    '蒸馏水（用于零点校准）'
                ],
                conclusionTemplate: `通过本次液相旋光实验，测定了蔗糖溶液在{concentrationRange}浓度范围内的旋光度，
                    利用最小二乘法进行线性拟合，得到比旋光度为 {measuredAlpha} &deg;&middot;mL/(dm&middot;g)，
                    与理论值 {theoreticalAlpha} 的相对误差为 {relativeError}%。
                    实验结果表明旋光度与浓度呈良好的线性关系（R&sup2; = {rSquared}）。`
            }
        },

        /**
         * 课程思政报告模板
         */
        ideological: {
            title: '国计民生中的测量精度与工匠精神 -- 课程思政学习报告',
            sections: [
                { id: 'theme', name: '一、思政主题', visible: true },
                { id: 'applicationCases', name: '二、应用案例', visible: true },
                { id: 'reflection', name: '三、学习心得与思考', visible: true },
                { id: 'conclusion', name: '四、总结与展望', visible: true }
            ],
            defaultContent: {
                theme: `
                    本实验通过精密测量蔗糖溶液的旋光度来测定其比旋光度这一物理化学参数。
                    这一过程看似基础，却蕴含着深刻的思政内涵：

                    <strong>工匠精神的体现：</strong>
                    旋光仪的等亮判定需要操作者反复微调检偏器角度，直至视场中三分视野亮度完全一致。
                    这种对"毫厘之差"的追求，正是工匠精神"精益求精"的核心要义。

                    <strong>国计民生的关联：</strong>
                    旋光法广泛应用于食品工业（糖度检测）、制药行业（手性药物纯度控制）、
                    医学检验（尿糖/血糖监测）等领域。每一次精准的测量都直接关系到产品质量和人民健康。

                    <strong>科学态度的培养：</strong>
                    从零点校准到多次测量取平均，从误差分析到不确定度评定，
                    完整的实验流程培养了学生严谨求实的科学态度。
                `,
                applicationCases: [
                    {
                        field: '食品工业',
                        description: '制糖企业利用旋光法快速检测原料糖和成品糖的纯度，确保食品安全标准。',
                        precisionRequirement: '糖度测量误差需控制在 0.1% 以内'
                    },
                    {
                        field: '制药行业',
                        description: '手性药物的旋光性检测直接关系到药效和安全性，单一对映体杂质超标可能造成严重后果。',
                        precisionRequirement: '光学纯度检测精度要求达到 99.5% 以上'
                    },
                    {
                        field: '医学检验',
                        description: '临床检验中的尿糖、血糖快速筛查依赖旋光原理，为疾病诊断提供关键依据。',
                        precisionRequirement: '检测结果重复性要求 CV < 2%'
                    }
                ],
                reflectionPrompt: '请结合本实验的操作体验和上述应用案例，谈谈你对"测量精度与工匠精神"的理解，以及作为理工科学生应具备的科学素养和社会责任感。（建议 300 字以上）'
            }
        }
    },

    // ==================== 误差分析参考库 ====================

    /**
     * 常见误差来源分类及其说明，供学生在误差分析时参考
     */
    errorSources: [
        {
            category: '仪器误差',
            items: [
                { name: '刻度盘分度值限制', detail: '圆盘旋光仪的分度值通常为 0.05°，读数时存在估读误差', typicalValue: '±0.02° ~ ±0.05°' },
                { name: '零点漂移', detail: '仪器长时间工作后可能产生零点漂移，影响测量准确性', typicalValue: '±0.01° ~ ±0.03°' },
                { name: '钠光源不稳定', detail: '钠光灯预热不足或老化会导致光强波动，影响等亮判断', typicalValue: '影响判断一致性' },
                { name: '旋光管管长误差', detail: '标称管长与实际管长之间存在制造公差', typicalValue: '±0.01 dm ~ ±0.02 dm' }
            ]
        },
        {
            category: '操作误差',
            items: [
                { name: '等亮判读主观性', detail: '三分视野的等亮状态由人眼判断，存在个体差异', typicalValue: '±0.02° ~ ±0.10°' },
                { name: '气泡残留', detail: '装入溶液时若混入气泡，会改变有效光程', typicalValue: '不可忽略' },
                { name: '管壁清洁度', detail: '管壁上的污渍或水痕会产生散射或附加旋光', typicalValue: '视污染程度而定' },
                { name: '读数时机不当', detail: '未待示数稳定即记录读数', typicalValue: '±0.01° ~ ±0.03°' }
            ]
        },
        {
            category: '环境误差',
            items: [
                { name: '温度波动', detail: '环境温度变化会影响溶液的比旋光度（温度系数约 0.00014 °/°C）', typicalValue: '每°C 约 0.009°' },
                { name: '杂散光干扰', detail: '外界光线进入视场干扰等亮判断', typicalValue: '降低判断可靠性' },
                { name: '振动影响', detail: '实验台面的振动可能导致读数不稳定', typicalValue: '增加读数离散度' }
            ]
        },
        {
            category: '样品误差',
            items: [
                { name: '浓度配制不准', detail: '配制蔗糖溶液时的称量和定容误差传递至最终结果', typicalValue: '取决于天平精度' },
                { name: '溶液均匀性', detail: '溶解不完全或放置后产生浓度梯度', typicalValue: '局部偏差可达 1%~3%' },
                { name: '温度未充分平衡', detail: '溶液温度与环境/仪器温度不一致', typicalValue: '引入系统偏差' }
            ]
        }
    ],

    // ==================== 等级划分标准 ====================

    /**
     * 总分到等级的映射关系
     */
    gradeScale: [
        { minScore: 90, grade: 'A', label: '优秀', color: '#2e7d32', description: '实验操作规范，数据处理准确，分析深入全面' },
        { minScore: 80, grade: 'B', label: '良好', color: '#1565c0', description: '实验完成较好，数据分析合理，有改进空间' },
        { minScore: 70, grade: 'C', label: '中等', color: '#f57c00', description: '基本完成任务，但在多个方面需要加强' },
        { minScore: 60, grade: 'D', label: '及格', color: '#c62828', description: '勉强达到要求，需要认真改进' },
        { minScore: 0, grade: 'F', label: '不及格', color: '#b71c1c', description: '未达到基本要求，建议重新完成实验' }
    ],

    // ==================== 物理常量参考 ====================

    /**
     * 实验相关的物理常量与参考值
     */
    physicalConstants: {
        sodiumDLine: 589.3,                     // 钠 D 线波长 (nm)
        sucroseSpecificRotation20: 66.37,       // 蔗糖 20°C 比旋光度 [α]_20^D (°·mL/(dm·g))
        sucroseTempCoefficient: 0.00014,         // 蔗糖温度系数 (°/(°C))
        standardTubeLengths: [1, 2],             // 标准旋光管长度 (dm)
        concentrationRange: { min: 0, max: 0.2 }, // 推荐浓度范围 (g/mL)
        temperatureRange: { min: 15, max: 30 }   // 推荐实验温度范围 (°C)
    },

    // ==================== 辅助方法 ====================

    /**
     * 根据分数获取等级对象
     * @param {number} score - 总分 (0-100)
     * @returns {Object} 包含等级字母、标签、颜色、描述的对象
     */
    getGradeInfo(score) {
        const s = Math.max(0, Math.min(100, score));
        for (let i = this.gradeScale.length - 1; i >= 0; i--) {
            if (s >= this.gradeScale[i].minScore) {
                return this.gradeScale[i];
            }
        }
        return this.gradeScale[this.gradeScale.length - 1];
    },

    /**
     * 获取简化的等级字符串
     * @param {number} score - 总分 (0-100)
     * @returns {string} 如 "A (优秀)"
     */
    getGradeLabel(score) {
        const info = this.getGradeInfo(score);
        return `${info.grade} (${info.label})`;
    },

    /**
     * 获取所有可用误差来源名称列表（供自动检查匹配）
     * @returns {string[]} 误差源名称数组
     */
    getAllErrorSourceNames() {
        const names = [];
        this.errorSources.forEach(category => {
            category.items.forEach(item => {
                names.push(item.name);
            });
        });
        return names;
    },

    /**
     * 合并自定义配置覆盖默认配置
     * @param {Object} customOptions - 用户自定义配置
     * @returns {Object} 合并后的新配置对象
     */
    mergeOptions(customOptions = {}) {
        return {
            ...this.options,
            ...customOptions
        };
    }
};

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportConfig;
}
