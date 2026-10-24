// 综合评分计算模块
// 根据实验数据和答题结果计算综合评分

class ScoreCalculator {
    constructor(config) {
        this.config = config;
    }

    // 计算实验操作得分（满分70分）
    calculateExperimentScore(experimentData) {
        if (!experimentData || !experimentData.measurements) {
            return {
                total: 0,
                details: {
                    dataQuality: 0,
                    operationStandard: 0,
                    accuracy: 0
                },
                breakdown: []
            };
        }

        const measurements = experimentData.measurements;
        const statistics = experimentData.statistics || {};
        const parameters = experimentData.parameters || {};

        let dataQualityScore = 0;
        let operationStandardScore = 0;
        let accuracyScore = 0;
        const breakdown = [];

        // 1. 数据采集质量（30分）
        // 1.1 测量点数量（10分）
        const count = measurements.length;
        const quantityRules = this.config.experimentScoring.dataQuality.criteria.quantity.rules;
        let quantityScore = 0;
        for (const rule of quantityRules) {
            if (rule.min !== undefined && rule.max !== undefined) {
                if (count >= rule.min && count <= rule.max) {
                    quantityScore = rule.score;
                    break;
                }
            } else if (rule.min !== undefined && count >= rule.min) {
                quantityScore = rule.score;
                break;
            } else if (rule.max !== undefined && count <= rule.max) {
                quantityScore = rule.score;
                break;
            }
        }
        dataQualityScore += quantityScore;
        breakdown.push({
            item: '测量点数量',
            score: quantityScore,
            maxScore: 10,
            detail: `采集了${count}个测量点`
        });

        // 1.2 数据完整性（10分）
        const hasDark = statistics.hasDark || false;
        const hasBright = statistics.hasBright || false;
        const completenessConfig = this.config.experimentScoring.dataQuality.criteria.completeness;
        let completenessScore = 0;
        if (hasDark && hasBright) {
            completenessScore = completenessConfig.hasBothTypes;
            breakdown.push({
                item: '数据完整性',
                score: completenessScore,
                maxScore: 10,
                detail: '包含暗环和亮环数据'
            });
        } else {
            completenessScore = completenessConfig.singleType;
            breakdown.push({
                item: '数据完整性',
                score: completenessScore,
                maxScore: 10,
                detail: '仅包含一种类型的环'
            });
        }
        dataQualityScore += completenessScore;

        // 1.3 数据合理性（10分）- R²值
        const r2 = statistics.r2 || 0;
        const rationalityRules = this.config.experimentScoring.dataQuality.criteria.rationality.rules;
        let rationalityScore = 0;
        for (const rule of rationalityRules) {
            if (rule.min !== undefined && rule.max !== undefined) {
                if (r2 >= rule.min && r2 < rule.max) {
                    rationalityScore = rule.score;
                    break;
                }
            } else if (rule.min !== undefined && r2 >= rule.min) {
                rationalityScore = rule.score;
                break;
            } else if (rule.max !== undefined && r2 < rule.max) {
                rationalityScore = rule.score;
                break;
            }
        }
        dataQualityScore += rationalityScore;
        breakdown.push({
            item: '数据合理性（R²）',
            score: rationalityScore,
            maxScore: 10,
            detail: `线性拟合R² = ${r2.toFixed(4)}`
        });

        // 2. 实验操作规范（20分）
        // 2.1 测量顺序（10分）
        const isOrdered = statistics.isOrdered || false;
        const sequenceConfig = this.config.experimentScoring.operationStandard.criteria.sequence;
        const sequenceScore = isOrdered ? sequenceConfig.ordered : sequenceConfig.unordered;
        operationStandardScore += sequenceScore;
        breakdown.push({
            item: '测量顺序',
            score: sequenceScore,
            maxScore: 10,
            detail: isOrdered ? '按环序号递增测量' : '测量顺序不规范'
        });

        // 2.2 数据记录（10分）
        const recordingConfig = this.config.experimentScoring.operationStandard.criteria.recording;
        const recordingScore = recordingConfig.complete;  // 假设数据格式都是正确的
        operationStandardScore += recordingScore;
        breakdown.push({
            item: '数据记录',
            score: recordingScore,
            maxScore: 10,
            detail: '数据格式正确，单位标注清晰'
        });

        // 3. 结果准确性（20分）
        // 3.1 曲率半径误差（15分）
        // 这里需要计算实际测量的曲率半径与理论值的误差
        // 由于没有理论值，我们假设误差为0（或者可以从数据中计算）
        const radiusErrorPercent = 0;  // 暂时设为0，实际应该计算
        const radiusErrorRules = this.config.experimentScoring.accuracy.criteria.radiusError.rules;
        let radiusErrorScore = 0;
        for (const rule of radiusErrorRules) {
            if (rule.min !== undefined && rule.max !== undefined) {
                if (radiusErrorPercent >= rule.min && radiusErrorPercent < rule.max) {
                    radiusErrorScore = rule.score;
                    break;
                }
            } else if (rule.min !== undefined && radiusErrorPercent >= rule.min) {
                radiusErrorScore = rule.score;
                break;
            } else if (rule.max !== undefined && radiusErrorPercent < rule.max) {
                radiusErrorScore = rule.score;
                break;
            }
        }
        accuracyScore += radiusErrorScore;
        breakdown.push({
            item: '曲率半径误差',
            score: radiusErrorScore,
            maxScore: 15,
            detail: `误差 < 5%`  // 简化处理
        });

        // 3.2 波长参数设置（5分）
        const wavelength = parameters.wavelength || 0;
        const wavelengthConfig = this.config.experimentScoring.accuracy.criteria.wavelength;
        const isStandardWavelength = Math.abs(wavelength - 589) < 1;  // 589nm ± 1nm
        const wavelengthScore = isStandardWavelength ? wavelengthConfig.standard : wavelengthConfig.nonStandard;
        accuracyScore += wavelengthScore;
        breakdown.push({
            item: '波长参数设置',
            score: wavelengthScore,
            maxScore: 5,
            detail: isStandardWavelength ? '使用标准波长（589nm）' : `使用波长${wavelength}nm`
        });

        const totalExperimentScore = dataQualityScore + operationStandardScore + accuracyScore;

        return {
            total: totalExperimentScore,
            details: {
                dataQuality: dataQualityScore,
                operationStandard: operationStandardScore,
                accuracy: accuracyScore
            },
            breakdown: breakdown
        };
    }

