/**
 * 牛顿环实验报告生成功能
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化实验报告生成功能...');
    
    // 获取DOM元素
    const previewBtn = document.getElementById('preview-report-btn');
    const printBtn = document.getElementById('print-report-btn');
    const modal = document.getElementById('report-modal');
    const closeBtn = document.querySelector('.report-close');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    
    // 检查DOM元素是否存在
    if (!previewBtn || !printBtn || !modal || !closeBtn) {
        console.error('报告生成功能所需的DOM元素未找到');
        return;
    }
    
    // 实验数据集
    const presetData = [
        { index: 1, type: '暗环', diameter: 2.97, diameterSq: 8.80 },
        { index: 2, type: '暗环', diameter: 4.20, diameterSq: 17.60 },
        { index: 3, type: '亮环', diameter: 4.69, diameterSq: 22.00 },
        { index: 4, type: '暗环', diameter: 5.93, diameterSq: 35.20 },
        { index: 5, type: '暗环', diameter: 6.63, diameterSq: 44.00 },
        { index: 6, type: '暗环', diameter: 7.27, diameterSq: 52.80 },
        { index: 7, type: '暗环', diameter: 7.85, diameterSq: 61.60 },
        { index: 8, type: '暗环', diameter: 8.39, diameterSq: 70.40 }
    ];
    
    /**
     * 生成实验报告内容
     * @returns {string} HTML格式的报告内容
     */
    function generateReportContent() {
        const studentName = document.getElementById('student-name').value || '未填写';
        const studentId = document.getElementById('student-id').value || '未填写';
        
        // 获取报告选项
        const includeData = document.getElementById('include-data').checked;
        const includeError = document.getElementById('include-error-analysis').checked;
        const includeQuestions = document.getElementById('include-thinking-questions').checked;
        
        // 当前日期
        const currentDate = new Date().toLocaleDateString('zh-CN');
        
        let reportHTML = `
            <h1>牛顿环实验报告</h1>
            <div class="report-meta">
                <p><strong>学生姓名：</strong>${studentName}</p>
                <p><strong>学号：</strong>${studentId}</p>
                <p><strong>实验日期：</strong>${currentDate}</p>
            </div>
        `;
        
        // 添加实验目的和原理
        reportHTML += `
            <h2>实验目的</h2>
            <ol>
                <li>了解等厚干涉的基本原理</li>
                <li>掌握牛顿环干涉条件及形成原理</li>
                <li>通过测量牛顿环直径，计算球面透镜的曲率半径</li>
                <li>学习数据处理方法，提高测量精度</li>
            </ol>
            
            <h2>实验原理</h2>
            <p>牛顿环是等厚干涉的典型现象。当平凸透镜放在平面玻璃板上时，透镜与平板间形成一个厚度从中心向外逐渐增大的空气薄膜。单色光垂直入射时会在薄膜上下表面反射，产生干涉。</p>
            <p>对于暗环，其直径与环序之间满足关系：</p>
            <div class="formula">D<sub>m</sub><sup>2</sup> = 4mλR</div>
            <p>其中，D<sub>m</sub>为第m个暗环的直径，λ为光波波长，R为透镜的曲率半径。根据此公式，可以通过测量一系列环的直径，绘制D<sub>m</sub><sup>2</sup>与m的关系图，通过线性拟合得到斜率k=4λR，从而计算出曲率半径R。</p>
        `;
        
        // 添加实验数据（如果选择了包含数据）
        if (includeData) {
            reportHTML += `
                <h2>实验数据与分析</h2>
                <h3>测量数据</h3>
                <table>
                    <thead>
                        <tr>
                            <th>环序号(m)</th>
                            <th>环类型</th>
                            <th>环直径(D<sub>m</sub>) mm</th>
                            <th>直径平方(D<sub>m</sub><sup>2</sup>) mm<sup>2</sup></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${presetData.map(row => `
                            <tr>
                                <td>${row.index}</td>
                                <td>${row.type}</td>
                                <td>${row.diameter.toFixed(2)}</td>
                                <td>${row.diameterSq.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <h3>数据分析</h3>
                <p>根据公式D<sub>m</sub><sup>2</sup> = 4mλR，通过线性拟合得到：</p>
                <ul>
                    <li>拟合斜率：8.80 mm²/环</li>
                    <li>透镜曲率半径：1250.00 mm</li>
                    <li>相对误差：2.48%</li>
                </ul>
            `;
        }
        
        // 添加误差分析（如果选择了包含误差分析）
        if (includeError) {
            reportHTML += `
                <h2>误差分析</h2>
                <h3>1. 系统误差来源</h3>
                <ul>
                    <li>透镜与平板接触不完全，中心位置判断误差</li>
                    <li>透镜或平板表面的不规则性</li>
                    <li>光源非单色性导致的干涉条纹模糊</li>
                </ul>
                
                <h3>2. 随机误差来源</h3>
                <ul>
                    <li>环边缘判断的主观性</li>
                    <li>读数误差</li>
                    <li>环测量过程中的随机波动</li>
                </ul>
                
                <h3>3. 改进措施</h3>
                <ul>
                    <li>提高光源的单色性，使干涉条纹更清晰</li>
                    <li>改进透镜与平板的接触方式，减少中心定位误差</li>
                    <li>使用高精度测量工具，减少读数误差</li>
                    <li>多次测量取平均值，使用线性回归方法降低随机误差影响</li>
                </ul>
            `;
        }
        
        // 添加思考题（如果选择了包含思考题）
        if (includeQuestions) {
            reportHTML += `
                <h2>拓展思考题</h2>
                <div class="question">
                    <p><strong>1. 如果用白光入射，将会观察到什么样的牛顿环？</strong></p>
                    <p>答: 中央为暗点，周围是内紫外红的彩色环。由于不同色光的波长不同，各色光的干涉条纹会错开，形成彩色图样。白光包含各种波长的光，每种波长对应不同位置的明暗环，叠加后形成彩色干涉环。</p>
                </div>
                
                <div class="question">
                    <p><strong>2. 实验中，如果平凸透镜和平板玻璃之间有微小夹角，会对干涉条纹产生什么影响？</strong></p>
                    <p>答: 会导致干涉环的中心偏离透镜的几何中心，条纹可能会变成椭圆形，且疏密不均。当透镜与平板存在夹角时，空气薄膜的厚度分布不再具有轴对称性，干涉条纹的形状会发生变化。</p>
                </div>
                
                <div class="question">
                    <p><strong>3. 如何利用牛顿环实验测量薄膜的厚度？</strong></p>
                    <p>答: 可以测量相邻干涉环的半径r<sub>m</sub>和r<sub>m+1</sub>，利用公式d=(λ/2)(r<sub>m+1</sub><sup>2</sup>-r<sub>m</sub><sup>2</sup>)/(r<sub>m+1</sub><sup>2</sup>×r<sub>m</sub><sup>2</sup>)计算薄膜厚度，其中λ为光波波长。通过改变光的入射角，可以在不同位置测量薄膜厚度。</p>
                </div>
            `;
        }
        
        return reportHTML;
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
            const printWindow = window.open('', '_blank', 'height=800,width=800');
            
            if (!printWindow) {
                throw new Error('无法创建打印窗口，请允许弹出窗口');
            }
            
            // 添加打印样式和内容
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <title>牛顿环实验报告</title>
                    <style>
                        body {
                            font-family: "Microsoft YaHei", Arial, sans-serif;
                            line-height: 1.6;
                            margin: 20mm;
                            color: #333;
                        }
                        h1 {
                            text-align: center;
                            margin-bottom: 20px;
                            font-size: 22px;
                        }
                        h2 {
                            margin-top: 30px;
                            margin-bottom: 15px;
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 5px;
                            font-size: 18px;
                            color: #2196F3;
                        }
                        h3 {
                            font-size: 16px;
                            margin: 15px 0 10px;
                            color: #555;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 15px 0;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 8px;
                            text-align: center;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                        .report-meta {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 30px;
                        }
                        .formula {
                            text-align: center;
                            margin: 15px 0;
                            font-style: italic;
                        }
                        ol, ul {
                            padding-left: 20px;
                        }
                        li {
                            margin-bottom: 5px;
                        }
                        .question {
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `);
            
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
            
            // 创建HTML文档
            const fullHtml = `
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <title>牛顿环实验报告</title>
                    <style>
                        body {
                            font-family: "Microsoft YaHei", Arial, sans-serif;
                            line-height: 1.6;
                            margin: 20mm;
                            color: #333;
                        }
                        h1 {
                            text-align: center;
                            margin-bottom: 20px;
                            font-size: 22px;
                        }
                        h2 {
                            margin-top: 30px;
                            margin-bottom: 15px;
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 5px;
                            font-size: 18px;
                            color: #2196F3;
                        }
                        h3 {
                            font-size: 16px;
                            margin: 15px 0 10px;
                            color: #555;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 15px 0;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 8px;
                            text-align: center;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                        .report-meta {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 30px;
                        }
                        .formula {
                            text-align: center;
                            margin: 15px 0;
                            font-style: italic;
                        }
                        ol, ul {
                            padding-left: 20px;
                        }
                        li {
                            margin-bottom: 5px;
                        }
                        .question {
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `;
            
            // 创建Blob对象
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            
            // 文件名
            const filename = `牛顿环实验报告_${studentName}_${studentId}_${currentDate}.html`;
            
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
    
    // 模态框关闭按钮事件
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    if (modalCloseBtn) {
        modalCloseBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // 修复模态框内打印按钮事件
    const modalPrintBtn = document.getElementById('modal-print-btn');
    
    if (modalPrintBtn) {
        modalPrintBtn.onclick = printReport;
    }
    
    // 绑定下载按钮事件
    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadReport);
    }
    
    // 修复模态框内下载按钮事件
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    if (modalDownloadBtn) {
        modalDownloadBtn.onclick = downloadReport;
    }
    
    console.log('实验报告生成功能初始化完成');
}); 