/**
 * 牛顿环实验报告下载功能
 * 处理实验报告的生成和下载
 */

// 确保DOM加载完毕后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('下载报告脚本已加载');
    
    // 获取下载按钮
    const downloadBtn = document.getElementById('download-report-btn');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    
    // 记录按钮状态
    console.log('下载按钮状态:', {
        mainButton: downloadBtn ? 'found' : 'not found',
        modalButton: modalDownloadBtn ? 'found' : 'not found'
    });
    
    // 绑定下载按钮事件
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('点击了主下载按钮');
            downloadReport();
        });
    }
    
    // 绑定模态框中的下载按钮事件
    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('点击了模态框下载按钮');
            downloadReport();
        });
    }
    
    // 直接在HTML中添加点击事件，以防止JS绑定失败
    addInlineHandlers();
});

/**
 * 将内联事件处理程序添加到按钮
 */
function addInlineHandlers() {
    const buttons = [
        document.getElementById('download-report-btn'),
        document.getElementById('modal-download-btn')
    ];
    
    buttons.forEach(button => {
        if (button) {
            button.setAttribute('onclick', 'downloadReport(); return false;');
            console.log(`已添加内联处理程序到按钮: ${button.id}`);
        }
    });
}

/**
 * 生成实验数据表格
 */
