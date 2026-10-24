// 综合评分报告配置文件
// 包含评分标准、开头语、结尾评语等

const ReportConfig = {
    // 评分权重配置
    weights: {
        experiment: 0.7,  // 实验操作 70%
        theory: 0.3       // 理论知识 30%
    },

    // 实验评分标准（满分70分）
    experimentScoring: {
        // 数据采集质量（30分）
        dataQuality: {
            maxScore: 30,
            criteria: {
                // 测量点数量（10分）
                quantity: {
                    maxScore: 10,
                    rules: [
                        { min: 8, score: 10 },
                        { min: 6, max: 7, score: 8 },
                        { min: 4, max: 5, score: 6 },
                        { min: 0, max: 3, score: 3 }
                    ]
                },
                // 数据完整性（10分）
                completeness: {
                    maxScore: 10,
                    hasBothTypes: 10,  // 包含暗环和亮环
                    singleType: 6      // 只有一种类型
                },
                // 数据合理性（10分）- 线性拟合R²
                rationality: {
                    maxScore: 10,
                    rules: [
                        { min: 0.98, score: 10 },
                        { min: 0.95, max: 0.98, score: 8 },
                        { min: 0.90, max: 0.95, score: 6 },
                        { min: 0, max: 0.90, score: 3 }
                    ]
                }
            }
        },

        // 实验操作规范（20分）
        operationStandard: {
            maxScore: 20,
            criteria: {
                // 测量顺序（10分）
                sequence: {
                    maxScore: 10,
                    ordered: 10,      // 按环序号递增
                    unordered: 6      // 顺序混乱
                },
                // 数据记录（10分）
                recording: {
                    maxScore: 10,
                    complete: 10      // 数据格式正确，单位标注清晰
                }
            }
        },

        // 结果准确性（20分）
        accuracy: {
            maxScore: 20,
            criteria: {
                // 曲率半径误差（15分）
                radiusError: {
                    maxScore: 15,
                    rules: [
                        { max: 5, score: 15 },      // 误差<5%
                        { min: 5, max: 10, score: 10 },  // 5-10%
                        { min: 10, max: 20, score: 5 },  // 10-20%
                        { min: 20, score: 2 }       // >20%
                    ]
                },
                // 波长参数设置（5分）
                wavelength: {
                    maxScore: 5,
                    standard: 5,      // 使用标准波长（589nm）
                    nonStandard: 3    // 使用其他波长
                }
            }
        }
    },

    // 理论知识评分标准（满分30分）
    theoryScoring: {
        maxScore: 30,
        // 答题正确率（25分）
        correctness: {
            maxScore: 25,
            singleChoice: {
                scorePerQuestion: 5,  // 单选题每题5分
                totalQuestions: 3
            },
            multipleChoice: {
                scorePerQuestion: 10, // 多选题每题10分
                totalQuestions: 1,
                partialCredit: false  // 不给部分分
            }
        },
        // 答题完整性（5分）
        completeness: {
            maxScore: 5,
            allAnswered: 5,
            partialAnswered: 2
        }
    },

    // 报告开头语
    introduction: `亲爱的同学：

欢迎完成夫琅禾费单缝衍射虚拟仿真实验！本报告综合评估了你的实验操作能力和理论知识掌握情况。

单缝衍射实验是光学波动性的经典验证实验，通过测量暗纹位置与条纹间距，可以反推缝宽并理解波长、孔径与衍射展宽的关系。这份看似基础的实验，蕴含着严谨的科学态度和精密的测量技术，正是这些基础研究支撑着LAMOST等大国重器的发展。

让我们一起回顾你的实验表现：`,

    // 分段评语
    evaluations: {
        excellent: {  // 90-100分
            level: '优秀',
            comment: `你的表现非常出色！实验操作规范严谨，暗纹数据采集完整准确，理论知识掌握扎实。你展现出了优秀的科学素养和实验能力，这种严谨求实的态度正是科研工作者的宝贵品质。

正如LAMOST望远镜依靠对衍射极限的深入理解实现巡天观测，你在实验中展现的精准和细致，正是科技报国的第一步。继续保持这份对科学的热爱和严谨，未来你一定能在科研道路上走得更远！`,
            suggestions: `继续深入学习夫琅禾费衍射的理论知识，尝试探索更多应用场景，如光学分辨率极限、圆孔艾里斑与单缝图样的比较等。建议阅读相关文献，了解衍射技术在现代光学仪器中的前沿应用。`
        },
        good: {  // 80-89分
            level: '良好',
            comment: `你的实验完成得很好！暗纹数据采集较为完整，操作基本规范，理论知识掌握良好。在实验过程中展现出了认真负责的态度，这是科学研究的重要基础。

对衍射极限的深刻理解守护着LAMOST的巡天精度，你在实验中的每一次认真测量，都是在培养科学素养。继续保持这份认真，在细节上更加精益求精，你会取得更大的进步！`,
            suggestions: `建议在数据采集时更加细致，注意测量的系统性和完整性。加强对夫琅禾费衍射原理的理解，思考实验误差的来源和改进方法。多做几次实验，提高操作的熟练度。`
        },
        medium: {  // 70-79分
            level: '中等',
            comment: `你基本完成了实验任务，掌握了单缝衍射实验的基本方法。但在暗纹数据采集的完整性和操作规范性上还有提升空间，理论知识的掌握也需要加强。

科学研究需要严谨的态度和扎实的基础。就像LAMOST需要理解衍射效应对成像分辨率的影响，我们做实验也要追求准确和完整。相信通过努力，你一定能够提高实验能力！`,
            suggestions: `重点关注：1）增加测量点数量，确保数据的完整性；2）按顺序进行测量，养成良好的实验习惯；3）加强理论学习，理解干涉原理和测量方法；4）认真复习课程思政内容，理解科学精神的重要性。`
        },
        pass: {  // 60-69分
            level: '及格',
            comment: `你完成了基本的实验操作，但在数据质量、操作规范和理论知识方面都需要明显改进。实验不仅是完成任务，更重要的是培养科学思维和严谨态度。

基础学科是大国重器的根基，认真做好每一次实验，就是科技报国的第一步。希望你能够重视实验过程，提高对科学研究的认识，在今后的学习中更加努力！`,
            suggestions: `强烈建议：1）重新学习实验原理，理解测量方法的科学依据；2）增加测量数据量，至少采集8个以上的测量点；3）认真复习理论知识，完成所有思政题目；4）重做实验，体会精密测量的重要性。建议寻求老师或同学的帮助。`
        },
        fail: {  // <60分
            level: '不及格',
            comment: `你的实验完成情况不理想，在数据采集、操作规范和理论知识方面都存在较大问题。这说明你对实验的重视程度不够，或者对实验方法理解不足。

科学研究来不得半点马虎。LAMOST能够实现纳米级精度，靠的就是科研人员的严谨和坚持。希望你能够认识到问题的严重性，端正学习态度，重新完成实验。`,
            suggestions: `必须改进：1）认真学习实验原理和操作方法，理解单缝衍射的物理本质；2）重新进行实验，确保采集足够的暗纹数据；3）系统学习理论知识，完成所有思政题目并理解其含义；4）主动寻求老师指导，找出问题所在。建议重修本实验。`
        }
    },

    // 根据分数获取评价等级
    getEvaluationLevel(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'medium';
        if (score >= 60) return 'pass';
        return 'fail';
    }
};

// 导出配置（用于模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportConfig;
}
