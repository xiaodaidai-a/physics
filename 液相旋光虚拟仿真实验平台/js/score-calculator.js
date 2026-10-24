/**
 * 液相旋光实验 - 独立自动评分系统
 * 基于实验数据和思政反思内容进行多维度综合评分
 */

const ScoreCalculator = (() => {
    'use strict';

    /**
     * 评分维度配置
     */
    const DIMENSIONS = {
        dataCompleteness: { weight: 25, name: '数据完整性', maxScore: 25 },
        calculationAccuracy: { weight: 30, name: '计算准确性', maxScore: 30 },
        errorAnalysisQuality: { weight: 20, name: '误差分析质量', maxScore: 20 },
        ideologicalReflection: { weight: 15, name: '课程思政反思', maxScore: 15 },
        reportFormatting: { weight: 10, name: '报告规范性', maxScore: 10 }
    };

    // 误差关键词库（用于检测学生是否识别出各类误差）
    const ERROR_KEYWORDS = {
        temperature: ['温度', '偏离', '修正', '系数'],
        wavelength: ['波长', '单色性', '非单色', '谱线'],
        halfShade: ['半荫片', '夹角', '不均匀', '缺陷'],
        contact: ['接触', '不完全', '初始', '零点'],
        reading: ['读数', '估读', '游标', '精度'],
        judgment: ['判断', '主观', '等亮', '视觉'],
        concentration: ['浓度', '配制', '天平', '质量']
    };

    // 思政关键词库
    const IDEOLOGICAL_KEYWORDS = [
        '食品安全', '工匠精神', '精益求精', '测量精度',
        '国计民生', '制药', '药典', '标准', '责任',
        '科学态度', '严谨', '实事求是'
    ];

    /**
     * 主评分入口
     * @param {Object} experimentData - 实验数据（从 sessionStorage 获取的完整对象）
     * @param {Object} reflectionData - 思政反思数据（思考题答案）
     * @returns {{ totalScore: number, breakdown: Object, grade: string, feedback: string[], suggestions: string[] }}
     */
    function calculate(experimentData, reflectionData) {
        if (!experimentData || !experimentData.measurements) {
            return _emptyResult('未找到有效的实验数据');
        }

        const breakdown = {};
        const allFeedback = [];
        const suggestions = [];

        // 1. 数据完整性 (25分)
        const dataResult = _scoreDataCompleteness(experimentData);
        breakdown.dataCompleteness = dataResult;
        allFeedback.push(...dataResult.feedback);

        // 2. 计算准确性 (30分)
        const calcResult = _scoreCalculationAccuracy(experimentData);
        breakdown.calculationAccuracy = calcResult;
        allFeedback.push(...calcResult.feedback);

        // 3. 误差分析质量 (20分)
        const errorResult = _scoreErrorAnalysisQuality(experimentData, reflectionData);
        breakdown.errorAnalysisQuality = errorResult;
        allFeedback.push(...errorResult.feedback);
        if (errorResult.suggestions) suggestions.push(...errorResult.suggestions);

        // 4. 思政反思 (15分)
        const ideoResult = _scoreIdeologicalReflection(reflectionData);
        breakdown.ideologicalReflection = ideoResult;
        allFeedback.push(...ideoResult.feedback);
        if (ideoResult.suggestions) suggestions.push(...ideoResult.suggestions);

        // 5. 报告格式 (10分)
        const formatResult = _scoreReportFormatting(experimentData, reflectionData);
        breakdown.reportFormatting = formatResult;
        allFeedback.push(...formatResult.feedback);

        // 汇总
        let totalScore = 0;
        for (const key in breakdown) {
            totalScore += breakdown[key].score;
        }
        totalScore = Math.round(totalScore * 10) / 10; // 保留1位小数

        return {
            totalScore: Math.min(totalScore, 100),
            breakdown: breakdown,
            grade: _getGrade(totalScore),
            feedback: allFeedback,
            suggestions: suggestions,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 维度1：数据完整性评分 (满分25)
     */
    function _scoreDataCompleteness(data) {
        const measurements = data.measurements || [];
        const scoreDetails = [];
        let score = 0;
        const feedback = [];

        // 测量组数检查 (10分)
        if (measurements.length >= 6) {
            score += 10;
            scoreDetails.push({ item: '测量组数', got: measurements.length, need: 4, points: 10 });
            feedback.push(`优秀：完成 ${measurements.length} 组测量（要求至少4组）`);
        } else if (measurements.length >= 4) {
            score += 8;
            scoreDetails.push({ item: '测量组数', got: measurements.length, need: 4, points: 8 });
            feedback.push(`良好：完成 ${measurements.length} 组测量`);
        } else if (measurements.length >= 2) {
            score += 4;
            scoreDetails.push({ item: '测量组数', got: measurements.length, need: 4, points: 4 });
            feedback.push(`不足：仅完成 ${measurements.length} 组测量，建议至少4组以提高拟合可靠性`);
        } else {
            scoreDetails.push({ item: '测量组数', got: measurements.length, need: 4, points: 0 });
            feedback.push(`欠缺：测量组数不足，无法进行有效线性拟合`);
        }

        // 字段完整性 (8分)
        let completeFields = 0;
        const totalFields = measurements.length * 7; // A0, A, deltaA, c, T, L + id
        for (const m of measurements) {
            if (m.A0 !== null && m.A !== null && m.deltaA !== null &&
                m.concentration !== null && m.temperature !== null && m.tubeLength !== null) {
                completeFields += 7;
            } else {
                completeFields += Object.values(m).filter(v => v !== null && v !== undefined).length;
            }
        }
        const fieldRatio = totalFields > 0 ? completeFields / totalFields : 0;
        score += Math.round(8 * fieldRatio);
        scoreDetails.push({ item: '字段完整率', got: Math.round(fieldRatio * 100) + '%', need: '100%', points: Math.round(8 * fieldRatio) });

        // 浓度多样性 (4分)
        const concentrations = [...new Set(measurements.map(m => m.concentration).filter(c => c !== null))];
        if (concentrations.length >= 3) {
            score += 4;
            feedback.push('优秀：使用了多种不同浓度的溶液进行测量');
        } else if (concentrations.length >= 2) {
            score += 2;
            feedback.push('一般：建议使用更多种浓度以验证线性关系');
        } else {
            feedback.push('提示：仅使用单一浓度，难以验证旋光角的线性关系');
        }
        scoreDetails.push({ item: '浓度多样性', got: concentrations.length, need: 3, points: concentrations.length >= 3 ? 4 : (concentrations.length >= 2 ? 2 : 0) });

        // 操作规范性 (3分)
        let hasCalibration = false;
        for (const m of measurements) {
            if (m.A0 !== null && Math.abs(m.A0) < 5) hasCalibration = true; // 初读数接近0说明做了校准
        }
        if (hasCalibration) {
            score += 3;
            feedback.push('规范：正确执行了零点校准步骤');
        } else {
            feedback.push('提醒：请确保每次测量前都进行了零点校准');
        }
        scoreDetails.push({ item: '零点校准', got: hasCalibration ? '是' : '否', need: '是', points: hasCalibration ? 3 : 0 });

        return { score: Math.min(score, 25), maxScore: 25, details: scoreDetails, feedback };
    }

    /**
     * 维度2：计算准确性评分 (满分30)
     */
    function _scoreCalculationAccuracy(data) {
        const measurements = data.measurements || [];
        let score = 0;
        const scoreDetails = [];
        const feedback = [];

        if (measurements.length < 2) {
            return { score: 0, maxScore: 30, details: [], feedback: ['数据不足以进行计算准确性评估'] };
        }

        // 准备拟合数据
        const fitPoints = measurements
            .filter(m => m.concentration !== null && m.deltaA !== null)
            .map(m => ({ x: m.concentration, y: m.deltaA }));

        if (fitPoints.length < 2) {
            return { score: 0, maxScore: 30, details: [], feedback: ['有效数据点不足，无法评估计算准确性'] };
        }

        // 使用内置最小二乘法或 physics-engine 的
        let fitResult;
        if (typeof PhysicsEngine !== 'undefined' && PhysicsEngine.linearRegression) {
            fitResult = PhysicsEngine.linearRegression(fitPoints);
        } else {
            fitResult = _linearRegression(fitPoints);
        }

        // R² 评分 (12分)
        const r2 = fitResult.rSquared;
        if (r2 >= 0.99) {
            score += 12;
            feedback.push(`极佳：线性拟合 R² = ${r2}（>0.99），数据高度符合理论预期`);
        } else if (r2 >= 0.95) {
            score += 10;
            feedback.push(`良好：R² = ${r2}，线性关系明显`);
        } else if (r2 >= 0.90) {
            score += 7;
            feedback.push(`中等：R² = ${r2}，存在一定离散，请检查是否有异常数据点`);
        } else if (r2 >= 0.80) {
            score += 4;
            feedback.push(`较差：R² = ${r2}，线性关系较弱，可能存在操作误差`);
        } else {
            feedback.push(`差：R² = ${r2}，数据严重偏离线性关系，建议重做实验`);
        }
        scoreDetails.push({ item: '拟合优度 R²', got: r2.toFixed(4), need: '>0.99', points: r2 >= 0.99 ? 12 : (r2 >= 0.95 ? 10 : (r2 >= 0.90 ? 7 : (r2 >= 0.80 ? 4 : 0))) });

        // 比旋光度准确性 (10分)
        const slope = fitResult.slope;
        // 理论上 slope 应该接近 [alpha] * L，对于 L=2dm，slope ≈ 132.74
        // 这里简化为用斜率估算比旋光度
        const avgTubeLength = measurements.reduce((s, m) => s + (m.tubeLength || 2), 0) / measurements.length;
        const calculatedAlpha = avgTubeLength > 0 ? slope / avgTubeLength : 0;
        const standardAlpha = 66.37;
        const relativeError = Math.abs((calculatedAlpha - standardAlpha) / standardAlpha) * 100;

        if (relativeError <= 2) {
            score += 10;
            feedback.push(`精确：测得比旋光度 [α] = ${calculatedAlpha.toFixed(2)}°·mL/(dm·g)，相对误差 ${relativeError.toFixed(1)}%`);
        } else if (relativeError <= 5) {
            score += 8;
            feedback.push(`准确：[α] = ${calculatedAlpha.toFixed(2)}°，相对误差 ${relativeError.toFixed(1)}%`);
        } else if (relativeError <= 10) {
            score += 5;
            feedback.push(`可接受：[α] = ${calculatedAlpha.toFixed(2)}°，相对误差 ${relativeError.toFixed(1)}%，建议检查温度和管长设置`);
        } else if (relativeError <= 20) {
            score += 2;
            feedback.push(`偏差较大：[α] = ${calculatedAlpha.toFixed(2)}°，相对误差 ${relativeError.toFixed(1)}%`);
        } else {
            feedback.push(`偏差大：[α] = ${calculatedAlpha.toFixed(2)}°，相对误差 ${relativeError.toFixed(1)}%`);
        }
        scoreDetails.push({ item: '[α] 相对误差', got: relativeError.toFixed(1) + '%', need: '<2%', points: relativeError <= 2 ? 10 : (relativeError <= 5 ? 8 : (relativeError <= 10 ? 5 : (relativeError <= 20 ? 2 : 0))) });

        // 旋光角计算正确性 (5分)
        // 检查每组数据的 deltaA 是否等于 A - A0
        let correctDeltaCount = 0;
        for (const m of measurements) {
            if (m.A !== null && m.A0 !== null && m.deltaA !== null) {
                if (Math.abs(m.deltaA - (m.A - m.A0)) < 0.05) {
                    correctDeltaCount++;
                }
            }
        }
        const validMeasurements = measurements.filter(m => m.deltaA !== null).length;
        const deltaRatio = validMeasurements > 0 ? correctDeltaCount / validMeasurements : 0;
        score += Math.round(5 * deltaRatio);
        scoreDetails.push({ item: 'ΔA=A-A₀ 正确率', got: Math.round(deltaRatio * 100) + '%', need: '100%', points: Math.round(5 * deltaRatio) });

        // 有效数字规范 (3分)
        score += 3; // 默认给基础分
        scoreDetails.push({ item: '有效数字', got: '-', need: '合理', points: 3 });

        return { score: Math.min(score, 30), maxScore: 30, details: scoreDetails, feedback };
    }

    /**
     * 维度3：误差分析质量 (满分20)
     */
    function _scoreErrorAnalysisQuality(data, reflectionData) {
        let score = 0;
        const scoreDetails = [];
        const feedback = [];
        const suggestions = [];

        // 从结论文本中提取误差分析内容
        const conclusionText = (reflectionData && reflectionData.conclusion) || '';
        const errorTexts = [conclusionText];
        if (reflectionData && reflectionData.errorItems) {
            errorTexts.push(reflectionData.errorItems.join(' '));
        }
        const combinedText = errorTexts.join(' ');

        // 识别出的误差类型数量 (12分)
        let identifiedErrors = 0;
        for (const category in ERROR_KEYWORDS) {
            for (const keyword of ERROR_KEYWORDS[category]) {
                if (combinedText.includes(keyword)) {
                    identifiedErrors++;
                    break; // 每类只计一次
                }
            }
        }

        if (identifiedErrors >= 5) {
            score += 12;
            feedback.push(`出色：识别出 ${identifiedErrors} 类误差来源，分析全面`);
        } else if (identifiedErrors >= 3) {
            score += 9;
            feedback.push(`良好：识别出 ${identifiedErrors} 类误差来源`);
        } else if (identifiedErrors >= 1) {
            score += 5;
            feedback.push(`初步：识别出 ${identifiedErrors} 类误差来源，建议进一步补充`);
        } else {
            feedback.push('未检测到明确的误差分析内容');
            suggestions.push('建议从以下角度分析误差：温度偏差、读数估读、等亮判断主观性、仪器缺陷');
        }
        scoreDetails.push({ item: '误差源识别', got: identifiedErrors + '类', need: '≥5类', points: identifiedErrors >= 5 ? 12 : (identifiedErrors >= 3 ? 9 : (identifiedErrors >= 1 ? 5 : 0)) });

        // 分析深度 (5分)
        const depthIndicators = ['定量', '公式', '计算', '影响', '修正', '减小'];
        let depthCount = 0;
        for (const word of depthIndicators) {
            if (combinedText.includes(word)) depthCount++;
        }
        score += Math.min(Math.round(depthCount * 1.2), 5);
        scoreDetails.push({ item: '分析深度', got: depthCount + '个深度指标', need: '≥4个', points: Math.min(Math.round(depthCount * 1.2), 5) });

        // 改进建议 (3分)
        const suggestionIndicators = ['建议', '改进', '优化', '提高', '减少误差', '注意'];
        let hasSuggestions = suggestionIndicators.some(w => combinedText.includes(w));
        if (hasSuggestions) {
            score += 3;
            feedback.push('提出了具体的改进建议');
        } else {
            suggestions.push('建议在误差分析后提出针对性的改进措施');
        }
        scoreDetails.push({ item: '改进建议', got: hasSuggestions ? '有' : '无', need: '有', points: hasSuggestions ? 3 : 0 });

        return { score: Math.min(score, 20), maxScore: 20, details: scoreDetails, feedback, suggestions };
    }

    /**
     * 维度4：课程思政反思 (满分15)
     */
    function _scoreIdeologicalReflection(reflectionData) {
        let score = 0;
        const scoreDetails = [];
        const feedback = [];
        const suggestions = [];

        if (!reflectionData) {
            return { score: 0, maxScore: 15, details: [], feedback: ['未提交课程思政反思'], suggestions: ['请完成思考题作答'] };
        }

        // 合并所有答案文本
        const allAnswers = [
            reflectionData.q1Answer || '',
            reflectionData.q2Answer || '',
            reflectionData.q3Answer || '',
            reflectionData.essayContent || ''
        ].join('');

        // 字数统计 (5分)
        const charCount = allAnswers.replace(/\s/g, '').length;
        if (charCount >= 600) {
            score += 5;
            feedback.push(`详实：总字数约 ${charCount} 字，思考充分`);
        } else if (charCount >= 300) {
            score += 3;
            feedback.push(`适中：总字数约 ${charCount} 字，建议进一步展开`);
        } else if (charCount > 0) {
            score += 1;
            feedback.push(`简略：总字数约 ${charCount} 字，内容偏少`);
        } else {
            feedback.push('未填写任何思考题答案');
        }
        scoreDetails.push({ item: '反思字数', got: charCount + '字', need: '≥600字', points: charCount >= 600 ? 5 : (charCount >= 300 ? 3 : (charCount > 0 ? 1 : 0)) });

        // 关键词匹配 (6分)
        let matchedKeywords = 0;
        for (const kw of IDEOLOGICAL_KEYWORDS) {
            if (allAnswers.includes(kw)) matchedKeywords++;
        }
        score += Math.min(matchedKeywords, 6);
        if (matchedKeywords >= 4) {
            feedback.push(`贴合主题：涉及 ${matchedKeywords} 个思政核心概念`);
        } else if (matchedKeywords >= 2) {
            feedback.push(`基本相关：涉及 ${matchedKeywords} 个思政概念`);
        } else {
            suggestions.push('建议在回答中联系"食品安全""工匠精神""测量精度"等核心主题');
        }
        scoreDetails.push({ item: '思政关键词', got: matchedKeywords + '个', need: '≥4个', points: Math.min(matchedKeywords, 6) });

        // 思考深度 (4分)
        const depthMarkers = ['因为', '所以', '导致', '体现', '说明', '例如', '我认为', '由此可见'];
        let depthMarkerCount = 0;
        for (const marker of depthMarkers) {
            const regex = new RegExp(marker, 'g');
            const matches = allAnswers.match(regex);
            if (matches) depthMarkerCount += Math.min(matches.length, 2); // 每种最多计2次
        }
        score += Math.min(Math.round(depthMarkerCount * 0.5), 4);
        scoreDetails.push({ item: '思考深度', got: depthMarkerCount + '个逻辑词', need: '≥6个', points: Math.min(Math.round(depthMarkerCount * 0.5), 4) });

        return { score: Math.min(score, 15), maxScore: 15, details: scoreDetails, feedback, suggestions };
    }

    /**
     * 维度5：报告规范性 (满分10)
     */
    function _scoreReportFormatting(data, reflectionData) {
        let score = 0;
        const scoreDetails = [];
        const feedback = [];

        // 学生信息完整 (3分)
        const info = data.studentInfo || {};
        let infoComplete = 0;
        if (info.name) infoComplete++;
        if (info.studentId) infoComplete++;
        if (info.date) infoComplete++;
        score += infoComplete;
        scoreDetails.push({ item: '基本信息', got: infoComplete + '/3项', need: '3/3', points: infoComplete });
        if (infoComplete === 3) {
            feedback.push('学生信息填写完整');
        } else {
            feedback.push(`学生信息缺少 ${3 - infoComplete} 项`);
        }

        // 单位使用 (3分)
        score += 3; // 默认给分（前端已处理单位显示）
        scoreDetails.push({ item: '单位标注', got: '自动', need: '规范', points: 3 });

        // 有效数字 (2分)
        score += 2;
        scoreDetails.push({ item: '有效数字', got: '合理', need: '一致', points: 2 });

        // 报告结构 (2分)
        score += 2;
        scoreDetails.push({ item: '章节完整', got: '完整', need: '齐全', points: 2 });

        return { score: Math.min(score, 10), maxScore: 10, details: scoreDetails, feedback };
    }

    /**
     * 内置最小二乘法（降级方案）
     */
    function _linearRegression(points) {
        const n = points.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumX2 += p.x * p.x;
        }
        const denom = n * sumX2 - sumX * sumX;
        if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: sumY / n, rSquared: 0 };
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;

        const meanY = sumY / n;
        let ssTotal = 0, ssResidual = 0;
        for (const p of points) {
            const pred = slope * p.x + intercept;
            ssTotal += (p.y - meanY) ** 2;
            ssResidual += (p.y - pred) ** 2;
        }
        const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

        return {
            slope: Math.round(slope * 10000) / 10000,
            intercept: Math.round(intercept * 100000) / 100000,
            rSquared: Math.round(rSquared * 10000) / 10000
        };
    }

    /**
     * 获取等级
     */
    function _getGrade(score) {
        if (score >= 90) return 'A (优秀)';
        if (score >= 80) return 'B (良好)';
        if (score >= 70) return 'C (中等)';
        if (score >= 60) return 'D (及格)';
        return 'F (不及格)';
    }

    /**
     * 空结果
     */
    function _emptyResult(reason) {
        return {
            totalScore: 0,
            breakdown: {},
            grade: 'F (未完成)',
            feedback: [reason],
            suggestions: ['请先完成仿真实验后再进行评分']
        };
    }

    /**
     * 生成评价报告文字
     */
    function generateEvaluation(result) {
        const lines = [];
        lines.push(`=== 实验评分报告 ===`);
        lines.push(`总分：${result.totalScore}/100 分  等级：${result.grade}`);
        lines.push(`评分时间：${new Date().toLocaleString('zh-CN')}`);
        lines.push('');
        lines.push('--- 各维度得分 ---');

        for (const key in result.breakdown) {
            const dim = result.breakdown[key];
            const dimName = DIMENSIONS[key] ? DIMENSIONS[key].name : key;
            lines.push(`${dimName}：${dim.score}/${dim.maxScore} 分`);
            if (dim.feedback) {
                dim.feedback.forEach(f => lines.push(`  · ${f}`));
            }
        }

        if (result.suggestions && result.suggestions.length > 0) {
            lines.push('');
            lines.push('--- 改进建议 ---');
            result.suggestions.forEach(s => lines.push(`  · ${s}`));
        }

        return lines.join('\n');
    }

    // 公开 API
    return {
        calculate,
        generateEvaluation,
        getGrade: _getGrade,
        DIMENSIONS
    };
})();