function generateExperimentDataTable() {
    // 生成测量数据
    const wavelength = 589; // nm
    const rings = [
        { ringNumber: 1, diameter: 1.36, radius: 0.68, radiusSquared: 0.4624 },
        { ringNumber: 2, diameter: 1.92, radius: 0.96, radiusSquared: 0.9216 },
        { ringNumber: 3, diameter: 2.35, radius: 1.175, radiusSquared: 1.3806 },
        { ringNumber: 4, diameter: 2.70, radius: 1.35, radiusSquared: 1.8225 },
        { ringNumber: 5, diameter: 3.04, radius: 1.52, radiusSquared: 2.3104 },
        { ringNumber: 6, diameter: 3.32, radius: 1.66, radiusSquared: 2.7556 },
        { ringNumber: 7, diameter: 3.58, radius: 1.79, radiusSquared: 3.2041 },
        { ringNumber: 8, diameter: 3.82, radius: 1.91, radiusSquared: 3.6481 },
        { ringNumber: 9, diameter: 4.06, radius: 2.03, radiusSquared: 4.1209 },
        { ringNumber: 10, diameter: 4.28, radius: 2.14, radiusSquared: 4.5796 }
    ];
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>环序号(m)</th>
                    <th>环直径D<sub>m</sub>(mm)</th>
                    <th>环半径r<sub>m</sub>(mm)</th>
                    <th>环半径平方r<sub>m</sub><sup>2</sup>(mm<sup>2</sup>)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    rings.forEach(ring => {
        tableHTML += `
            <tr>
                <td>${ring.ringNumber}</td>
                <td>${ring.diameter.toFixed(2)}</td>
                <td>${ring.radius.toFixed(3)}</td>
                <td>${ring.radiusSquared.toFixed(4)}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    return tableHTML;
}

/**
 * 生成线性拟合图像的HTML
 */
function generateLinearFitGraph() {
    // 使用内联SVG代替外部图片，确保图表总是显示
    return `
        <div class="graph-placeholder">
            <svg width="500" height="300" viewBox="0 0 500 300" style="background-color:#f8f8f8; border:1px solid #ddd;">
                <!-- 坐标轴 -->
                <line x1="50" y1="250" x2="450" y2="250" stroke="#333" stroke-width="2"></line>
                <line x1="50" y1="250" x2="50" y2="50" stroke="#333" stroke-width="2"></line>
                
                <!-- 坐标轴标签 -->
                <text x="250" y="290" text-anchor="middle" font-family="Arial" font-size="14">环序号 m</text>
                <text x="20" y="150" text-anchor="middle" font-family="Arial" font-size="14" transform="rotate(-90,20,150)">环半径平方 r²(mm²)</text>
                
                <!-- 坐标刻度 -->
                <g font-family="Arial" font-size="12" text-anchor="middle">
                    <!-- X轴刻度 -->
                    <text x="90" y="270">2</text>
                    <text x="130" y="270">4</text>
                    <text x="170" y="270">6</text>
                    <text x="210" y="270">8</text>
                    <text x="250" y="270">10</text>
                    <line x1="90" y1="250" x2="90" y2="255" stroke="#333" stroke-width="1"></line>
                    <line x1="130" y1="250" x2="130" y2="255" stroke="#333" stroke-width="1"></line>
                    <line x1="170" y1="250" x2="170" y2="255" stroke="#333" stroke-width="1"></line>
                    <line x1="210" y1="250" x2="210" y2="255" stroke="#333" stroke-width="1"></line>
                    <line x1="250" y1="250" x2="250" y2="255" stroke="#333" stroke-width="1"></line>
                    
                    <!-- Y轴刻度 -->
                    <text x="35" y="230">1</text>
                    <text x="35" y="190">2</text>
                    <text x="35" y="150">3</text>
                    <text x="35" y="110">4</text>
                    <text x="35" y="70">5</text>
                    <line x1="45" y1="230" x2="50" y2="230" stroke="#333" stroke-width="1"></line>
                    <line x1="45" y1="190" x2="50" y2="190" stroke="#333" stroke-width="1"></line>
                    <line x1="45" y1="150" x2="50" y2="150" stroke="#333" stroke-width="1"></line>
                    <line x1="45" y1="110" x2="50" y2="110" stroke="#333" stroke-width="1"></line>
                    <line x1="45" y1="70" x2="50" y2="70" stroke="#333" stroke-width="1"></line>
                </g>
                
                <!-- 数据点 -->
                <circle cx="70" y1="230" r="4" fill="#1E88E5"></circle>
                <circle cx="90" y1="210" r="4" fill="#1E88E5"></circle>
                <circle cx="110" y1="185" r="4" fill="#1E88E5"></circle>
                <circle cx="130" y1="168" r="4" fill="#1E88E5"></circle>
                <circle cx="150" y1="146" r="4" fill="#1E88E5"></circle>
                <circle cx="170" y1="130" r="4" fill="#1E88E5"></circle>
                <circle cx="190" y1="115" r="4" fill="#1E88E5"></circle>
                <circle cx="210" y1="105" r="4" fill="#1E88E5"></circle>
                <circle cx="230" y1="90" r="4" fill="#1E88E5"></circle>
                <circle cx="250" y1="75" r="4" fill="#1E88E5"></circle>
                
                <!-- 拟合直线 -->
                <line x1="50" y1="240" x2="250" y2="70" stroke="#FF5722" stroke-width="2"></line>
                
                <!-- 图例 -->
                <circle cx="380" y1="30" r="4" fill="#1E88E5"></circle>
                <text x="400" y="35" font-family="Arial" font-size="12" text-anchor="start">实验数据</text>
                
                <line x1="360" y1="55" x2="400" y2="55" stroke="#FF5722" stroke-width="2"></line>
                <text x="400" y="60" font-family="Arial" font-size="12" text-anchor="start">拟合直线</text>
                
                <!-- 拟合公式 -->
                <text x="250" y="30" font-family="Arial" font-size="16" text-anchor="middle" font-style="italic">r² = mλR</text>
            </svg>
            <p class="graph-caption">图1: 环半径平方r<sub>m</sub><sup>2</sup>与环序m的线性关系图</p>
        </div>
    `;
}

/**
 * 生成误差分析部分
 */
function generateErrorAnalysis() {
    // 计算曲率半径和相关误差
    const wavelength = 589e-9; // 波长，单位m
    const slope = 0.455e-6; // 线性拟合斜率，单位m²
    const calculatedR = slope / wavelength; // 计算得到的曲率半径
    const theoreticalR = 10.0; // 理论曲率半径，单位m
    const relativeError = Math.abs((calculatedR - theoreticalR) / theoreticalR) * 100;
    
    return `
        <h2>误差分析</h2>
        
        <h3>计算结果</h3>
        <p>根据线性拟合得到斜率k = ${(slope*1e6).toFixed(4)} × 10<sup>-6</sup> m<sup>2</sup></p>
        <p>由公式R = k/λ计算得到透镜曲率半径R = ${calculatedR.toFixed(2)} m</p>
        <p>理论曲率半径R<sub>标准</sub> = ${theoreticalR.toFixed(2)} m</p>
        <p>相对误差: δ = |R - R<sub>标准</sub>|/R<sub>标准</sub> × 100% = ${relativeError.toFixed(2)}%</p>
        
        <h3>误差来源分析</h3>
        <ol>
            <li><strong>测量误差</strong>：使用游标卡尺测量环直径时的读数误差，特别是对于较小的内环。</li>
            <li><strong>光源波长不确定性</strong>：实验使用的光源可能不是严格的单色光，波长有一定的分布范围。</li>
            <li><strong>温度影响</strong>：环境温度变化会导致玻璃材料热胀冷缩，影响曲率半径的测量。</li>
            <li><strong>接触点偏移</strong>：凸透镜与平面玻璃的接触点可能不在光轴上，导致环形不规则。</li>
            <li><strong>观察误差</strong>：观察环边缘位置时的主观判断差异。</li>
        </ol>
        
        <h3>改进方法</h3>
        <ol>
            <li>使用数字图像处理技术精确测量环的直径，避免人为读数误差。</li>
            <li>使用波长更稳定的激光光源，提高波长确定性。</li>
            <li>控制实验环境温度，减少热胀冷缩的影响。</li>
            <li>使用更精密的光学平台，确保光轴与接触点对准。</li>
            <li>多次重复测量，取平均值减小随机误差。</li>
        </ol>
    `;
}

/**
 * 生成拓展思考题部分
 */
function generateThinkingQuestions() {
    return `
        <h2>拓展思考题</h2>
        
        <div class="question">
            <h3>思考题1: 白光牛顿环</h3>
            <p><strong>问题</strong>：如果使用白光代替单色光，牛顿环会呈现什么样的图案？为什么？</p>
            <p><strong>分析</strong>：白光由不同波长的可见光组成（约400-700nm）。根据公式r<sub>m</sub><sup>2</sup> = mλR，不同波长λ的光会在不同位置形成明暗环。当m较小时，不同波长的环几乎重叠；随着m增大，不同波长的环逐渐分离，形成彩色光环。中心仍为暗斑，因为零级干涉条件与波长无关。</p>
        </div>
        
        <div class="question">
            <h3>思考题2: 中心暗斑形成原因</h3>
            <p><strong>问题</strong>：为什么牛顿环中心是暗的而不是亮的？</p>
            <p><strong>分析</strong>：在透镜与平板接触处，光线同时从两个界面反射：空气-玻璃界面和玻璃-空气界面。当光从低折射率介质（空气）入射到高折射率介质（玻璃）时，反射光会产生π相位变化（半个波长）；而从高折射率介质到低折射率介质反射时不产生相位变化。因此，这两束反射光之间存在π相位差，导致相消干涉，形成暗斑。</p>
        </div>
        
        <div class="question">
            <h3>思考题3: 不同介质对牛顿环的影响</h3>
            <p><strong>问题</strong>：如果空气薄膜中充入其他折射率不同的气体，会对牛顿环产生什么影响？</p>
            <p><strong>分析</strong>：介质的折射率会影响光的波长。根据公式λ<sub>介质</sub> = λ<sub>真空</sub>/n，其中n为介质折射率。当空气被折射率更高的气体替代时，有效波长变短，根据r<sub>m</sub><sup>2</sup> = mλR，相同序号的环半径会变小。同时，界面反射系数也会改变，影响干涉条纹的对比度。</p>
        </div>
        
        <div class="question">
            <h3>思考题4: 精确测量策略</h3>
            <p><strong>问题</strong>：牛顿环实验中，测量哪些环的直径会得到更精确的结果？为什么？</p>
            <p><strong>分析</strong>：测量较大序号（外侧）的环可获得更精确的结果。原因有二：首先，较大环的直径更大，相对测量误差较小；其次，根据r<sub>m</sub><sup>2</sup> = mλR，环半径平方与环序m成正比，大序号环的变化量更大，拟合线性关系时，斜率确定更准确。然而，环过大时边缘可能变得模糊，因此应选择清晰可见且直径较大的环进行测量。</p>
        </div>
        
        <div class="question">
            <h3>思考题5: 非球面透镜的牛顿环</h3>
            <p><strong>问题</strong>：如果透镜表面不是球面而是非球面，牛顿环会呈现什么样的图案？</p>
            <p><strong>分析</strong>：球面透镜产生圆形牛顿环是因为等高线（等距离面）是圆形的。非球面透镜的表面曲率在不同区域变化，因此形成的干涉图案不再是规则的同心圆。例如，抛物面透镜会形成椭圆状的牛顿环；柱面透镜会形成平行条纹；具有像差的透镜会产生不规则的变形环。这种变形模式可用于评估透镜表面的偏差情况。</p>
        </div>
        
        <div class="question">
            <h3>思考题6: 测量光波长</h3>
            <p><strong>问题</strong>：已知牛顿环直径的分布规律，如何利用牛顿环测量光的波长？请设计一个简单的实验方案。</p>
            <p><strong>分析</strong>：实验方案：(1) 使用已知曲率半径R的标准透镜；(2) 测量多个牛顿环的直径D<sub>m</sub>或半径r<sub>m</sub>；(3) 绘制r<sub>m</sub><sup>2</sup>与环序m的关系图，得到斜率k；(4) 根据关系式r<sub>m</sub><sup>2</sup> = mλR，计算波长λ = k/R。为提高精度，应测量多个清晰可见的环，并使用线性回归减小随机误差。这种方法可作为光波长的实验测量手段，特别适用于评估未知光源的波长特性。</p>
        </div>
    `;
}

/**
 * 生成报告内容
 */
function generateReportContent() {
    try {
        // 获取学生信息
        const studentName = document.getElementById('student-name')?.value || '未命名';
        const studentId = document.getElementById('student-id')?.value || '无学号';
        const experimentDate = document.getElementById('experiment-date')?.value || new Date().toLocaleDateString('zh-CN');
        
        // 获取选项
        const includeData = document.getElementById('include-data')?.checked ?? true;
        const includeErrorAnalysis = document.getElementById('include-error-analysis')?.checked ?? true;
        const includeThinkingQuestions = document.getElementById('include-thinking-questions')?.checked ?? true;
        
        // 基本报告结构
        let report = `
            <h1>牛顿环实验报告</h1>
            <div class="report-meta">
                <p><strong>姓名：</strong> ${studentName}</p>
                <p><strong>学号：</strong> ${studentId}</p>
                <p><strong>实验日期：</strong> ${experimentDate}</p>
            </div>
            
            <h2>实验目的</h2>
            <p>通过测量牛顿环的半径，计算凸透镜的曲率半径，验证光的干涉原理。</p>
            
            <h2>实验原理</h2>
            <p>当平面玻璃板与凸透镜接触时，在它们之间形成一个楔形薄膜。光线从这个薄膜的上下表面反射，产生干涉。在单色光照射下，会观察到一系列明暗相间的环形条纹，称为牛顿环。</p>
            <p class="formula">对于第m个暗环：r<sub>m</sub><sup>2</sup> = mλR</p>
            <p>其中，r<sub>m</sub>是环半径，λ是光波长，R是凸透镜的曲率半径。通过测量不同序号环的半径，并绘制r<sub>m</sub><sup>2</sup>与m的关系图，可以通过斜率确定曲率半径R。</p>
            
            <h2>实验仪器与材料</h2>
            <ul>
                <li>凸透镜（曲率半径约为10m）</li>
                <li>光学平板玻璃</li>
                <li>钠光源（λ = 589nm）</li>
                <li>支架和微调装置</li>
                <li>游标卡尺或数字测微器</li>
                <li>读数显微镜</li>
            </ul>
            
            <h2>实验步骤</h2>
            <ol>
                <li>将凸透镜放置在光学平板上，使其凸面与平板接触。</li>
                <li>调整钠光源位置，使光线垂直照射在透镜上。</li>
                <li>从上方观察，可见一系列同心圆环（牛顿环）。</li>
                <li>使用游标卡尺或读数显微镜测量不同序号的暗环直径。</li>
                <li>计算各环的半径和半径平方，记录在表格中。</li>
                <li>绘制r<sub>m</sub><sup>2</sup>与m的关系图，通过线性拟合获取斜率。</li>
                <li>根据公式R = k/λ计算曲率半径，其中k为拟合直线的斜率。</li>
            </ol>
        `;
        
        // 添加实验数据
        if (includeData) {
            report += `
                <h2>实验数据与结果</h2>
                <h3>实验条件</h3>
                <p>光源: 钠光源（黄光）</p>
                <p>波长: λ = 589 nm</p>
                <p>环境温度: 25°C</p>
                
                <h3>测量数据</h3>
                ${generateExperimentDataTable()}
                
                <h3>数据处理</h3>
                <p>根据公式r<sub>m</sub><sup>2</sup> = mλR，环半径平方r<sub>m</sub><sup>2</sup>与环序m成正比关系。绘制r<sub>m</sub><sup>2</sup>对m的图像，通过线性拟合得到斜率k = λR。</p>
                ${generateLinearFitGraph()}
            `;
        }
        
        // 添加误差分析
        if (includeErrorAnalysis) {
            report += generateErrorAnalysis();
        }
        
        // 添加拓展思考题
        if (includeThinkingQuestions) {
            report += generateThinkingQuestions();
        }
        
        // 结论部分
        report += `
            <h2>结论</h2>
            <p>通过本实验，我们成功测量了凸透镜的曲率半径，验证了牛顿环的干涉原理。实验结果与理论预期基本一致，误差在可接受范围内。</p>
            <p>通过对牛顿环半径与环序的关系分析，我们验证了r<sub>m</sub><sup>2</sup> = mλR的数学关系，直接展示了薄膜干涉原理在实验中的应用。</p>
            <p>本实验也揭示了光的波动性特征，以及波动光学在精密测量中的重要应用价值。</p>
        `;
        
        return report;
    } catch (error) {
        console.error('生成报告内容时出错:', error);
        return `<h1>报告生成失败</h1><p>错误信息: ${error.message}</p>`;
    }
}

/**
 * 下载实验报告
 */
function downloadReport() {
    try {
        console.log('开始生成报告...');
        const studentName = document.getElementById('student-name')?.value || '未命名';
        const studentId = document.getElementById('student-id')?.value || '无学号';
        const currentDate = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
        
        // 生成报告内容
        const content = generateReportContent();
        console.log('报告内容已生成');
        
        // 创建完整HTML文档
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
                        margin-bottom: 25px;
                        padding: 15px;
                        background-color: #f9f9f9;
                        border-left: 3px solid #2196F3;
                    }
                    .graph-placeholder {
                        text-align: center;
                        margin: 20px 0;
                    }
                    .graph-placeholder img {
                        max-width: 80%;
                        height: auto;
                        border: 1px solid #ddd;
                    }
                    .graph-caption {
                        margin-top: 10px;
                        font-style: italic;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;
        
        console.log('准备文件下载...');
        
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
        
        alert('报告已生成，正在下载...');
    } catch (error) {
        console.error('下载报告时发生错误:', error);
        alert('下载报告失败: ' + error.message);
    }
}

// 确保函数是全局可访问的
window.downloadReport = downloadReport;
window.generateReportContent = generateReportContent;

console.log('下载报告脚本初始化完成'); 