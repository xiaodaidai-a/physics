// 综合评分报告生成模块 - PDF版本
// 整合实验数据和答题结果，直接生成PDF报告

// 下载PDF报告
function downloadComprehensiveReport() {
    // 获取数据并生成报告
    const reportData = prepareReportData();
    if (!reportData) return;

    const { studentName, studentId, experimentData, quizResults, scoreResult } = reportData;

    // 生成报告HTML
    const reportHTML = generateSimpleReportHTML(studentName, studentId, experimentData, quizResults, scoreResult);

    // 转换为PDF并下载
    convertToPDF(reportHTML, studentName, studentId);
}

// 预览报告
function previewComprehensiveReport() {
    // 获取数据并生成报告
    const reportData = prepareReportData();
    if (!reportData) return;

    const { studentName, studentId, experimentData, quizResults, scoreResult } = reportData;

    // 生成报告HTML
    const reportHTML = generateSimpleReportHTML(studentName, studentId, experimentData, quizResults, scoreResult);

    // 在新窗口预览
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>报告预览</title>
</head>
<body style="margin: 0; padding: 20px; background: #f5f5f5;">
    ${reportHTML}
</body>
</html>
    `);
    previewWindow.document.close();
}

// 准备报告数据
function prepareReportData() {
    // 获取用户信息
    const studentName = document.getElementById('student-name')?.value || '未填写';
    const studentId = document.getElementById('student-id')?.value || '未填写';

    // 从 sessionStorage 读取数据
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

    // 检查数据完整性
    if (!experimentData && !quizResults) {
        alert('未找到实验数据和答题结果！\n\n请先完成以下步骤：\n1. 在"仿真实验"页面完成测量\n2. 在"课程思政"页面完成答题\n\n然后再生成报告。');
        return null;
    }

    // 计算综合评分
    const calculator = new ScoreCalculator(ReportConfig);
    const scoreResult = calculator.calculateTotalScore(experimentData, quizResults);

    return { studentName, studentId, experimentData, quizResults, scoreResult };
}

// 生成简化的报告HTML（内联样式，适合PDF转换）
function generateSimpleReportHTML(studentName, studentId, experimentData, quizResults, scoreResult) {
    const currentDate = new Date().toLocaleDateString('zh-CN');
    const evaluation = scoreResult.evaluation;

    let html = `
<div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; font-family: SimSun, 'Microsoft YaHei', Arial, sans-serif; line-height: 1.8; color: #333;">

    <!-- 标题 -->
    <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="font-size: 24px; margin: 0 0 8px 0;">牛顿环曲率测量虚拟仿真实验</h1>
        <div style="font-size: 16px; color: #666;">综合评分报告</div>
    </div>

    <!-- 学生信息 -->
    <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
        <tr>
            <td style="padding: 8px; background: #f5f5f5;"><strong>姓名：</strong>${studentName}</td>
            <td style="padding: 8px; background: #f5f5f5;"><strong>学号：</strong>${studentId}</td>
            <td style="padding: 8px; background: #f5f5f5;"><strong>日期：</strong>${currentDate}</td>
        </tr>
    </table>

    <!-- 综合评分 -->
    <div style="text-align: center; background: #4a90e2; color: white; padding: 25px; margin-bottom: 25px; border-radius: 8px;">
        <div style="font-size: 16px; margin-bottom: 8px;">综合评分</div>
        <div style="font-size: 42px; font-weight: bold; margin: 8px 0;">${scoreResult.totalScore.toFixed(1)}</div>
        <div style="font-size: 20px;">评价等级：${evaluation.level}</div>
    </div>

    <!-- 分数明细 -->
    <table style="width: 100%; margin-bottom: 25px; border-collapse: collapse;">
        <tr>
            <td style="width: 50%; padding: 15px; background: #f8f9fa; text-align: center; border: 1px solid #ddd;">
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">实验操作得分</div>
                <div style="font-size: 28px; font-weight: bold; color: #4a90e2;">${scoreResult.experimentScore.total.toFixed(1)}</div>
                <div style="font-size: 12px; color: #999;">/ 70分</div>
            </td>
            <td style="width: 50%; padding: 15px; background: #f8f9fa; text-align: center; border: 1px solid #ddd;">
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">理论知识得分</div>
                <div style="font-size: 28px; font-weight: bold; color: #4a90e2;">${scoreResult.theoryScore.total.toFixed(1)}</div>
                <div style="font-size: 12px; color: #999;">/ 30分</div>
            </td>
        </tr>
    </table>
`;

    // 实验操作评分详情
    if (experimentData && experimentData.measurements && experimentData.measurements.length > 0) {
        html += `
    <h2 style="font-size: 18px; border-left: 4px solid #4a90e2; padding-left: 10px; margin: 25px 0 15px 0;">一、实验操作评分详情</h2>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
            <tr style="background: #4a90e2; color: white;">
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">评分项目</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 80px;">得分</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 80px;">满分</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">详情</th>
            </tr>
        </thead>
        <tbody>
`;
        scoreResult.experimentScore.breakdown.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 8px; border: 1px solid #ddd;">${item.item}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;"><strong>${item.score}</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.maxScore}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.detail}</td>
            </tr>
`;
        });
        html += `
        </tbody>
    </table>

    <h3 style="font-size: 16px; margin: 20px 0 10px 0;">实验测量数据</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <thead>
            <tr style="background: #4a90e2; color: white;">
                <th style="padding: 8px; border: 1px solid #ddd;">序号</th>
                <th style="padding: 8px; border: 1px solid #ddd;">环序号m</th>
                <th style="padding: 8px; border: 1px solid #ddd;">环类型</th>
                <th style="padding: 8px; border: 1px solid #ddd;">直径D(mm)</th>
                <th style="padding: 8px; border: 1px solid #ddd;">直径平方D²(mm²)</th>
            </tr>
        </thead>
        <tbody>
`;
        experimentData.measurements.forEach((m, index) => {
            const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${m.m}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${m.type === 'dark' ? '暗环' : '亮环'}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${m.diameter.toFixed(3)}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${m.diameterSquared.toFixed(3)}</td>
            </tr>
`;
        });
        html += `
        </tbody>
    </table>
    <p style="font-size: 12px; color: #666; margin-top: 10px;">
        <strong>实验参数：</strong>曲率半径 R = ${experimentData.parameters.radius} mm，波长 λ = ${experimentData.parameters.wavelength} nm
    </p>
`;
    }

    // 理论知识评分详情
    if (quizResults && quizResults.results && quizResults.results.length > 0) {
        html += `
    <h2 style="font-size: 18px; border-left: 4px solid #4a90e2; padding-left: 10px; margin: 25px 0 15px 0;">二、理论知识评分详情</h2>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
            <tr style="background: #4a90e2; color: white;">
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">评分项目</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 80px;">得分</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 80px;">满分</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">详情</th>
            </tr>
        </thead>
        <tbody>
`;
        scoreResult.theoryScore.breakdown.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 8px; border: 1px solid #ddd;">${item.item}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;"><strong>${item.score}</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.maxScore}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.detail}</td>
            </tr>
`;
        });
        html += `
        </tbody>
    </table>

    <h3 style="font-size: 16px; margin: 20px 0 10px 0;">答题详情</h3>
`;
        quizResults.results.forEach(result => {
            const statusIcon = result.isCorrect ? '✓' : '✗';
            const statusColor = result.isCorrect ? '#27ae60' : '#e74c3c';
            html += `
    <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-left: 3px solid ${statusColor}; font-size: 13px;">
        <p style="margin: 0 0 6px 0;"><strong style="color: ${statusColor};">${statusIcon} 第${result.number}题（${result.type}）</strong></p>
        <p style="margin: 4px 0;"><strong>题目：</strong>${result.question}</p>
        <p style="margin: 4px 0;"><strong>你的答案：</strong>${result.userAnswer}</p>
        <p style="margin: 4px 0;"><strong>正确答案：</strong>${result.correctAnswer}</p>
        <p style="margin: 4px 0; color: #666;"><strong>解析：</strong>${result.explanation}</p>
    </div>
`;
        });
    }

    // 综合评价
    html += `
    <h2 style="font-size: 18px; border-left: 4px solid #4a90e2; padding-left: 10px; margin: 25px 0 15px 0;">三、综合评价</h2>

    <div style="background: #fff3cd; padding: 15px; border-left: 3px solid #ffc107; margin-bottom: 15px; font-size: 13px;">
        <p style="margin: 0 0 10px 0;"><strong>【实验评价】${evaluation.level}</strong></p>
        <p style="margin: 0; white-space: pre-line;">${evaluation.comment}</p>
    </div>

    <div style="background: #d1ecf1; padding: 15px; border-left: 3px solid #17a2b8; font-size: 13px;">
        <p style="margin: 0 0 10px 0;"><strong>【改进建议】</strong></p>
        <p style="margin: 0; white-space: pre-line;">${evaluation.suggestions}</p>
    </div>

    <!-- 页脚 -->
    <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
        <p style="margin: 5px 0;">牛顿环曲率测量虚拟仿真实验平台</p>
        <p style="margin: 5px 0;">报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
</div>
`;

    return html;
}

// 转换为PDF并下载
function convertToPDF(htmlContent, studentName, studentId) {
    const currentDate = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    const filename = `牛顿环实验综合评分报告_${studentName}_${studentId}_${currentDate}.pdf`;

    // 创建临时容器
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    document.body.appendChild(tempDiv);

    // 显示加载提示
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); color: white; padding: 20px 40px; border-radius: 8px; z-index: 10000; font-size: 16px; font-family: "Microsoft YaHei", Arial;';
    loadingMsg.textContent = '正在生成PDF报告，请稍候...';
    document.body.appendChild(loadingMsg);

    // PDF配置
    const opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // 生成PDF
    html2pdf().set(opt).from(tempDiv).save().then(() => {
        console.log('PDF报告已下载');
        document.body.removeChild(tempDiv);
        document.body.removeChild(loadingMsg);
    }).catch(error => {
        console.error('生成PDF失败:', error);
        alert('生成PDF失败，请重试或联系管理员');
        document.body.removeChild(tempDiv);
        document.body.removeChild(loadingMsg);
    });
}
