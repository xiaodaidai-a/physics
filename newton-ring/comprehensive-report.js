// 综合评分报告生成模块
// 整合实验数据和答题结果，生成完整的评分报告

function generateComprehensiveReport() {
    // 1. 获取用户信息
    const studentName = document.getElementById('student-name')?.value || '未填写';
    const studentId = document.getElementById('student-id')?.value || '未填写';

    // 2. 从 sessionStorage 读取数据
    let experimentData = null;
    let quizResults = null;

    try {
        const experimentDataJSON = sessionStorage.getItem('experimentData');
        if (experimentDataJSON) {
            experimentData = JSON.parse(experimentDataJSON);
        }
    } catch (error) {
        console.error('读取实验数据失败:', error);
    }

    try {
        const quizResultsJSON = sessionStorage.getItem('quizResults');
        if (quizResultsJSON) {
            quizResults = JSON.parse(quizResultsJSON);
        }
    } catch (error) {
        console.error('读取答题结果失败:', error);
    }

    // 3. 检查数据完整性
    if (!experimentData && !quizResults) {
        alert('未找到实验数据和答题结果，请先完成实验和答题！');
        return null;
    }

    // 4. 计算综合评分
    const calculator = new ScoreCalculator(ReportConfig);
    const scoreResult = calculator.calculateTotalScore(experimentData, quizResults);

    // 5. 生成报告HTML
    const reportHTML = generateReportHTML(studentName, studentId, experimentData, quizResults, scoreResult);

    return reportHTML;
}

