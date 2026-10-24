/**
 * 液相旋光实验 - 报告评分计算器
 *
 * 基于多维度权重体系对实验报告进行自动评分，涵盖数据完整性、
 * 计算准确性、误差分析质量、思政反思和格式规范五个维度。
 *
 * @module experiment-report-calculator
 * @version 1.0.0
 */

const ReportCalculator = {
    // ==================== 主评分入口 ====================

    /**
     * 计算实验报告总分及各维度明细
     *
     * 综合评估五个维度并生成详细的评分报告，包括：
     * - 总分（0-100）
     * - 各维度得分与满分
     * - 等级评定 (A/B/C/D/F)
     * - 反馈意见数组
     *
     * @public
     * @param {Object} experimentData - 完整的实验数据对象
     * @param {Object} [answers] - 思政思考题作答对象
     * @returns {Object} 评分结果对象
     * @returns {number} returns.totalScore - 总分 (0-100)
     * @returns {Object} returns.breakdown - 各维度得分明细
     * @returns {string} returns.grade - 等级字符串
     * @returns {string[]} returns.feedback - 反馈意见数组
     */
    calculate(experimentData, answers = {}) {
        const breakdown = {};
        const feedback = [];

        // 1. 数据完整性评分
        const dataResult = this._scoreDataCompleteness(experimentData);
        breakdown.dataCompleteness = dataResult;
        feedback.push(...dataResult.feedback);

        // 2. 计算准确性评分
        const calcResult = this._scoreCalculationAccuracy(experimentData);
        breakdown.calculationAccuracy = calcResult;
        feedback.push(...calcResult.feedback);

        // 3. 误差分析质量评分
        const errorResult = this._scoreErrorAnalysisQuality(answers);
        breakdown.errorAnalysisQuality = errorResult;
        feedback.push(...errorResult.feedback);

        // 4. 思政反思质量评分
        const ideolResult = this._scoreIdeologicalReflection(answers);
        breakdown.ideologicalReflection = ideolResult;
        feedback.push(...ideolResult.feedback);

        // 5. 报告格式规范评分
        const formatResult = this._scoreReportFormatting(experimentData, answers);
        breakdown.reportFormatting = formatResult;
        feedback.push(...formatResult.feedback);

        // 汇总总分
        const totalScore = Math.round(
            dataResult.score + calcResult.score + errorResult.score + ideolResult.score + formatResult.score
        );

        // 获取等级
        const grade = this.getGrade(totalScore);

        return {
            totalScore,
            breakdown,
            grade,
            feedback,
            timestamp: new Date().toISOString()
        };
    },

    // ==================== 维度一：数据完整性 ====================

    /**
     * 评估数据完整性（满分 25 分）
     *
     * 检查项：
     * - 测量组数是否充足（>=4 组为基本要求）
     * - 每组数据字段是否齐全（A0, A, deltaA, 浓度, 温度, 管长）
     * - 浓度覆盖范围是否足够多样
     *
     * @private
     * @param {Object} data - 实验数据
     * @returns {Object} 含 score、maxScore、feedback 的结果对象
     */
    _scoreDataCompleteness(data) {
        let totalScore = 0;
        const feedback = [];
        const criteria = (typeof ReportConfig !== 'undefined' ? ReportConfig.scoringCriteria : {}).dataCompleteness || {};

        // 获取已完成测量组
        const measurements = (data.measurements || []).filter(m => m.deltaA !== null && m.deltaA !== undefined);
        const measurementCount = measurements.length;

        // --- 子项1：测量组数 ---
        let countScore = 0;
        if (criteria.rules && criteria.rules.measurementCount) {
            const rules = criteria.rules.measurementCount.thresholds || [];
            for (const rule of rules) {
                if (measurementCount >= rule.min) {
                    countScore = rule.score;
                    feedback.push(`[数据完整性] ${rule.comment}`);
                    break;
                }
            }
        } else {
            // 降级默认逻辑
            if (measurementCount >= 6) countScore = 12;
            else if (measurementCount >= 5) countScore = 10;
            else if (measurementCount >= 4) countScore = 8;
            else if (measurementCount >= 3) countScore = 5;
            else countScore = 2;

            if (measurementCount < 4) {
                feedback.push(`[数据完整性] 警告：测量组数仅 ${measurementCount} 组，建议至少完成 4 组测量以获得可靠结果。`);
            } else {
                feedback.push(`[数据完整性] 完成 ${measurementCount} 组有效测量，数据量${measurementCount >= 6 ? '充足' : '达标'}。`);
            }
        }
        totalScore += countScore;

        // --- 子项2：字段完整率 ---
        let fieldScore = 0;
        if (measurements.length > 0) {
            const requiredFields = ['concentration', 'temperature', 'tubeLength', 'A0', 'A', 'deltaA'];
            let totalFields = 0;
            let filledFields = 0;

            measurements.forEach(m => {
                requiredFields.forEach(field => {
                    totalFields++;
                    if (m[field] !== null && m[field] !== undefined && m[field] !== '') {
                        filledFields++;
                    }
                });
            });

            const completenessRatio = filledFields / totalFields;

            if (criteria.rules && criteria.rules.fieldCompleteness) {
                const rules = criteria.rules.fieldCompleteness.thresholds || [];
                for (const rule of rules) {
                    if (completenessRatio >= rule.ratio) {
                        fieldScore = rule.score;
                        feedback.push(`[数据完整性] ${rule.comment}`);
                        break;
                    }
                }
            } else {
                if (completenessRatio >= 0.95) fieldScore = 8;
                else if (completenessRatio >= 0.85) fieldScore = 6;
                else if (completenessRatio >= 0.7) fieldScore = 4;
                else fieldScore = 1;

                if (completenessRatio < 0.9) {
                    feedback.push(`[数据完整性] 注意：部分数据字段存在缺失（完整率 ${(completenessRatio * 100).toFixed(0)}%），请检查每组数据的浓度、温度、管长等参数。`);
                } else {
                    feedback.push(`[数据完整性] 数据字段完整率 ${(completenessRatio * 100).toFixed(0)}%，记录规范。`);
                }
            }
        } else {
            fieldScore = 0;
            feedback.push('[数据完整性] 无有效测量数据，无法评估字段完整性。');
        }
        totalScore += fieldScore;

        // --- 子项3：浓度多样性 ---
        let diversityScore = 0;
        if (measurements.length > 0) {
            const concentrations = new Set(
                measurements.map(m => parseFloat((m.concentration || 0).toFixed(4)))
            );
            const uniqueCount = concentrations.size;

            if (criteria.rules && criteria.rules.concentrationDiversity) {
                const rules = criteria.rules.concentrationDiversity.thresholds || [];
                for (const rule of rules) {
                    if (uniqueCount >= rule.count) {
                        diversityScore = rule.score;
                        feedback.push(`[数据完整性] ${rule.comment}`);
                        break;
                    }
                }
            } else {
                if (uniqueCount >= 5) diversityScore = 5;
                else if (uniqueCount >= 4) diversityScore = 4;
                else if (uniqueCount >= 3) diversityScore = 3;
                else diversityScore = 1;

                if (uniqueCount <= 2 && measurements.length >= 4) {
                    feedback.push(`[数据完整性] 建议：当前仅使用 ${uniqueCount} 种不同浓度，建议增加浓度种类以改善拟合可靠性。`);
                } else {
                    feedback.push(`[数据完整性] 使用了 ${uniqueCount} 种不同浓度的溶液进行测量。`);
                }
            }
        }
        totalScore += diversityScore;

        return {
            score: totalScore,
            maxScore: 25,
            details: { measurementCount, countScore, fieldScore, diversityScore },
            feedback
        };
    },

    // ==================== 维度二：计算准确性 ====================

    /**
     * 评估计算准确性（满分 30 分）
     *
     * 核心指标：
     * - 比旋光度相对误差（与标准值 66.37 °·mL/(dm·g) 比较）
     * - 线性拟合优度 R²（旋光度 vs 浓度的线性相关性）
     *
     * @private
     * @param {Object} data - 实验数据
     * @returns {Object} 含 score、maxScore、feedback 的结果对象
     */
    _scoreCalculationAccuracy(data) {
        let totalScore = 0;
        const feedback = [];

        const measurements = (data.measurements || [])
            .filter(m => m.deltaA !== null && m.deltaA !== undefined)
            .filter(m => m.concentration !== null && m.concentration !== undefined);

        if (measurements.length < 3) {
            feedback.push('[计算准确性] 有效测量数据不足 3 组，无法进行线性拟合和比旋光度计算。');
            return { score: 0, maxScore: 30, details: {}, feedback };
        }

        // 执行最小二乘法线性拟合: deltaA = alpha * c * L
        // 即 deltaA/L = alpha * c，拟合斜率即为比旋光度
        const fitResult = this._linearFit(measurements);

        // --- 子项1：比旋光度相对误差 ---
        let rotationScore = 0;
        const theoreticalAlpha = 66.37; // 蔗糖在 20°C 下标准比旋光度

        if (fitResult.slope !== null) {
            const measuredAlpha = fitResult.slope;
            const relativeError = Math.abs((measuredAlpha - theoreticalAlpha) / theoreticalAlpha) * 100;

            const criteria = (typeof ReportConfig !== 'undefined' ? ReportConfig.scoringCriteria : {}).calculationAccuracy || {};
            if (criteria.rules && criteria.rules.specificRotationError) {
                const rules = criteria.rules.specificRotationError.thresholds || [];
                for (const rule of rules) {
                    if (relativeError <= rule.maxError) {
                        rotationScore = rule.score;
                        feedback.push(`[计算准确性] ${rule.comment}`);
                        break;
                    }
                }
            } else {
                if (relativeError <= 3) rotationScore = 18;
                else if (relativeError <= 5) rotationScore = 14;
                else if (relativeError <= 8) rotationScore = 10;
                else if (relativeError <= 12) rotationScore = 6;
                else rotationScore = 2;

                feedback.push(`[计算准确性] 测得比旋光度: ${measuredAlpha.toFixed(2)} °·mL/(dm·g)，` +
                    `理论值: ${theoreticalAlpha.toFixed(2)}，相对误差: ${relativeError.toFixed(2)}%。`);
            }

            totalScore += rotationScore;
        }

        // --- 子项2：线性拟合 R² ---
        let fitScore = 0;
        const rSquared = fitResult.rSquared;

        if (rSquared !== null) {
            const criteria = (typeof ReportConfig !== 'undefined' ? ReportConfig.scoringCriteria : {}).calculationAccuracy || {};
            if (criteria.rules && criteria.rules.linearFitQuality) {
                const rules = criteria.rules.linearFitQuality.thresholds || [];
                for (const rule of rules) {
                    if (rSquared >= rule.minR2) {
                        fitScore = rule.score;
                        feedback.push(`[计算准确性] ${rule.comment}`);
                        break;
                    }
                }
            } else {
                if (rSquared >= 0.99) fitScore = 12;
                else if (rSquared >= 0.97) fitScore = 9;
                else if (rSquared >= 0.95) fitScore = 6;
                else if (rSquared >= 0.90) fitScore = 3;
                else fitScore = 1;

                feedback.push(`[计算准确性] 线性拟合 R² = ${rSquared.toFixed(4)}，` +
                    `表明旋光度与浓度之间${rSquared >= 0.95 ? '具有良好' : rSquared >= 0.85 ? '具有一定' : '缺乏'}的线性关系。`);
            }

            totalScore += fitScore;
        }

        return {
            score: totalScore,
            maxScore: 30,
            details: {
                measuredAlpha: fitResult.slope,
                theoreticalAlpha,
                relativeError: fitResult.slope ? Math.abs((fitResult.slope - theoreticalAlpha) / theoreticalAlpha * 100) : null,
                rSquared: fitResult.rSquared,
                rotationScore,
                fitScore
            },
            feedback
        };
    },

    // ==================== 维度三：误差分析质量 ====================

    /**
     * 评估误差分析质量（满分 20 分）
     *
     * 基于学生提交的误差分析内容进行评估：
     * - 识别出的误差来源数量
     * - 分析深度（定性/定量/改进建议）
     * - 是否包含不确定度计算
     *
     * @private
     * @param {Object} answers - 学生作答（含 errorAnalysis 字段）
     * @returns {Object} 含 score、maxScore、feedback 的结果对象
     */
    _scoreErrorAnalysisQuality(answers = {}) {
        let totalScore = 0;
        const feedback = [];
        const analysisText = answers.errorAnalysis || answers.误差分析 || '';

        if (!analysisText || analysisText.trim().length === 0) {
            feedback.push('[误差分析] 未提交误差分析内容，此项不得分。建议从仪器误差、操作误差、环境误差、样品误差四个方面进行分析。');
            return { score: 0, maxScore: 20, details: { identifiedErrors: 0 }, feedback };
        }

        // 获取参考误差源列表
        const referenceNames = typeof ReportConfig !== 'undefined'
            ? ReportConfig.getAllErrorSourceNames()
            : ['刻度盘分度值限制', '零点漂移', '等亮判读主观性', '温度波动',
               '气泡残留', '浓度配制不准', '溶液均匀性', '读数时机不当'];

        // --- 子项1：识别误差源数量 ---
        let identifiedCount = 0;
        referenceNames.forEach(name => {
            if (analysisText.includes(name)) {
                identifiedCount++;
            }
        });

        // 额外匹配一些常见表述
        const extraPatterns = [
            '读数误差', '估读', '视差', '系统误差', '随机误差',
            '偶然误差', '光强不稳', '振动', '杂质', '污染'
        ];
        extraPatterns.forEach(pattern => {
            if (analysisText.includes(pattern)) {
                identifiedCount += 0.5; // 部分匹配计半分
            }
        });
        identifiedCount = Math.floor(identifiedCount);

        let errorCountScore = 0;
        const criteria = (typeof ReportConfig !== 'undefined' ? ReportConfig.scoringCriteria : {}).errorAnalysisQuality || {};
        if (criteria.rules && criteria.rules.identifiedErrors) {
            const rules = criteria.rules.identifiedErrors.thresholds || [];
            for (const rule of rules) {
                if (identifiedCount >= rule.count) {
                    errorCountScore = rule.score;
                    feedback.push(`[误差分析质量] ${rule.comment}`);
                    break;
                }
            }
        } else {
            if (identifiedCount >= 5) errorCountScore = 10;
            else if (identifiedCount >= 4) errorCountScore = 8;
            else if (identifiedCount >= 3) errorCountScore = 6;
            else if (identifiedCount >= 2) errorCountScore = 4;
            else if (identifiedCount >= 1) errorCountScore = 2;
            else errorCountScore = 0;

            feedback.push(`[误差分析质量] 识别出 ${identifiedCount} 项误差来源。`);
        }
        totalScore += errorCountScore;

        // --- 子项2：分析深度 ---
        let depthScore = 0;
        let depthLevel = 'none';

        const textLen = analysisText.length;
        const hasQuantitative = /(\d+\.?\d*\s*[%°℃dmgnm]|±|不确定度|标准差|方差|置信)/.test(analysisText);
        const hasImprovement = /(改进|建议|优化|减小|降低|提高精度|减少误差)/.test(analysisText);

        if (textLen >= 300 && hasQuantitative && hasImprovement) {
            depthLevel = 'excellent';
            depthScore = 6;
        } else if (textLen >= 150 && (hasQuantitative || hasImprovement)) {
            depthLevel = 'good';
            depthScore = 4;
        } else if (textLen >= 50) {
            depthLevel = 'basic';
            depthScore = 2;
        } else {
            depthLevel = 'none';
            depthScore = 0;
        }

        if (criteria.rules && criteria.rules.analysisDepth) {
            const rules = criteria.rules.analysisDepth.thresholds || [];
            for (const rule of rules) {
                if (rule.level === depthLevel) {
                    depthScore = rule.score;
                    feedback.push(`[误差分析质量] ${rule.comment}`);
                    break;
                }
            }
        } else {
            feedback.push(`[误差分析质量] 分析深度: ${depthLevel === 'excellent' ? '深入透彻' :
                depthLevel === 'good' ? '较为全面' : depthLevel === 'basic' ? '简单罗列' : '无内容'}。`);
        }
        totalScore += depthScore;

        // --- 子项3：不确定度计算 ---
        let uncertaintyScore = 0;
        const hasUncertainty = /(不确定度|u\s*[(c)]?|扩展不确定度|合成标准|传递公式)/.test(analysisText);
        const hasFullUncertainty = hasUncertainty && /(\+\s*-|k=|p=|自由度|合成)/.test(analysisText);

        if (hasFullUncertainty) {
            uncertaintyScore = 4;
            feedback.push('[误差分析质量] 包含完整的的不确定度传递计算过程。');
        } else if (hasUncertainty) {
            uncertaintyScore = 2;
            feedback.push('[误差分析质量] 涉及不确定度概念但未给出完整计算。');
        } else {
            feedback.push('[误差分析质量] 建议补充不确定度的分析与计算。');
        }
        totalScore += uncertaintyScore;

        return {
            score: totalScore,
            maxScore: 20,
            details: { identifiedErrors: identifiedCount, depthLevel, hasUncertainty: hasFullUncertainty || hasUncertainty },
            feedback
        };
    },

    // ==================== 维度四：思政反思质量 ====================

    /**
     * 评估课程思政反思质量（满分 15 分）
     *
     * 评估维度：
     * - 反思字数是否达标
     * - 思政关键词匹配数量
     * - 思考深度（结合实际/个人感悟）
     *
     * @private
     * @param {Object} answers - 学生作答（含 ideologicalReflection / 思考题答案等字段）
     * @returns {Object} 含 score、maxScore、feedback 的结果 object
     */
    _scoreIdeologicalReflection(answers = {}) {
        let totalScore = 0;
        const feedback = [];

        // 合并所有可能的思政作答文本
        const reflectionText = [
            answers.ideologicalReflection || '',
            answers.reflection || '',
            answers.思考题 || '',
            answers.学习心得 || '',
            answers.心得体会 || ''
        ].filter(t => t && t.trim()).join('\n');

        if (!reflectionText || reflectionText.trim().length === 0) {
            feedback.push('[思政反思] 未提交思政反思内容，此项不得分。请结合"工匠精神""国计民生中的测量精度"等主题撰写个人思考。');
            return { score: 0, maxScore: 15, details: { wordCount: 0, keywordMatches: 0 }, feedback };
        }

        const wordCount = reflectionText.replace(/\s/g, '').length; // 中文字符计数（去除空白）

        // --- 子项1：字数达标 ---
        let wordScore = 0;
        const criteria = (typeof ReportConfig !== 'undefined' ? ReportConfig.scoringCriteria : {}).ideologicalReflection || {};
        if (criteria.rules && criteria.rules.wordCount) {
            const rules = criteria.rules.wordCount.thresholds || [];
            for (const rule of rules) {
                if (wordCount >= rule.minWords) {
                    wordScore = rule.score;
                    feedback.push(`[思政反思] ${rule.comment}（实际 ${wordCount} 字）`);
                    break;
                }
            }
        } else {
            if (wordCount >= 500) wordScore = 5;
            else if (wordCount >= 300) wordScore = 4;
            else if (wordCount >= 150) wordScore = 2;
            else wordScore = 1;

            feedback.push(`[思政反思] 反思篇幅 ${wordCount} 字，${wordCount >= 300 ? '达到要求' : '偏短，建议至少 300 字'}。`);
        }
        totalScore += wordScore;

        // --- 子项2：关键词匹配 ---
        let keywordScore = 0;
        const keywords = (criteria.rules && criteria.rules.keywordMatch && criteria.rules.keywordMatch.keywords) ||
            ['工匠精神', '精益求精', '科学态度', '国计民生', '测量精度',
             '严谨求实', '实事求是', '创新驱动', '质量控制', '社会责任'];

        let matchCount = 0;
        keywords.forEach(kw => {
            if (reflectionText.includes(kw)) matchCount++;
        });

        if (criteria.rules && criteria.rules.keywordMatch) {
            const rules = criteria.rules.keywordMatch.thresholds || [];
            for (const rule of rules) {
                if (matchCount >= rule.matchCount) {
                    keywordScore = rule.score;
                    feedback.push(`[思政反思] ${rule.comment}（匹配到 "${keywords.filter(k => reflectionText.includes(k)).slice(0, 5).join('", "')}" 等 ${matchCount} 个关键词）`);
                    break;
                }
            }
        } else {
            if (matchCount >= 5) keywordScore = 5;
            else if (matchCount >= 3) keywordScore = 4;
            else if (matchCount >= 2) keywordScore = 2;
            else if (matchCount >= 1) keywordScore = 1;
            else keywordScore = 0;

            feedback.push(`[思政反思] 匹配到 ${matchCount} 个思政关键词。`);
        }
        totalScore += keywordScore;

        // --- 子项3：思考深度 ---
        let depthScore = 0;
        let depthLevel = 'shallow';

        // 判断深度的启发式规则
        const hasPersonalExperience = /(我的|我感到|让我|我认为|体会到|深刻|启发|触动|感悟)/.test(reflectionText);
        const hasSocialConnection = /(社会|国家|行业|民生|责任|使命|贡献|价值)/.test(reflectionText);
        const hasConcreteExample = /(例如|比如|以.*为例|在实际|结合本实验|通过本次)/.test(reflectionText);
        const hasForwardLooking = /(未来|今后|努力方向|目标|计划|继续学习|提升自己)/.test(reflectionText);

        const depthIndicators = [hasPersonalExperience, hasSocialConnection, hasConcreteExample, hasForwardLooking];
        const deepIndicatorCount = depthIndicators.filter(Boolean).length;

        if (deepIndicatorCount >= 3 && wordCount >= 300) {
            depthLevel = 'deep';
            depthScore = 5;
        } else if (deepIndicatorCount >= 2 && wordCount >= 200) {
            depthLevel = 'moderate';
            depthScore = 3;
        } else {
            depthLevel = 'shallow';
            depthScore = 1;
        }

        if (criteria.rules && criteria.rules.reflectionDepth) {
            const rules = criteria.rules.reflectionDepth.thresholds || [];
            for (const rule of rules) {
                if (rule.level === depthLevel) {
                    depthScore = rule.score;
                    feedback.push(`[思政反思] ${rule.comment}`);
                    break;
                }
            }
        } else {
            const levelDesc = { deep: '深刻', moderate: '有一定深度', shallow: '流于表面' };
            feedback.push(`[思政反思] 思考深度评级: ${levelDesc[depthLevel]}。`);
        }
        totalScore += depthScore;

        return {
            score: totalScore,
            maxScore: 15,
            details: { wordCount, keywordMatches: matchCount, matchedKeywords: matchCount, depthLevel },
            feedback
        };
    },

    // ==================== 维度五：报告格式规范 ====================

    /**
     * 评估报告格式规范性（满分 10 分）
     *
     * 检查项：
     * - 单位标注正确性与一致性
     * - 有效数字使用规范
     * - 整体排版层次
     *
     * @private
     * @param {Object} data - 实验数据
     * @param {Object} answers - 作答内容
     * @returns {Object} 含 score、maxScore、feedback 的结果对象
     */
    _scoreReportFormatting(data, answers = {}) {
        let totalScore = 0;
        const feedback = [];

        // 合并全部文本用于检查
        const allText = JSON.stringify(data) + ' ' + JSON.stringify(answers);

        // --- 子项1：单位标注 ---
        let unitScore = 0;
        const expectedUnits = ['°', '度', 'g/mL', 'dm', 'nm', '°C', '℃'];
        const foundUnits = expectedUnits.filter(u => allText.includes(u));

        // 检查是否有明显的单位错误（如数字后面缺少单位的情况）
        const hasUnitAfterNumber = /\d+\s*(°|度|g\/mL|dm|nm|°C|℃|%)/.test(allText);

        if (foundUnits.length >= 4 && hasUnitAfterNumber) {
            unitScore = 3;
            feedback.push('[报告格式] 单位标注正确且全文一致。');
        } else if (foundUnits.length >= 2) {
            unitScore = 2;
            feedback.push('[报告格式] 单位基本正确，但建议检查一致性。');
        } else {
            unitScore = 0;
            feedback.push('[报告格式] 单位标注存在遗漏或错误，请确保所有数值后附上正确的物理量单位。');
        }
        totalScore += unitScore;

        // --- 子项2：有效数字 ---
        let sigFigScore = 0;
        // 检查数据中是否存在合理的小数位数（旋光度通常保留2~4位小数）
        const decimalPattern = /\d+\.\d{2,4}/g;
        const matches = allText.match(decimalPattern) || [];
        const reasonableDecimals = matches.filter(m => {
            const num = parseFloat(m);
            return num >= 0.01 && num < 1000; // 合理范围内的数值
        }).length;

        // 检查是否有过多的无效尾零或过少的小数位
        const tooFewDecimals = /\b\d{2,}\b(?!\s*[°%])/.test(allText); // 整数可能缺少小数位

        if (reasonableDecimals >= 5 && !tooFewDecimals) {
            sigFigScore = 3;
            feedback.push('[报告格式] 有效数字使用规范。');
        } else if (reasonableDecimals >= 2) {
            sigFigScore = 1;
            feedback.push('[报告格式] 有效数字基本正确，部分数据可进一步规范化。');
        } else {
            sigFigScore = 0;
            feedback.push('[报告格式] 请注意有效数字的规范使用，测量数据通常保留 2~4 位小数。');
        }
        totalScore += sigFigScore;

        // --- 子项3：整体排版 ---
        let layoutScore = 2; // 默认给基础分
        layoutScore = 4; // HTML 报告模板已保证基本排版，此处给予较高基础分
        feedback.push('[报告格式] 报告由系统模板自动生成，排版结构清晰。');

        totalScore += layoutScore;

        return {
            score: totalScore,
            maxScore: 10,
            details: { unitScore, sigFigScore, layoutScore, foundUnits: foundUnits.length },
            feedback
        };
    },

    // ==================== 辅助计算方法 ====================

    /**
     * 最小二乘法线性拟合
     *
     * 对测量数据进行 y = kx 形式的线性回归（过原点），
     * 其中 x = concentration * tubeLength, y = deltaA
     * 斜率 k 即为比旋光度 [alpha]
     *
     * @private
     * @param {Array<Object>} measurements - 已完成的测量数组
     * @returns {Object} 拟合结果 { slope, intercept, rSquared, residuals }
     */
    _linearFit(measurements) {
        if (!measurements || measurements.length < 2) {
            return { slope: null, intercept: 0, rSquared: null, residuals: [] };
        }

        // 构建拟合点：(c * L, deltaA)
        const points = measurements.map(m => ({
            x: (m.concentration || 0) * (m.tubeLength || 1),
            y: m.deltaA || 0
        }));

        const n = points.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumX2 += p.x * p.x;
            sumY2 += p.y * p.y;
        });

        // 过原点拟合: y = kx, k = sum(xy) / sum(x^2)
        const denominator = sumX2;
        if (Math.abs(denominator) < 1e-10) {
            return { slope: null, intercept: 0, rSquared: null, residuals: [] };
        }

        const slope = sumXY / denominator;

        // 计算 R²
        const meanY = sumY / n;
        let ssTotal = 0, ssResidual = 0;

        points.forEach(p => {
            const predicted = slope * p.x;
            ssTotal += (p.y - meanY) ** 2;
            ssResidual += (p.y - predicted) ** 2;
        });

        const rSquared = ssTotal > 1e-10 ? 1 - ssResidual / ssTotal : (ssResidual < 1e-10 ? 1 : 0);

        // 计算残差
        const residuals = points.map(p => ({
            x: p.x,
            y: p.y,
            predicted: slope * p.x,
            residual: p.y - slope * p.x
        }));

        return {
            slope: slope,
            intercept: 0,
            rSquared: Math.max(0, Math.min(1, rSquared)),
            residuals,
            pointCount: n
        };
    },

    // ==================== 公开工具方法 ====================

    /**
     * 根据总分获取等级标识
     *
     * @public
     * @param {number} score - 总分 (0-100)
     * @returns {string} 等级字符串，如 "A (优秀)"
     */
    getGrade(score) {
        const s = Math.max(0, Math.min(100, score));
        if (typeof ReportConfig !== 'undefined') {
            return ReportConfig.getGradeLabel(s);
        }
        if (s >= 90) return 'A (优秀)';
        if (s >= 80) return 'B (良好)';
        if (s >= 70) return 'C (中等)';
        if (s >= 60) return 'D (及格)';
        return 'F (不及格)';
    },

    /**
     * 获取等级字母（不含中文描述）
     *
     * @public
     * @param {number} score - 总分
     * @returns {string} 等级字母 A/B/C/D/F
     */
    getGradeLetter(score) {
        const s = Math.max(0, Math.min(100, score));
        if (s >= 90) return 'A';
        if (s >= 80) return 'B';
        if (s >= 70) return 'C';
        if (s >= 60) return 'D';
        return 'F';
    },

    /**
     * 生成详细的评分评语文案
     *
     * 根据总分和各项得分情况，组合生成针对性的评语
     *
     * @public
     * @param {Object} result - calculate() 返回的评分结果
     * @returns {Object} 含 comment 和 suggestions 的评语对象
     */
    generateEvaluation(result) {
        const { totalScore, grade, breakdown } = result;
        const g = result.grade.charAt(0); // 取等级字母

        const evaluations = {
            A: {
                comment: `你的液相旋光实验完成得非常出色！

实验操作规范严谨，数据采集完整准确，比旋光度测定结果精确度高，线性拟合优度优异。你展现出了优秀的实验素养和数据处理能力，这种严谨求实的态度正是科研工作者的宝贵品质。

在误差分析方面，你能够全面识别各类误差来源并进行定量讨论；思政反思紧密结合实验体验与社会实际，体现了良好的思想觉悟。继续保持这份对科学的热爱和严谨！`,
                suggestions: `继续深入学习：
1. 探索旋光现象在其他手性物质检测中的应用（如药物纯度控制、糖工业在线监测）
2. 研究更精细的误差分析方法（如蒙特卡洛模拟评估不确定度）
3. 了解现代自动旋光仪的工作原理和技术发展
4. 尝试设计多因素实验方案（如同时考察温度和浓度的影响）`
            },
            B: {
                comment: `你的液相旋光实验完成得很好！

数据采集较为完整，操作基本规范，比旋光度测定结果较为准确，旋光度-浓度线性关系良好。在实验过程中展现出了认真负责的态度，这是科学研究的重要基础。

你在实验操作的规范性和数据处理上都表现不错，误差分析和思政反思也有一定深度。继续在细节上更加精益求精，你会取得更大的进步！`,
                suggestions: `改进建议：
1. 可适当增加测量组数和浓度多样性以提高拟合可靠性
2. 在误差分析中尝试引入不确定度传递的定量计算
3. 加强对旋光原理中温度修正公式的理解与应用
4. 思政反思可进一步结合具体行业案例展开`
            },
            C: {
                comment: `你基本完成了液相旋光实验任务，掌握了旋光法测定比旋光度的基本方法。

但在数据采集的完整性、测量精度和误差分析的深度上还有提升空间。科学研究需要严谨的态度和扎实的基础，建议你在这些方面多下功夫。

通过认真总结实验中的问题，加强基础知识学习，你一定能够提高实验能力！`,
                suggestions: `重点改进：
1. 增加测量组数（建议不少于 5 组），确保覆盖多种浓度
2. 注意每次测量的零点校准和等亮判定精度
3. 系统学习误差来源分类方法，完善误差分析章节
4. 加强有效数字和单位标注的规范性
5. 思政反思应结合个人真实感受撰写`
            },
            D: {
                comment: `你完成了基本的液相旋光实验操作，但在数据质量、测量精度和报告完整性方面都需要明显改进。

实验不仅是完成任务，更重要的是培养科学思维和严谨态度。旋光测量看似简单，但对等亮判定的精准追求恰恰体现了工匠精神的核心内涵。希望你能够重视实验过程的每一个细节。

建议你认真总结实验中存在的问题，在今后的学习中更加努力！`,
                suggestions: `必须改进：
1. 认真学习旋光原理和比旋光度的定义式
2. 至少完成 5 组以上有效测量，确保浓度有足够变化范围
3. 严格按步骤进行零点校准和等亮调节
4. 补充完整的误差分析，至少识别 3 种主要误差来源
5. 撰写不少于 300 字的思政反思
6. 检查报告中单位标注和有效数字的规范性`
            },
            F: {
                comment: `你的液相旋光实验完成情况不理想，在数据采集、计算准确性和报告完整性方面都存在较大问题。

这说明你对实验的重视程度不够，或者对旋光原理理解不足。旋光法是食品检测、制药质检等领域的重要手段，其测量精度直接关系到产品质量和人民健康。希望你能够认识到问题的严重性，端正学习态度。

强烈建议你重新完成实验！`,
                suggestions: `必须改进：
1. 系统复习旋光现象的基本原理和实验操作流程
2. 重新完成全部实验步骤，确保每一步都认真对待
3. 采集足够数量的有效数据（>=5 组），记录完整参数
4. 使用最小二乘法正确处理数据，计算比旋光度及其误差
5. 从仪器、操作、环境、样品四方面进行系统的误差分析
6. 结合"工匠精神"主题，认真撰写思政反思（>=300字）
7. 主动寻求老师指导，找出问题所在并改正后重新提交`
            }
        };

        return evaluations[g] || evaluations.F;
    }
};

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportCalculator;
}