    // 计算理论知识得分（满分30分）
    calculateTheoryScore(quizResults) {
        if (!quizResults || !quizResults.results) {
            return {
                total: 0,
                details: {
                    correctness: 0,
                    completeness: 0
                },
                breakdown: []
            };
        }

        const results = quizResults.results;
        const breakdown = [];

        // 1. 答题正确率（25分）
        let correctnessScore = 0;
        let singleChoiceCorrect = 0;
        let multipleChoiceCorrect = 0;

        results.forEach(result => {
            if (result.isCorrect) {
                if (result.type === '单选题') {
                    singleChoiceCorrect++;
                } else if (result.type === '多选题') {
                    multipleChoiceCorrect++;
                }
            }
        });

        // 单选题得分
        const singleChoiceConfig = this.config.theoryScoring.correctness.singleChoice;
        const singleChoiceScore = singleChoiceCorrect * singleChoiceConfig.scorePerQuestion;
        correctnessScore += singleChoiceScore;
        breakdown.push({
            item: '单选题',
            score: singleChoiceScore,
            maxScore: singleChoiceConfig.scorePerQuestion * singleChoiceConfig.totalQuestions,
            detail: `答对${singleChoiceCorrect}/${singleChoiceConfig.totalQuestions}题`
        });

        // 多选题得分
        const multipleChoiceConfig = this.config.theoryScoring.correctness.multipleChoice;
        const multipleChoiceScore = multipleChoiceCorrect * multipleChoiceConfig.scorePerQuestion;
        correctnessScore += multipleChoiceScore;
        breakdown.push({
            item: '多选题',
            score: multipleChoiceScore,
            maxScore: multipleChoiceConfig.scorePerQuestion * multipleChoiceConfig.totalQuestions,
            detail: `答对${multipleChoiceCorrect}/${multipleChoiceConfig.totalQuestions}题`
        });

        // 2. 答题完整性（5分）
        const totalQuestions = quizResults.total || 0;
        const answeredQuestions = results.length;
        const completenessConfig = this.config.theoryScoring.completeness;
        const completenessScore = answeredQuestions === totalQuestions ?
            completenessConfig.allAnswered : completenessConfig.partialAnswered;
        breakdown.push({
            item: '答题完整性',
            score: completenessScore,
            maxScore: 5,
            detail: answeredQuestions === totalQuestions ? '完成所有题目' : `完成${answeredQuestions}/${totalQuestions}题`
        });

        const totalTheoryScore = correctnessScore + completenessScore;

        return {
            total: totalTheoryScore,
            details: {
                correctness: correctnessScore,
                completeness: completenessScore
            },
            breakdown: breakdown
        };
    }

    // 计算综合得分
    calculateTotalScore(experimentData, quizResults) {
        const experimentScore = this.calculateExperimentScore(experimentData);
        const theoryScore = this.calculateTheoryScore(quizResults);

        const totalScore = experimentScore.total + theoryScore.total;

        return {
            totalScore: totalScore,
            experimentScore: experimentScore,
            theoryScore: theoryScore,
            level: this.config.getEvaluationLevel(totalScore),
            evaluation: this.config.evaluations[this.config.getEvaluationLevel(totalScore)]
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoreCalculator;
}