// 生成报告内容（仅内容部分，用于嵌入页面或生成PDF）
function generateReportContent(studentName, studentId, experimentData, quizResults, scoreResult) {
    const currentDate = new Date().toLocaleDateString('zh-CN');
    const evaluation = scoreResult.evaluation;

    let html = `
<div class="report-container" style="max-width: 900px; margin: 0 auto; background: white; padding: 40px; font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.8; color: #333;">
    <!-- 报告头部 -->
    <div style="text-align: center; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="font-size: 28px; color: #2c3e50; margin-bottom: 10px;">牛顿环曲率测量虚拟仿真实验</h1>
        <div style="font-size: 16px; color: #7f8c8d;">综合评分报告</div>
    </div>

    <!-- 学生信息 -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; padding: 15px; background: #ecf0f1; border-radius: 5px;">
        <div style="font-size: 14px;"><strong style="color: #2c3e50;">姓名：</strong>${studentName}</div>
        <div style="font-size: 14px;"><strong style="color: #2c3e50;">学号：</strong>${studentId}</div>
        <div style="font-size: 14px;"><strong style="color: #2c3e50;">日期：</strong>${currentDate}</div>
    </div>

    <!-- 开头语 -->
    <div style="background: #e8f4f8; padding: 20px; border-radius: 5px; border-left: 4px solid #3498db; margin-bottom: 30px; white-space: pre-line;">
${ReportConfig.introduction}
    </div>

    <!-- 综合评分 -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
        <div>综合评分</div>
        <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">${scoreResult.totalScore.toFixed(1)}</div>
        <div style="font-size: 24px; margin-top: 10px;">评价等级：${evaluation.level}</div>
    </div>

    <!-- 分数分解 -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
            <h3 style="font-size: 16px; color: #2c3e50; margin-bottom: 10px;">实验操作得分</h3>
            <div style="font-size: 32px; font-weight: bold; color: #3498db;">${scoreResult.experimentScore.total.toFixed(1)}</div>
            <div style="font-size: 16px; color: #7f8c8d;">/ 70分</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
            <h3 style="font-size: 16px; color: #2c3e50; margin-bottom: 10px;">理论知识得分</h3>
            <div style="font-size: 32px; font-weight: bold; color: #3498db;">${scoreResult.theoryScore.total.toFixed(1)}</div>
            <div style="font-size: 16px; color: #7f8c8d;">/ 30分</div>
        </div>
    </div>
`;

    // 实验操作详细评分
    if (experimentData && experimentData.measurements) {
        html += `
    <!-- 实验操作详细评分 -->
    <div style="margin-bottom: 30px;">
        <h2 style="font-size: 20px; color: #2c3e50; border-left: 4px solid #3498db; padding-left: 10px; margin-bottom: 15px;">一、实验操作评分详情</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">评分项目</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">得分</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">满分</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">详情</th>
                </tr>
            </thead>
            <tbody>
`;

        scoreResult.experimentScore.breakdown.forEach(item => {
            html += `
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.item}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;"><strong>${item.score}</strong></td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.maxScore}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.detail}</td>
                </tr>
`;
        });

        html += `
            </tbody>
        </table>

        <h3 style="margin-top: 30px; margin-bottom: 15px; color: #2c3e50;">实验测量数据</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <thead>
                <tr>
                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd; background: #3498db; color: white;">序号</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd; background: #3498db; color: white;">环序号 m</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd; background: #3498db; color: white;">环类型</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd; background: #3498db; color: white;">直径 D (mm)</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #ddd; background: #3498db; color: white;">直径平方 D² (mm²)</th>
                </tr>
            </thead>
            <tbody>
`;

        experimentData.measurements.forEach((m, index) => {
            const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            html += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${index + 1}</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${m.m}</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${m.type === 'dark' ? '暗环' : '亮环'}</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${m.diameter.toFixed(3)}</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${m.diameterSquared.toFixed(3)}</td>
                </tr>
`;
        });

        html += `
            </tbody>
        </table>

        <p style="margin-top: 15px; color: #7f8c8d;">
            <strong>实验参数：</strong>
            曲率半径 R = ${experimentData.parameters.radius} mm，
            波长 λ = ${experimentData.parameters.wavelength} nm
        </p>
    </div>
`;
    }

    // 理论知识详细评分
    if (quizResults && quizResults.results) {
        html += `
    <!-- 理论知识详细评分 -->
    <div style="margin-bottom: 30px;">
        <h2 style="font-size: 20px; color: #2c3e50; border-left: 4px solid #3498db; padding-left: 10px; margin-bottom: 15px;">二、理论知识评分详情</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">评分项目</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">得分</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">满分</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; background: #34495e; color: white;">详情</th>
                </tr>
            </thead>
            <tbody>
`;

        scoreResult.theoryScore.breakdown.forEach(item => {
            html += `
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.item}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;"><strong>${item.score}</strong></td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.maxScore}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${item.detail}</td>
                </tr>
`;
        });

        html += `
            </tbody>
        </table>

        <h3 style="margin-top: 30px; margin-bottom: 15px; color: #2c3e50;">答题详情</h3>
`;

        quizResults.results.forEach(result => {
            const statusIcon = result.isCorrect ? '✓' : '✗';
            const statusColor = result.isCorrect ? '#27ae60' : '#e74c3c';
            html += `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${statusColor};">
            <p style="margin-bottom: 10px;">
                <strong style="color: ${statusColor};">${statusIcon} 第${result.number}题（${result.type}）</strong>
            </p>
            <p style="margin-bottom: 8px;"><strong>题目：</strong>${result.question}</p>
            <p style="margin-bottom: 8px;"><strong>你的答案：</strong>${result.userAnswer}</p>
            <p style="margin-bottom: 8px;"><strong>正确答案：</strong>${result.correctAnswer}</p>
            <p style="color: #7f8c8d;"><strong>解析：</strong>${result.explanation}</p>
        </div>
`;
        });

        html += `
    </div>
`;
    }

    // 综合评价
    html += `
    <!-- 综合评价 -->
    <div style="margin-bottom: 30px;">
        <h2 style="font-size: 20px; color: #2c3e50; border-left: 4px solid #3498db; padding-left: 10px; margin-bottom: 15px;">三、综合评价</h2>

        <div style="background: #fff3cd; padding: 20px; border-radius: 5px; border-left: 4px solid #ffc107; margin-bottom: 20px; white-space: pre-line;">
            <strong>【实验评价】${evaluation.level}</strong>

${evaluation.comment}
        </div>

        <div style="background: #d1ecf1; padding: 20px; border-radius: 5px; border-left: 4px solid #17a2b8; white-space: pre-line;">
            <strong>【改进建议】</strong>

${evaluation.suggestions}
        </div>
    </div>

    <!-- 页脚 -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #ecf0f1; color: #7f8c8d; font-size: 14px;">
        <p>牛顿环曲率测量虚拟仿真实验平台</p>
        <p>报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
</div>
`;

    return html;
}

function generateComprehensiveReport() {
    const currentDate = new Date().toLocaleDateString('zh-CN');
    const evaluation = scoreResult.evaluation;

    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>牛顿环实验综合评分报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .report-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .report-header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .report-header h1 {
            font-size: 28px;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .report-header .subtitle {
            font-size: 16px;
            color: #7f8c8d;
        }

        .student-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 5px;
        }

        .student-info div {
            font-size: 14px;
        }

        .student-info strong {
            color: #2c3e50;
        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 20px;
            color: #2c3e50;
            border-left: 4px solid #3498db;
            padding-left: 10px;
            margin-bottom: 15px;
        }

        .introduction {
            background: #e8f4f8;
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid #3498db;
            margin-bottom: 30px;
            white-space: pre-line;
        }

        .score-summary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }

        .score-summary .total-score {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
        }

        .score-summary .level {
            font-size: 24px;
            margin-top: 10px;
        }

        .score-breakdown {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .score-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }

        .score-card h3 {
            font-size: 16px;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .score-card .score {
            font-size: 32px;
            font-weight: bold;
            color: #3498db;
        }

        .score-card .max-score {
            font-size: 16px;
            color: #7f8c8d;
        }

        .detail-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .detail-table th,
        .detail-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }

        .detail-table th {
            background: #34495e;
            color: white;
            font-weight: normal;
        }

        .detail-table tr:hover {
            background: #f8f9fa;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .data-table th,
        .data-table td {
            padding: 10px;
            text-align: center;
            border: 1px solid #ddd;
        }

        .data-table th {
            background: #3498db;
            color: white;
        }

        .data-table tr:nth-child(even) {
            background: #f8f9fa;
        }

        .evaluation {
            background: #fff3cd;
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin-bottom: 20px;
            white-space: pre-line;
        }

        .suggestions {
            background: #d1ecf1;
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid #17a2b8;
            white-space: pre-line;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ecf0f1;
            color: #7f8c8d;
            font-size: 14px;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .report-container {
                box-shadow: none;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- 报告头部 -->
        <div class="report-header">
            <h1>牛顿环曲率测量虚拟仿真实验</h1>
            <div class="subtitle">综合评分报告</div>
        </div>

        <!-- 学生信息 -->
        <div class="student-info">
            <div><strong>姓名：</strong>${studentName}</div>
            <div><strong>学号：</strong>${studentId}</div>
            <div><strong>日期：</strong>${currentDate}</div>
        </div>

        <!-- 开头语 -->
        <div class="introduction">
${ReportConfig.introduction}
        </div>

        <!-- 综合评分 -->
        <div class="score-summary">
            <div>综合评分</div>
            <div class="total-score">${scoreResult.totalScore.toFixed(1)}</div>
            <div class="level">评价等级：${evaluation.level}</div>
        </div>

        <!-- 分数分解 -->
        <div class="score-breakdown">
            <div class="score-card">
                <h3>实验操作得分</h3>
                <div class="score">${scoreResult.experimentScore.total.toFixed(1)}</div>
                <div class="max-score">/ 70分</div>
            </div>
            <div class="score-card">
                <h3>理论知识得分</h3>
                <div class="score">${scoreResult.theoryScore.total.toFixed(1)}</div>
                <div class="max-score">/ 30分</div>
            </div>
        </div>
`;

    // 实验操作详细评分
    if (experimentData && experimentData.measurements) {
        html += `
        <!-- 实验操作详细评分 -->
        <div class="section">
            <h2 class="section-title">一、实验操作评分详情</h2>

            <table class="detail-table">
                <thead>
                    <tr>
                        <th>评分项目</th>
                        <th>得分</th>
                        <th>满分</th>
                        <th>详情</th>
                    </tr>
                </thead>
                <tbody>
`;

        scoreResult.experimentScore.breakdown.forEach(item => {
            html += `
                    <tr>
                        <td>${item.item}</td>
                        <td><strong>${item.score}</strong></td>
                        <td>${item.maxScore}</td>
                        <td>${item.detail}</td>
                    </tr>
`;
        });

        html += `
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #2c3e50;">实验测量数据</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>环序号 m</th>
                        <th>环类型</th>
                        <th>直径 D (mm)</th>
                        <th>直径平方 D² (mm²)</th>
                    </tr>
                </thead>
                <tbody>
`;

        experimentData.measurements.forEach((m, index) => {
            html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${m.m}</td>
                        <td>${m.type === 'dark' ? '暗环' : '亮环'}</td>
                        <td>${m.diameter.toFixed(3)}</td>
                        <td>${m.diameterSquared.toFixed(3)}</td>
                    </tr>
`;
        });

        html += `
                </tbody>
            </table>

            <p style="margin-top: 15px; color: #7f8c8d;">
                <strong>实验参数：</strong>
                曲率半径 R = ${experimentData.parameters.radius} mm，
                波长 λ = ${experimentData.parameters.wavelength} nm
            </p>
        </div>
`;
    }

    // 理论知识详细评分
    if (quizResults && quizResults.results) {
        html += `
        <!-- 理论知识详细评分 -->
        <div class="section">
            <h2 class="section-title">二、理论知识评分详情</h2>

            <table class="detail-table">
                <thead>
                    <tr>
                        <th>评分项目</th>
                        <th>得分</th>
                        <th>满分</th>
                        <th>详情</th>
                    </tr>
                </thead>
                <tbody>
`;

        scoreResult.theoryScore.breakdown.forEach(item => {
            html += `
                    <tr>
                        <td>${item.item}</td>
                        <td><strong>${item.score}</strong></td>
                        <td>${item.maxScore}</td>
                        <td>${item.detail}</td>
                    </tr>
`;
        });

        html += `
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #2c3e50;">答题详情</h3>
`;

        quizResults.results.forEach(result => {
            const statusIcon = result.isCorrect ? '✓' : '✗';
            const statusColor = result.isCorrect ? '#27ae60' : '#e74c3c';
            html += `
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${statusColor};">
                <p style="margin-bottom: 10px;">
                    <strong style="color: ${statusColor};">${statusIcon} 第${result.number}题（${result.type}）</strong>
                </p>
                <p style="margin-bottom: 8px;"><strong>题目：</strong>${result.question}</p>
                <p style="margin-bottom: 8px;"><strong>你的答案：</strong>${result.userAnswer}</p>
                <p style="margin-bottom: 8px;"><strong>正确答案：</strong>${result.correctAnswer}</p>
                <p style="color: #7f8c8d;"><strong>解析：</strong>${result.explanation}</p>
            </div>
`;
        });

        html += `
        </div>
`;
    }

    // 综合评价
    html += `
        <!-- 综合评价 -->
        <div class="section">
            <h2 class="section-title">三、综合评价</h2>

            <div class="evaluation">
                <strong>【实验评价】${evaluation.level}</strong>

${evaluation.comment}
            </div>

            <div class="suggestions">
                <strong>【改进建议】</strong>

${evaluation.suggestions}
            </div>
        </div>

        <!-- 页脚 -->
        <div class="footer">
            <p>牛顿环曲率测量虚拟仿真实验平台</p>
            <p>报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>
`;

    return html;
}

// 下载综合评分报告（PDF格式）
function downloadComprehensiveReport() {
    const reportHTML = generateComprehensiveReport();

    if (!reportHTML) {
        return;
    }

    const studentName = document.getElementById('student-name')?.value || '未填写';
    const studentId = document.getElementById('student-id')?.value || '未填写';
    const currentDate = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');

    const filename = `牛顿环实验综合评分报告_${studentName}_${studentId}_${currentDate}.pdf`;

    // 创建一个临时容器来渲染HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportHTML;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    // 获取报告容器
    const reportContainer = tempDiv.querySelector('.report-container');

    if (!reportContainer) {
        console.error('未找到报告容器');
        document.body.removeChild(tempDiv);
        return;
    }

    // 配置PDF选项
    const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    // 显示加载提示
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 8px; z-index: 10000; font-size: 16px;';
    loadingMsg.textContent = '正在生成PDF报告，请稍候...';
    document.body.appendChild(loadingMsg);

    // 生成PDF
    html2pdf().set(opt).from(reportContainer).save().then(() => {
        console.log('PDF报告已下载');
        document.body.removeChild(tempDiv);
        document.body.removeChild(loadingMsg);
    }).catch(error => {
        console.error('生成PDF失败:', error);
        alert('生成PDF失败，请重试');
        document.body.removeChild(tempDiv);
        document.body.removeChild(loadingMsg);
    });
}

// 预览综合评分报告
function previewComprehensiveReport() {
    const reportHTML = generateComprehensiveReport();

    if (!reportHTML) {
        return;
    }

    // 在新窗口中打开报告
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(reportHTML);
    previewWindow.document.close();
}
