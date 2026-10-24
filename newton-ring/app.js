/**
 * AI增强的牛顿环曲率测量虚拟仿真实验
 * 主应用脚本，处理页面交互
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，初始化所有功能');
    
    // 初始化标签页切换
    initTabs();
    
    // 初始化3D演示
    init3DDemo();
    
    // 初始化仿真实验
    initSimulation();
    
    // 初始化AI预测模型
    initPredictionModel();
    
    // 初始化报告生成功能
    initReportGeneration();
    
    // 初始化科学前沿应用视频
    console.log('正在主流程中调用视频初始化...');
    initApplicationVideo();
    
    // 其他初始化代码...
});

/**
 * 初始化标签页切换功能
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // 默认激活第一个标签
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    document.getElementById(activeTab).classList.add('active');
    
    // 为每个标签按钮添加点击事件
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有标签和内容的激活状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // 激活当前标签和内容
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // 如果切换到3D演示，初始化3D场景
            if (tabId === '3d-demo' && typeof init3DScene === 'function') {
                if (!window.scene3DInitialized) {
                    init3DScene();
                    window.scene3DInitialized = true;
                }
            }
            
            // 如果切换到AI预测，初始化图表
            if (tabId === 'ai-prediction' && typeof initPredictionCharts === 'function') {
                if (!window.predictionChartsInitialized) {
                    initPredictionCharts();
                    window.predictionChartsInitialized = true;
                }
            }
        });
    });
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', function(event) {
        // Alt+左右箭头切换标签
        if (event.altKey) {
            if (event.key === 'ArrowRight') {
                const activeBtn = document.querySelector('.tab-btn.active');
                const nextBtn = activeBtn.nextElementSibling;
                if (nextBtn && nextBtn.classList.contains('tab-btn')) {
                    nextBtn.click();
                }
            } else if (event.key === 'ArrowLeft') {
                const activeBtn = document.querySelector('.tab-btn.active');
                const prevBtn = activeBtn.previousElementSibling;
                if (prevBtn && prevBtn.classList.contains('tab-btn')) {
                    prevBtn.click();
                }
            }
        }
    });
}

/**
 * 初始化范围滑块的标签更新
 */
function initRangeLabels() {
    // 仿真实验滑块
    const radiusSlider = document.getElementById('radius');
    const radiusValue = document.getElementById('radius-value');
    if (radiusSlider && radiusValue) {
        radiusSlider.addEventListener('input', () => {
            radiusValue.textContent = `${radiusSlider.value} mm`;
        });
    }
    
    const wavelengthSlider = document.getElementById('wavelength');
    const wavelengthValue = document.getElementById('wavelength-value');
    if (wavelengthSlider && wavelengthValue) {
        wavelengthSlider.addEventListener('input', () => {
            wavelengthValue.textContent = `${wavelengthSlider.value} nm`;
        });
    }
    
    // AI预测滑块
    const testRadiusSlider = document.getElementById('test-radius');
    const testRadiusValue = document.getElementById('test-radius-value');
    if (testRadiusSlider && testRadiusValue) {
        testRadiusSlider.addEventListener('input', () => {
            testRadiusValue.textContent = `${testRadiusSlider.value} mm`;
        });
    }
    
    const testWavelengthSlider = document.getElementById('test-wavelength');
    const testWavelengthValue = document.getElementById('test-wavelength-value');
    if (testWavelengthSlider && testWavelengthValue) {
        testWavelengthSlider.addEventListener('input', () => {
            testWavelengthValue.textContent = `${testWavelengthSlider.value} nm`;
        });
    }
    
    // 添加键盘控制滑块
    document.addEventListener('keydown', function(event) {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') {
            if (event.key === 'r' || event.key === 'R') {
                // 聚焦曲率半径滑块
                if (document.getElementById('simulation').classList.contains('active')) {
                    radiusSlider.focus();
                } else if (document.getElementById('ai-prediction').classList.contains('active')) {
                    testRadiusSlider.focus();
                }
            } else if (event.key === 'w' || event.key === 'W') {
                // 聚焦波长滑块
                if (document.getElementById('simulation').classList.contains('active')) {
                    wavelengthSlider.focus();
                } else if (document.getElementById('ai-prediction').classList.contains('active')) {
                    testWavelengthSlider.focus();
                }
            }
        }
    });
}

/**
 * 初始化MathJax公式渲染
 */
function initMathJax() {
    if (window.MathJax) {
        window.MathJax.typeset();
    }
}

/**
 * 初始化实验原理部分的交互元素
 */
function initTheoryInteractions() {
    // 绘制干涉原理图示
    drawInterferenceDiagrams();
    
    // 其他交互元素初始化代码...
}

// 绘制干涉原理图示
function drawInterferenceDiagrams() {
    console.log('开始绘制干涉原理图示');
    
    // 绘制相长干涉
    const constructiveCanvas = document.getElementById('constructive-interference');
    if (constructiveCanvas) {
        console.log('找到相长干涉画布', constructiveCanvas.width, constructiveCanvas.height);
        drawConstructiveInterference();
    } else {
        console.error('找不到相长干涉画布元素');
    }
    
    // 绘制相消干涉
    const destructiveCanvas = document.getElementById('destructive-interference');
    if (destructiveCanvas) {
        console.log('找到相消干涉画布', destructiveCanvas.width, destructiveCanvas.height);
        drawDestructiveInterference();
    } else {
        console.error('找不到相消干涉画布元素');
    }
    
    console.log('干涉原理图示绘制完成');
}

// 绘制相长干涉图示
function drawConstructiveInterference() {
    const canvas = document.getElementById('constructive-interference');
    if (!canvas) {
        console.error('相长干涉canvas元素未找到');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('无法获取canvas 2D上下文');
        return;
    }
    
    const width = canvas.width;
    const height = canvas.height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // 设置颜色和线宽
    ctx.lineWidth = 2;
    
    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(20, height/2);
    ctx.lineTo(width-20, height/2);
    ctx.stroke();
    
    // 箭头和坐标轴标签
    ctx.beginPath();
    ctx.moveTo(width-20, height/2);
    ctx.lineTo(width-30, height/2-5);
    ctx.lineTo(width-30, height/2+5);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    ctx.font = '12px Arial';
    ctx.fillText('传播方向', width-80, height/2-10);
    ctx.fillText('x', width-15, height/2+15);
    
    // 设置波的参数
    const amplitude = 30;  // 振幅
    const period = 50;     // 周期
    const phaseShift = 0;  // 第一个波的相位
    
    // 绘制第一个波（红色）
    drawWave(ctx, amplitude, period, phaseShift, '#e74c3c', width, height, 'Wave 1');
    
    // 绘制第二个波（蓝色）- 相位差为2π的整数倍（这里是0）
    drawWave(ctx, amplitude, period, phaseShift, '#3498db', width, height, 'Wave 2');
    
    // 绘制叠加波（绿色）- 振幅增大
    drawWave(ctx, amplitude*2, period, phaseShift, '#2ecc71', width, height, 'Resultant', true);
    
    // 添加图例
    drawLegend(ctx, width, height, [
        { color: '#e74c3c', text: '波 1' },
        { color: '#3498db', text: '波 2' },
        { color: '#2ecc71', text: '合成波' }
    ]);
    
    // 标注相位差
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('相位差 = 0 (2π的整数倍)', width/2-70, 20);
    
    console.log('相长干涉图示绘制完成');
}

// 绘制相消干涉图示
function drawDestructiveInterference() {
    const canvas = document.getElementById('destructive-interference');
    if (!canvas) {
        console.error('相消干涉canvas元素未找到');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('无法获取canvas 2D上下文');
        return;
    }
    
    const width = canvas.width;
    const height = canvas.height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // 设置颜色和线宽
    ctx.lineWidth = 2;
    
    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(20, height/2);
    ctx.lineTo(width-20, height/2);
    ctx.stroke();
    
    // 箭头和坐标轴标签
    ctx.beginPath();
    ctx.moveTo(width-20, height/2);
    ctx.lineTo(width-30, height/2-5);
    ctx.lineTo(width-30, height/2+5);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    ctx.font = '12px Arial';
    ctx.fillText('传播方向', width-80, height/2-10);
    ctx.fillText('x', width-15, height/2+15);
    
    // 设置波的参数
    const amplitude = 30;  // 振幅
    const period = 50;     // 周期
    const phaseShift1 = 0;              // 第一个波的相位
    const phaseShift2 = Math.PI;        // 第二个波的相位（相差π，即半个波长）
    
    // 绘制第一个波（红色）
    drawWave(ctx, amplitude, period, phaseShift1, '#e74c3c', width, height, 'Wave 1');
    
    // 绘制第二个波（蓝色）- 相位差为π（半个波长）
    drawWave(ctx, amplitude, period, phaseShift2, '#3498db', width, height, 'Wave 2');
    
    // 绘制叠加波（绿色）- 振幅减小至零
    drawWave(ctx, 0, period, phaseShift1, '#2ecc71', width, height, 'Resultant', true);
    
    // 添加图例
    drawLegend(ctx, width, height, [
        { color: '#e74c3c', text: '波 1' },
        { color: '#3498db', text: '波 2' },
        { color: '#2ecc71', text: '合成波 = 0' }
    ]);
    
    // 标注相位差
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('相位差 = π (半波长)', width/2-60, 20);
    
    console.log('相消干涉图示绘制完成');
}

// 绘制波形函数
function drawWave(ctx, amplitude, period, phaseShift, color, width, height, label, isDashed) {
    ctx.save();
    
    // 设置线条样式
    ctx.strokeStyle = color;
    if (isDashed) {
        ctx.setLineDash([4, 2]);
    } else {
        ctx.setLineDash([]);
    }
    
    // 绘制波形
    ctx.beginPath();
    for (let x = 20; x <= width-20; x++) {
        const y = height/2 - amplitude * Math.sin((x - 20) * 2 * Math.PI / period + phaseShift);
        if (x === 20) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    ctx.restore();
}

// 绘制图例
function drawLegend(ctx, width, height, items) {
    const legendX = 30;
    const legendY = height - 50;
    const lineLength = 20;
    const spacing = 20;
    
    items.forEach((item, index) => {
        // 绘制线条
        ctx.strokeStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY + index * spacing);
        ctx.lineTo(legendX + lineLength, legendY + index * spacing);
        ctx.stroke();
        
        // 绘制文本
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText(item.text, legendX + lineLength + 5, legendY + index * spacing + 4);
    });
}

/**
 * 绘制理论说明部分的牛顿环图示和透镜立体图
 * @param {HTMLCanvasElement} canvas - 画布元素
 * @param {number} radius - 透镜曲率半径，单位mm
 * @param {number} wavelength - 波长，单位nm
 */
function drawTheoryIllustration(canvas, radius, wavelength) {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // 创建两部分视图，调整左右比例
    const leftWidth = width * 0.55; // 增加左侧牛顿环区域
    const rightWidth = width * 0.45; // 减少右侧模型区域
    
    // 绘制分隔线
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftWidth, 0);
    ctx.lineTo(leftWidth, height);
    ctx.stroke();
    
    // 为左右两侧添加标题
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#495057';
    ctx.fillText(`牛顿环: 曲率半径 ${radius} mm, 波长: ${wavelength} nm`, 10, 20);
    ctx.fillText(`透镜与平板接触模型`, leftWidth + 10, 20);
    
    // 设置左右两部分的内边距，防止内容贴边
    const paddingX = 20;
    const paddingY = 40; // 增大顶部空间，避免标题重叠
    
    // 绘制左侧牛顿环 - 重新计算绘制位置和大小
    const leftCenterX = leftWidth / 2;
    const leftCenterY = height / 2;
    const leftMaxRadius = Math.min(leftWidth - paddingX * 2, height - paddingY * 2) * 0.45; // 减小环的大小
    
    drawNewtonRings(ctx, leftCenterX, leftCenterY, leftMaxRadius, radius, wavelength);
    
    // 绘制右侧透镜的3D立体图 - 重新计算绘制位置和大小
    const rightCenterX = leftWidth + rightWidth / 2;
    const rightCenterY = height / 2;
    const rightMaxSize = Math.min(rightWidth - paddingX * 2, height - paddingY * 2) * 0.9;
    
    drawLens3D(ctx, rightCenterX, rightCenterY, rightMaxSize, radius);
}

/**
 * 绘制透镜的3D立体图
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} centerX - 中心x坐标
 * @param {number} centerY - 中心y坐标
 * @param {number} size - 绘图区域大小
 * @param {number} radius - 曲率半径，单位mm
 */
function drawLens3D(ctx, centerX, centerY, size, radius) {
    // 透镜参数，调整比例以适应绘图区域
    const lensWidth = size * 0.75;
    const lensHeight = lensWidth * 0.25; // 减小透镜厚度比例
    const curveHeight = lensWidth * 0.15 * (100 / radius); // 调整曲面高度与曲率半径的关系
    
    // 绘制平板玻璃
    const plateWidth = lensWidth * 1.2; // 减小平板宽度
    const plateHeight = lensHeight * 0.2;
    const plateY = centerY + lensHeight/2;
    
    // 平板阴影
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(centerX, plateY + plateHeight * 1.5, plateWidth/2 * 1.1, plateHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 平板
    const plateGradient = ctx.createLinearGradient(centerX - plateWidth/2, plateY, centerX + plateWidth/2, plateY);
    plateGradient.addColorStop(0, '#a8c0d6');
    plateGradient.addColorStop(0.5, '#d9e6f2');
    plateGradient.addColorStop(1, '#a8c0d6');
    
    // 平板顶面
    ctx.fillStyle = plateGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, plateY, plateWidth/2, plateHeight/2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6c8fb3';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 平板侧面
    const plateSideGradient = ctx.createLinearGradient(centerX - plateWidth/2, plateY, centerX + plateWidth/2, plateY + plateHeight);
    plateSideGradient.addColorStop(0, '#8aa7c0');
    plateSideGradient.addColorStop(0.5, '#b3c9dd');
    plateSideGradient.addColorStop(1, '#8aa7c0');
    
    ctx.fillStyle = plateSideGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, plateY, plateWidth/2, plateHeight/2, 0, 0, Math.PI);
    ctx.lineTo(centerX + plateWidth/2, plateY + plateHeight);
    ctx.ellipse(centerX, plateY + plateHeight, plateWidth/2, plateHeight/2, 0, 0, Math.PI, true);
    ctx.lineTo(centerX - plateWidth/2, plateY);
    ctx.fill();
    ctx.strokeStyle = '#6c8fb3';
    ctx.stroke();
    
    // 透镜底部
    const lensBottomY = plateY;
    const lensBottomGradient = ctx.createLinearGradient(centerX - lensWidth/2, lensBottomY, centerX + lensWidth/2, lensBottomY);
    lensBottomGradient.addColorStop(0, 'rgba(180, 210, 240, 0.6)');
    lensBottomGradient.addColorStop(0.5, 'rgba(220, 240, 255, 0.9)');
    lensBottomGradient.addColorStop(1, 'rgba(180, 210, 240, 0.6)');
    
    ctx.fillStyle = lensBottomGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, lensBottomY, lensWidth/2, lensHeight/3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 透镜顶部
    const lensTopY = lensBottomY - lensHeight;
    const lensRadius = lensWidth/2;
    
    // 绘制透镜侧面和曲面
    // 创建透镜渐变
    const lensGradient = ctx.createLinearGradient(centerX - lensRadius, lensTopY, centerX + lensRadius, lensBottomY);
    lensGradient.addColorStop(0, 'rgba(170, 200, 230, 0.7)');
    lensGradient.addColorStop(0.3, 'rgba(200, 220, 240, 0.8)');
    lensGradient.addColorStop(0.7, 'rgba(220, 240, 255, 0.9)');
    lensGradient.addColorStop(1, 'rgba(170, 200, 230, 0.7)');
    
    // 绘制透镜侧面
    ctx.fillStyle = lensGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, lensBottomY, lensRadius, lensHeight/3, 0, Math.PI, Math.PI * 2);
    
    // 绘制透镜曲面 (凸面向上)
    for (let x = -lensRadius; x <= lensRadius; x += 1) {
        const normalizedX = x / lensRadius;
        // 使用二次曲线模拟球面
        const y = -curveHeight * (1 - normalizedX * normalizedX);
        
        if (x === -lensRadius) {
            ctx.lineTo(centerX + x, lensTopY + y);
        } else {
            ctx.lineTo(centerX + x, lensTopY + y);
        }
    }
    
    ctx.closePath();
    ctx.fill();
    
    // 绘制透镜顶部曲面边缘
    ctx.strokeStyle = 'rgba(140, 180, 210, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // 绘制曲面轮廓
    for (let x = -lensRadius; x <= lensRadius; x += 1) {
        const normalizedX = x / lensRadius;
        const y = -curveHeight * (1 - normalizedX * normalizedX);
        
        if (x === -lensRadius) {
            ctx.moveTo(centerX + x, lensTopY + y);
        } else {
            ctx.lineTo(centerX + x, lensTopY + y);
        }
    }
    
    ctx.stroke();
    
    // 绘制透明效果的高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    
    // 左侧高光
    ctx.beginPath();
    ctx.moveTo(centerX - lensRadius * 0.7, lensTopY - curveHeight * 0.3);
    ctx.lineTo(centerX - lensRadius * 0.5, lensBottomY - lensHeight * 0.1);
    ctx.stroke();
    
    // 右侧高光
    ctx.beginPath();
    ctx.moveTo(centerX + lensRadius * 0.6, lensTopY - curveHeight * 0.5);
    ctx.lineTo(centerX + lensRadius * 0.4, lensBottomY - lensHeight * 0.2);
    ctx.stroke();
    
    // 添加光线示意，调整光线长度避免重叠
    drawLightRays(ctx, centerX, lensBottomY, lensRadius, lensTopY, curveHeight);
    
    // 添加空气薄膜标注 - 调整位置
    ctx.fillStyle = '#f03e3e';
    ctx.font = '11px Arial';
    ctx.fillText('空气薄膜', centerX - 25, lensBottomY - 8);
    
    // 添加接触点标注 - 调整位置
    ctx.fillStyle = '#e8590c';
    ctx.beginPath();
    ctx.arc(centerX, lensBottomY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('接触点', centerX + 8, lensBottomY);
    
    // 添加说明文字 - 调整位置和字体大小
    ctx.fillStyle = '#495057';
    ctx.font = '10px Arial';
    ctx.fillText(`透镜曲率半径: ${radius} mm`, centerX - 50, lensBottomY + 35);
    ctx.fillText('平凸透镜', centerX - 22, lensTopY - curveHeight - 8);
    ctx.fillText('平板玻璃', centerX - 22, plateY + plateHeight + 12);
}

/**
 * 绘制光线示意图 - 修改光线长度和文字位置
 */
function drawLightRays(ctx, centerX, contactY, lensRadius, lensTopY, curveHeight) {
    // 入射光线 - 缩短光线长度
    const rayStartX = centerX;
    const rayStartY = lensTopY - curveHeight - 30; // 减小光线起始位置的距离
    
    // 绘制主光线路径
    ctx.strokeStyle = '#fcc419';
    ctx.lineWidth = 2;
    
    // 入射光
    ctx.beginPath();
    ctx.moveTo(rayStartX, rayStartY);
    ctx.lineTo(rayStartX, contactY);
    
    // 添加光线箭头
    drawArrow(ctx, rayStartX, rayStartY + 20, rayStartX, rayStartY + 10, '#fcc419');
    ctx.stroke();
    
    // 反射光线（左侧） - 缩短光线长度
    ctx.beginPath();
    ctx.moveTo(centerX, contactY);
    ctx.lineTo(centerX - 25, rayStartY + 20);
    ctx.stroke();
    
    // 反射光线（右侧） - 缩短光线长度
    ctx.beginPath();
    ctx.moveTo(centerX, contactY);
    ctx.lineTo(centerX + 25, rayStartY + 20);
    ctx.stroke();
    
    // 添加光线标签 - 调整位置和字体大小
    ctx.fillStyle = '#e67700';
    ctx.font = '9px Arial';
    ctx.fillText('入射光', rayStartX + 5, rayStartY + 15);
    ctx.fillText('反射光', centerX - 35, rayStartY + 25);
    ctx.fillText('反射光', centerX + 15, rayStartY + 25);
}

/**
 * 绘制单个牛顿环图案
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} centerX - 中心x坐标
 * @param {number} centerY - 中心y坐标
 * @param {number} maxRadius - 最大半径
 * @param {number} radius - 曲率半径，单位mm
 * @param {number} wavelength - 波长，单位nm
 */
function drawNewtonRings(ctx, centerX, centerY, maxRadius, radius, wavelength) {
    // 波长转换为合适的RGB颜色
    const wavelengthNm = wavelength;
    let r, g, b;
    
    // 更精确的波长到RGB颜色转换算法
    if (wavelengthNm >= 380 && wavelengthNm < 440) {
        r = ((440 - wavelengthNm) / 60) * 1.0;
        g = 0.0;
        b = 1.0;
    } else if (wavelengthNm >= 440 && wavelengthNm < 490) {
        r = 0.0;
        g = ((wavelengthNm - 440) / 50) * 1.0;
        b = 1.0;
    } else if (wavelengthNm >= 490 && wavelengthNm < 510) {
        r = 0.0;
        g = 1.0;
        b = ((510 - wavelengthNm) / 20) * 1.0;
    } else if (wavelengthNm >= 510 && wavelengthNm < 580) {
        r = ((wavelengthNm - 510) / 70) * 1.0;
        g = 1.0;
        b = 0.0;
    } else if (wavelengthNm >= 580 && wavelengthNm < 645) {
        r = 1.0;
        g = ((645 - wavelengthNm) / 65) * 1.0;
        b = 0.0;
    } else if (wavelengthNm >= 645 && wavelengthNm <= 780) {
        r = 1.0;
        g = 0.0;
        b = 0.0;
    } else {
        r = 0.5;
        g = 0.5;
        b = 0.5;
    }
    
    // 根据曲率半径和波长计算牛顿环
    const wavelengthMeters = wavelength * 1e-9; // 转换为米
    const radiusMeters = radius * 1e-3; // 转换为米
    const scaleFactor = 5; // 调整环间距的缩放系数
    
    // 绘制中心暗点
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // 绘制同心环
    for (let i = maxRadius; i > 0; i -= 0.5) {
        // 计算干涉强度
        const distance = i / scaleFactor;
        const thickness = Math.pow(distance, 2) / (2 * radiusMeters);
        const phase = (4 * Math.PI * thickness) / wavelengthMeters + Math.PI;
        const intensity = 0.5 * (1 + Math.cos(phase));
        
        // 设置环的颜色
        ctx.strokeStyle = `rgba(${Math.round(r * 255 * intensity)}, ${Math.round(g * 255 * intensity)}, ${Math.round(b * 255 * intensity)}, 1)`;
        ctx.lineWidth = 1;
        
        // 绘制环
        ctx.beginPath();
        ctx.arc(centerX, centerY, i, 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    // 绘制暗环标记
    const darkRings = [];
    for (let m = 1; m <= 5; m++) {
        // 计算暗环半径 r^2 = m*lambda*R
        const ringRadiusSquared = m * wavelengthMeters * radiusMeters;
        const ringRadius = Math.sqrt(ringRadiusSquared) * scaleFactor;
        
        if (ringRadius <= maxRadius) {
            darkRings.push({
                radius: ringRadius,
                order: m
            });
        }
    }
    
    // 突出显示暗环
    darkRings.forEach(ring => {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 标注暗环序号
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ff5722';
        ctx.fillText(`m=${ring.order}`, centerX + ring.radius * 0.7, centerY - ring.radius * 0.7);
    });
}

/**
 * 绘制箭头
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} fromX - 起始X坐标
 * @param {number} fromY - 起始Y坐标
 * @param {number} toX - 终点X坐标
 * @param {number} toY - 终点Y坐标
 * @param {string} color - 箭头颜色
 */
function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const headLength = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    
    // 绘制箭头头部
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI/6), toY - headLength * Math.sin(angle - Math.PI/6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI/6), toY - headLength * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fill();
}

/**
 * 初始化分享和导出功能
 */
function initShareExport() {
    // 创建实验数据导出按钮
    const exportButton = document.createElement('button');
    exportButton.id = 'export-experiment-btn';
    exportButton.textContent = '导出实验报告';
    exportButton.className = 'export-btn top-btn';
    exportButton.addEventListener('click', exportExperimentReport);
    
    // 添加到页面
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
        mainContainer.insertBefore(exportButton, mainContainer.firstChild);
    }
    
    // 添加键盘快捷键
    document.addEventListener('keydown', function(event) {
        // Alt+E：导出实验报告
        if (event.altKey && event.key === 'e') {
            exportExperimentReport();
        }
    });
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .top-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 100;
        }
        
        .export-btn.top-btn {
            font-size: 0.85rem;
            padding: 5px 10px;
            background-color: #34a853;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 导出实验报告
 */
function exportExperimentReport() {
    // 获取当前实验参数
    const date = new Date().toLocaleString('zh-CN');
    let reportContent = '';
    
    // 根据当前激活的标签页导出不同的内容
    if (document.getElementById('simulation').classList.contains('active')) {
        // 仿真实验数据
        const radius = document.getElementById('radius').value;
        const wavelength = document.getElementById('wavelength').value;
        const measurementResult = document.getElementById('measurement-result').textContent;
        const accuracy = document.getElementById('measurement-accuracy').textContent;
        
        reportContent = `
牛顿环曲率测量虚拟仿真实验报告
=====================================
生成时间: ${date}

实验参数:
- 透镜曲率半径: ${radius} mm
- 光波长: ${wavelength} nm

测量结果:
- 测得曲率半径: ${measurementResult}
- 测量精度: ${accuracy}

分析与结论:
牛顿环干涉实验利用等厚干涉原理，通过测量同心环直径
计算得到透镜曲率半径。实验验证了干涉公式 D_n^2 = 4nλR
的正确性，并通过线性回归提高了测量精度。
`;
    } else if (document.getElementById('ai-prediction').classList.contains('active')) {
        // 预测数据
        const testRadius = document.getElementById('test-radius').value;
        const testWavelength = document.getElementById('test-wavelength').value;
        const predictedRadius = document.getElementById('predicted-radius').textContent;
        const predictionTime = document.getElementById('prediction-time').textContent;
        const relativeError = document.getElementById('relative-error').textContent;
        const modelPrecision = document.getElementById('model-precision').textContent;
        const confidence = document.getElementById('confidence-interval').textContent;
        
        reportContent = `
牛顿环曲率物理预测实验报告
=====================================
生成时间: ${date}

实验参数:
- 透镜曲率半径: ${testRadius} mm
- 光波长: ${testWavelength} nm

物理模型预测结果:
- 预测曲率半径: ${predictedRadius}
- 预测置信区间: ${confidence}
- 相对误差: ${relativeError}
- 模型精度: ${modelPrecision}
- 响应时间: ${predictionTime}

分析与结论:
物理计算模型通过分析牛顿环干涉图案，成功预测出透镜曲率半径，
并量化了预测不确定性。模型表现符合<1%精度和<1秒响应时间
的设计指标，证明了精确物理算法在光学实验分析中的应用价值。
`;
    } else if (document.getElementById('3d-demo').classList.contains('active')) {
        // 3D演示信息
        reportContent = `
牛顿环3D演示实验报告
=====================================
生成时间: ${date}

实验装置:
- 平凸透镜：曲率半径在1-10m范围内
- 平玻璃板：形成空气薄膜
- 单色光源：波长范围400-700nm

实验原理:
当平凸透镜放在平板玻璃上，透镜与平板间形成一个
厚度从中心向外逐渐增大的空气薄膜。当单色光垂直
入射时，形成同心环状的干涉图样。

实验步骤:
1. 将平凸透镜放在平板玻璃上
2. 使单色光垂直照射透镜
3. 观察形成的同心环干涉图案
4. 测量各暗环的直径
5. 绘制环序号与直径平方的关系图
6. 根据公式 D_n^2 = 4nλR 计算曲率半径
`;
    } else if (document.getElementById('theory').classList.contains('active')) {
        // 实验原理信息
        reportContent = `
牛顿环实验原理报告
=====================================
生成时间: ${date}

实验目的:
1. 了解等厚干涉的基本原理
2. 掌握牛顿环干涉条件及形成原理
3. 通过测量牛顿环直径，计算球面透镜的曲率半径
4. 学习数据处理方法，提高测量精度

实验原理:
牛顿环是等厚干涉的典型现象。当平凸透镜放在平面玻璃板上时，
透镜与平板间形成一个厚度从中心向外逐渐增大的空气薄膜。
当单色光垂直入射时，光线在薄膜上下表面反射产生干涉，
形成同心环状的干涉图样。

薄膜厚度计算:
t = r²/2R，其中r是距中心的距离，R是透镜曲率半径

干涉条件:
- 暗环条件: 2t = mλ
- 亮环条件: 2t = (m+1/2)λ

由此得到暗环直径与曲率半径的关系:
Dm² = 4mλR，通过测量环直径即可计算曲率半径
`;
    } else if (document.getElementById('extension').classList.contains('active')) {
        // 拓展内容信息
        reportContent = `
牛顿环实验拓展思考报告
=====================================
生成时间: ${date}

思考题:
1. 如果使用白光代替单色光，牛顿环会呈现什么样的图案？为什么？
2. 为什么牛顿环中心是暗的而不是亮的？
3. 如果空气薄膜中充入其他折射率不同的气体，会对牛顿环产生什么影响？
4. 牛顿环实验中，测量哪些环的直径会得到更精确的结果？为什么？
5. 如果透镜表面不是球面而是非球面，牛顿环会呈现什么样的图案？
6. 已知牛顿环直径的分布规律，如何利用牛顿环测量光的波长？请设计一个简单的实验方案。

科学前沿应用:
牛顿环干涉原理在现代科技中有广泛应用，包括光学元件测试、
薄膜厚度测量、精密长度测量以及引力波探测等领域。LIGO引力波
探测器就是利用激光干涉原理，将引力波引起的微小空间变化转变
为可测量的光程差，实现了引力波的探测。

课程思政:
通过牛顿环实验，我们不仅学习物理知识，也培养严谨求实的科学态度、
创新思维能力、精益求精的工匠精神和团队协作能力。同时，了解中国
在光学领域的重大成就，增强民族自豪感和科技创新的使命感。
`;
    }
    
    // 创建下载链接
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `牛顿环实验报告_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    
    // 清理
    URL.revokeObjectURL(url);
}

/**
 * 显示加载动画
 * @param {HTMLElement} element - 需要显示加载动画的元素
 */
function showLoading(element) {
    // 添加加载动画样式
    addLoadingStyle();
    element.innerHTML = '<div class="loading-spinner"></div>';
}

/**
 * 隐藏加载动画
 * @param {HTMLElement} element - 加载动画所在的元素
 */
function hideLoading(element) {
    const spinner = element.querySelector('.loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

/**
 * 格式化时间显示
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(1)} ms`;
    } else {
        return `${(ms / 1000).toFixed(2)} s`;
    }
}

/**
 * 添加页面上的CSS动画样式
 */
function addLoadingStyle() {
    if (!document.getElementById('loading-style')) {
        const style = document.createElement('style');
        style.id = 'loading-style';
        style.textContent = `
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid rgba(0, 0, 0, 0.1);
                border-left-color: #1a73e8;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .shortcut-hint {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 0.8rem;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .shortcut-hint.show {
                opacity: 1;
            }
            
            /* 自定义滚动条 */
            ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            
            ::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 5px;
            }
            
            ::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 5px;
            }
            
            ::-webkit-scrollbar-thumb:hover {
                background: #a1a1a1;
            }
        `;
        document.head.appendChild(style);
        
        // 添加键盘快捷键提示
        document.addEventListener('keydown', function(event) {
            if (event.key === '?') {
                showShortcutHints();
            }
            
            // 当用户按下Alt，显示提示
            if (event.altKey && !document.querySelector('.shortcut-hint.show')) {
                const shortcutHint = document.createElement('div');
                shortcutHint.className = 'shortcut-hint show';
                shortcutHint.textContent = '按 ? 查看键盘快捷键';
                document.body.appendChild(shortcutHint);
                
                // 2秒后隐藏
                setTimeout(() => {
                    shortcutHint.classList.remove('show');
                    setTimeout(() => {
                        if (shortcutHint.parentNode) {
                            shortcutHint.parentNode.removeChild(shortcutHint);
                        }
                    }, 300);
                }, 2000);
            }
        });
    }
}

/**
 * 显示键盘快捷键提示
 */
function showShortcutHints() {
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'shortcut-dialog';
    dialog.innerHTML = `
        <div class="shortcut-dialog-content">
            <h3>键盘快捷键</h3>
            <table>
                <tr><td><kbd>?</kbd></td><td>显示此帮助</td></tr>
                <tr><td><kbd>Alt</kbd> + <kbd>←</kbd>/<kbd>→</kbd></td><td>切换标签页</td></tr>
                <tr><td><kbd>Alt</kbd> + <kbd>E</kbd></td><td>导出实验报告</td></tr>
                <tr><td><kbd>R</kbd></td><td>聚焦曲率半径滑块</td></tr>
                <tr><td><kbd>W</kbd></td><td>聚焦波长滑块</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>关闭此对话框</td></tr>
            </table>
            <button class="close-btn">关闭</button>
        </div>
    `;
    document.body.appendChild(dialog);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .shortcut-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .shortcut-dialog-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 80%;
        }
        
        .shortcut-dialog h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: #333;
        }
        
        .shortcut-dialog table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .shortcut-dialog td {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        
        .shortcut-dialog td:first-child {
            width: 40%;
            text-align: right;
        }
        
        .shortcut-dialog kbd {
            background-color: #f7f7f7;
            border: 1px solid #ccc;
            border-radius: 3px;
            box-shadow: 0 1px 0 rgba(0,0,0,0.2);
            color: #333;
            display: inline-block;
            font-size: 0.85em;
            font-family: monospace;
            padding: 2px 5px;
            margin: 0 2px;
        }
        
        .shortcut-dialog .close-btn {
            display: block;
            margin: 0 auto;
            padding: 8px 16px;
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .shortcut-dialog .close-btn:hover {
            background-color: #0d47a1;
        }
    `;
    document.head.appendChild(style);
    
    // 绑定关闭事件
    const closeBtn = dialog.querySelector('.close-btn');
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(dialog);
    });
    
    // ESC键关闭
    function escHandler(e) {
        if (e.key === 'Escape') {
            document.body.removeChild(dialog);
            document.removeEventListener('keydown', escHandler);
        }
    }
    document.addEventListener('keydown', escHandler);
}

/**
 * 初始化理论说明部分的交互式图示
 */
function initTheoryIllustration() {
    const canvas = document.getElementById('theory-illustration');
    if (!canvas) return;
    
    // 获取控制元素
    const radiusSlider = document.getElementById('theory-radius');
    const radiusSlider2 = document.getElementById('theory-radius2');
    const wavelengthSlider = document.getElementById('theory-wavelength');
    const radiusValue = document.getElementById('theory-radius-value');
    const radiusValue2 = document.getElementById('theory-radius2-value');
    const wavelengthValue = document.getElementById('theory-wavelength-value');
    
    // 更新显示值并添加动画效果
    if (radiusSlider && radiusValue) {
        radiusSlider.addEventListener('input', function() {
            radiusValue.textContent = `${this.value} mm`;
            radiusValue.classList.add('updating');
            updateIllustration();
            setTimeout(() => {
                radiusValue.classList.remove('updating');
            }, 300);
        });
    }
    
    if (radiusSlider2 && radiusValue2) {
        radiusSlider2.addEventListener('input', function() {
            radiusValue2.textContent = `${this.value} mm`;
            radiusValue2.classList.add('updating');
            updateIllustration();
            setTimeout(() => {
                radiusValue2.classList.remove('updating');
            }, 300);
        });
    }
    
    if (wavelengthSlider && wavelengthValue) {
        wavelengthSlider.addEventListener('input', function() {
            wavelengthValue.textContent = `${this.value} nm`;
            wavelengthValue.classList.add('updating');
            updateIllustration();
            setTimeout(() => {
                wavelengthValue.classList.remove('updating');
            }, 300);
        });
    }
    
    function updateIllustration() {
        const radius = parseFloat(document.getElementById('theory-radius').value);
        const wavelength = parseFloat(document.getElementById('theory-wavelength').value);
        drawTheoryIllustration(canvas, radius, wavelength);
    }
    
    // 添加值更新动画样式
    const style = document.createElement('style');
    style.textContent = `
        .theory-controls span.updating {
            transform: scale(1.1);
            transition: transform 0.3s ease;
        }
    `;
    document.head.appendChild(style);
    
    // 初始绘制
    drawTheoryIllustration(canvas, 103, 589);
}

// 绘制历史部分的牛顿环示意图
function drawNewtonRingsHistoryIllustration() {
    const canvas = document.getElementById('history-newton-rings');
    const cssFallback = document.getElementById('newton-rings-css-fallback');
    const imgFallback = document.getElementById('newton-rings-fallback');
    
    // 显示后备方案的函数
    function showFallback() {
        if (canvas) canvas.style.display = 'none';
        
        // 优先使用CSS后备方案
        if (cssFallback) {
            cssFallback.style.display = 'block';
            console.log('显示CSS后备牛顿环');
        } else if (imgFallback) {
            imgFallback.style.display = 'block';
            console.log('显示图片后备牛顿环');
        }
    }
    
    if (!canvas) {
        console.error('找不到牛顿环历史插图的canvas元素');
        showFallback();
        return;
    }
    
    console.log('开始绘制牛顿环历史插图', canvas.width, canvas.height);
    
    // 尝试获取Canvas上下文
    let ctx;
    try {
        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('无法获取2D上下文');
        }
    } catch (error) {
        console.error('Canvas绘制错误:', error);
        showFallback();
        return;
    }
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 动画参数
    let time = 0;
    const fps = 60;
    const period = 5; // 动画周期（秒）
    
    // 添加错误处理
    let animationRunning = true;
    
    function draw() {
        if (!animationRunning) return;
        
        try {
            // 清除画布
            ctx.clearRect(0, 0, width, height);
            
            // 计算动画阶段 (0 到 1)
            const animationPhase = (time % (period * fps)) / (period * fps);
            
            // 绘制背景
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
            
            // 绘制玻璃平板（底部）
            ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
            ctx.fillRect(20, height - 30, width - 40, 20);
            
            // 绘制玻璃平板边缘高光
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, height - 30);
            ctx.lineTo(width - 20, height - 30);
            ctx.stroke();
            
            // 3D透镜效果
            const lensHeight = 100 * (0.8 + 0.2 * Math.sin(animationPhase * Math.PI * 2));
            const lensRadius = 120;
            
            // 绘制透镜边缘
            ctx.beginPath();
            ctx.ellipse(centerX, height - 30, lensRadius, 20, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
            ctx.fill();
            
            // 绘制透镜上部曲面（半球体）
            ctx.beginPath();
            ctx.ellipse(centerX, height - 30 - lensHeight, lensRadius, lensRadius * 0.4, 0, Math.PI, Math.PI * 2);
            
            // 创建透镜的径向渐变
            const gradient = ctx.createRadialGradient(
                centerX, height - 30 - lensHeight/2, 0,
                centerX, height - 30 - lensHeight/2, lensRadius
            );
            gradient.addColorStop(0, 'rgba(210, 240, 255, 0.7)');
            gradient.addColorStop(1, 'rgba(180, 210, 240, 0.3)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 绘制透镜边缘高光
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(centerX, height - 30 - lensHeight, lensRadius, lensRadius * 0.4, 0, Math.PI, Math.PI * 2);
            ctx.stroke();
            
            // 绘制牛顿环
            const maxRings = 9;
            const ringsAmplitude = 0.8 + 0.2 * Math.sin(animationPhase * Math.PI * 2);
            
            for (let i = maxRings; i > 0; i--) {
                const ringRadius = i * (lensRadius / maxRings) * ringsAmplitude;
                
                // 环的颜色（彩虹色）
                const hue = (i * 30 + time / 3) % 360;
                ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.6)`;
                ctx.lineWidth = 3;
                
                // 绘制环
                ctx.beginPath();
                ctx.ellipse(centerX, height - 30, ringRadius, ringRadius * 0.4, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // 绘制中心点（接触点）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(centerX, height - 30, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制光源指示
            const lightY = 50;
            
            // 光线
            for (let angle = -30; angle <= 30; angle += 15) {
                const rad = angle * Math.PI / 180;
                const startX = centerX + Math.sin(rad) * 20;
                const endX = centerX + Math.sin(rad) * (height - lightY - 50);
                
                ctx.beginPath();
                ctx.moveTo(startX, lightY);
                ctx.lineTo(endX, height - 50);
                ctx.strokeStyle = `rgba(255, 255, 200, ${0.2 + 0.1 * Math.sin(time/10)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // 光源
            const lightGlow = ctx.createRadialGradient(
                centerX, lightY, 5,
                centerX, lightY, 25
            );
            lightGlow.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
            lightGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
            
            ctx.fillStyle = lightGlow;
            ctx.beginPath();
            ctx.arc(centerX, lightY, 25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
            ctx.beginPath();
            ctx.arc(centerX, lightY, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // 更新时间
            time++;
            
            // 继续动画
            requestAnimationFrame(draw);
        } catch (error) {
            console.error('牛顿环动画绘制错误', error);
            animationRunning = false;
            showFallback();
        }
    }
    
    // 启动动画
    draw();
}

// 确保DOM加载完成后初始化牛顿环历史插图
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化牛顿环历史插图');
    // 给页面一点时间完全渲染
    setTimeout(drawNewtonRingsHistoryIllustration, 500);
    
    // 如果3秒后仍然看不到Canvas内容，显示后备方案
    setTimeout(function() {
        const canvas = document.getElementById('history-newton-rings');
        const cssFallback = document.getElementById('newton-rings-css-fallback');
        const imgFallback = document.getElementById('newton-rings-fallback');
        
        try {
            if (canvas) {
                // 检查canvas是否有内容（尝试获取中心位置的像素数据）
                const ctx = canvas.getContext('2d');
                const pixelData = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
                
                // 如果中心点是完全透明或全黑，可能没有绘制成功
                if (pixelData[3] === 0 || (pixelData[0] === 0 && pixelData[1] === 0 && pixelData[2] === 0 && pixelData[3] === 255)) {
                    console.log('Canvas可能没有正确渲染内容，显示后备方案');
                    canvas.style.display = 'none';
                    
                    if (cssFallback) {
                        cssFallback.style.display = 'block';
                    } else if (imgFallback) {
                        imgFallback.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.error('检查Canvas内容时出错', error);
            
            // 出错时显示后备方案
            if (canvas) canvas.style.display = 'none';
            if (cssFallback) {
                cssFallback.style.display = 'block';
            } else if (imgFallback) {
                imgFallback.style.display = 'block';
            }
        }
    }, 3000);
});

/**
 * 初始化实验报告生成功能
 */
function initReportGeneration() {
    // 检查当前页面是否是extension.html，如果是则不初始化报告功能，避免与extension.js冲突
    const currentPath = window.location.pathname;
    if (currentPath.endsWith('extension.html')) {
        console.log('当前页面是extension.html，跳过app.js中的报告生成功能初始化');
        return;
    }
    
    console.log('初始化实验报告生成功能');
    
    // 绑定预览报告按钮
    const previewBtn = document.getElementById('preview-report-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', previewReport);
        console.log('预览报告按钮事件绑定成功');
    } else {
        console.error('预览报告按钮未找到，ID: preview-report-btn');
    }
    
    // 绑定打印报告按钮
    const printBtn = document.getElementById('print-report-btn');
    if (printBtn) {
        printBtn.addEventListener('click', printReport);
        console.log('打印报告按钮事件绑定成功');
    } else {
        console.error('打印报告按钮未找到，ID: print-report-btn');
    }
    
    // 绑定关闭模态框按钮
    const closeBtn = document.querySelector('.report-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('report-modal').style.display = 'none';
        });
        console.log('关闭报告模态框按钮事件绑定成功');
    } else {
        console.error('关闭报告模态框按钮未找到');
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('report-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    console.log('实验报告生成功能初始化完成');
}

/**
 * 预览实验报告
 */
function previewReport() {
    console.log('开始生成报告预览...');
    
    try {
        // 生成报告HTML内容
        const reportHtml = generateReportHtml();
        console.log('报告HTML已生成');
        
        // 显示模态框并插入内容
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = reportHtml;
            console.log('报告内容已加载到预览框');
        } else {
            console.error('报告内容容器未找到，ID: report-content');
            // 尝试查找所有可能的容器
            const possibleContainers = document.querySelectorAll('.report-content');
            console.log(`找到 ${possibleContainers.length} 个可能的报告内容容器`);
        }
        
        const reportModal = document.getElementById('report-modal');
        if (reportModal) {
            // 确保模态框可见
            reportModal.style.display = 'block';
            console.log('报告预览模态框已显示');
            
            // 尝试滚动到顶部
            if (reportContent) {
                reportContent.scrollTop = 0;
            }
        } else {
            console.error('报告模态框未找到，ID: report-modal');
            // 尝试查找所有模态框元素
            const allModals = document.querySelectorAll('.modal');
            console.log(`找到 ${allModals.length} 个模态框元素`);
        }
    } catch (error) {
        console.error('预览报告时发生错误:', error);
        alert('预览报告失败，请查看控制台获取详细错误信息。');
    }
}

/**
 * 打印实验报告
 */
function printReport() {
    console.log('开始准备打印报告...');
    
    try {
        // 生成报告HTML
        const reportHtml = generateReportHtml();
        console.log('报告HTML已生成');
        
        // 创建打印窗口
        console.log('正在创建打印窗口...');
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            console.error('无法创建打印窗口，可能是由于浏览器阻止了弹出窗口');
            alert('打印失败：无法创建打印窗口。请确保您的浏览器允许弹出窗口，然后重试。');
            return;
        }
        
        // 添加打印样式
        console.log('正在添加打印样式...');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>牛顿环曲率测量实验报告</title>
                <style>
                    body {
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                        line-height: 1.5;
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
                    @media print {
                        body {
                            margin: 15mm;
                        }
                        .page-break {
                            page-break-before: always;
                        }
                    }
                </style>
            </head>
            <body>
                ${reportHtml}
            </body>
            </html>
        `);
        
        // 等待页面加载完成后打印
        console.log('正在关闭文档以准备打印...');
        printWindow.document.close();
        
        printWindow.onload = function() {
            console.log('打印窗口已加载，准备调用打印功能...');
            setTimeout(function() {
                console.log('调用打印对话框...');
                printWindow.print();
                
                // 打印后关闭窗口
                printWindow.onafterprint = function() {
                    console.log('打印完成，关闭打印窗口');
                    printWindow.close();
                };
            }, 500); // 给浏览器一些时间来渲染内容
        };
        
        // 处理加载超时
        setTimeout(function() {
            if (printWindow.document.readyState !== 'complete') {
                console.log('打印窗口加载超时，尝试直接调用打印...');
                printWindow.print();
            }
        }, 2000);
        
    } catch (error) {
        console.error('打印报告时发生错误:', error);
        alert('打印报告失败，请查看控制台获取详细错误信息。');
    }
}

/**
 * 生成实验报告HTML内容
 * @returns {string} HTML格式的报告内容
 */
function generateReportHtml() {
    // 获取报告选项
    const includeData = document.getElementById('include-data').checked;
    const includeError = document.getElementById('include-error-analysis').checked;
    const includeQuestions = document.getElementById('include-thinking-questions').checked;
    
    // 获取学生信息
    const studentName = document.getElementById('student-name').value || '未填写';
    const studentId = document.getElementById('student-id').value || '未填写';
    
    // 获取当前日期
    const currentDate = new Date().toLocaleDateString('zh-CN');
    
    // 收集实验数据
    const experimentData = collectExperimentData();
    
    // 构建报告HTML
    let reportHtml = `
        <div class="experiment-report">
            <h1>牛顿环曲率测量实验报告</h1>
            
            <div class="report-meta">
                <p><strong>学生姓名：</strong>${studentName}</p>
                <p><strong>学号：</strong>${studentId}</p>
                <p><strong>实验日期：</strong>${currentDate}</p>
            </div>
            
            <div class="report-section">
                <h2>实验目的</h2>
                <ol>
                    <li>了解等厚干涉的基本原理</li>
                    <li>掌握牛顿环干涉条件及形成原理</li>
                    <li>通过测量牛顿环直径，计算球面透镜的曲率半径</li>
                    <li>学习数据处理方法，提高测量精度</li>
                </ol>
            </div>
            
            <div class="report-section">
                <h2>实验原理</h2>
                <p>牛顿环是等厚干涉的典型现象。当平凸透镜放在平面玻璃板上时，透镜与平板间形成一个厚度从中心向外逐渐增大的空气薄膜。单色光垂直入射时会在薄膜上下表面反射，产生干涉。</p>
                
                <p>对于暗环，其直径与环序之间满足关系：</p>
                <div class="formula">D<sub>m</sub><sup>2</sup> = 4mλR</div>
                
                <p>其中，D<sub>m</sub>为第m个暗环的直径，λ为光波波长，R为透镜的曲率半径。</p>
                
                <p>根据此公式，可以通过测量一系列环的直径，绘制D<sub>m</sub><sup>2</sup>与m的关系图，通过线性拟合得到斜率k=4λR，从而计算出曲率半径R。</p>
            </div>
            
            <div class="report-section">
                <h2>实验器材</h2>
                <ul>
                    <li>平凸透镜：曲率半径${experimentData.setRadius}mm</li>
                    <li>平面玻璃板</li>
                    <li>单色光源：波长${experimentData.wavelength}nm</li>
                    <li>测微目镜</li>
                </ul>
            </div>
    `;
    
    // 添加实验数据（如果选择了包含数据）
    if (includeData) {
        reportHtml += `
            <div class="report-section">
                <h2>实验数据与分析</h2>
                
                <h3>基本参数</h3>
                <ul>
                    <li>透镜曲率半径（设定值）：${experimentData.setRadius} mm</li>
                    <li>光源波长：${experimentData.wavelength} nm</li>
                </ul>
                
                <h3>测量数据</h3>
                <table>
                    <thead>
                        <tr>
                            <th>环序号(m)</th>
                            <th>环直径(mm)</th>
                            <th>直径平方(mm²)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // 添加环测量数据
        if (experimentData.rings && experimentData.rings.length > 0) {
            experimentData.rings.forEach(ring => {
                reportHtml += `
                    <tr>
                        <td>${ring.order}</td>
                        <td>${ring.diameter.toFixed(2)}</td>
                        <td>${(ring.diameter * ring.diameter).toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            reportHtml += `
                <tr>
                    <td colspan="3">没有可用的测量数据</td>
                </tr>
            `;
        }
        
        reportHtml += `
                    </tbody>
                </table>
                
                <h3>数据分析</h3>
                <p>根据公式D<sub>m</sub><sup>2</sup> = 4mλR，通过线性拟合得到：</p>
                <ul>
                    <li>拟合斜率：${experimentData.slope ? experimentData.slope.toFixed(4) : '--'} mm²/环</li>
                    <li>曲率半径（测量值）：${experimentData.measuredRadius ? experimentData.measuredRadius.toFixed(2) : '--'} mm</li>
                    <li>相对误差：${experimentData.relativeError ? experimentData.relativeError.toFixed(2) : '--'}%</li>
                </ul>
        `;
        
        // 添加拟合图表的说明（不添加实际图表，因为静态HTML无法显示）
        reportHtml += `
                <div class="fit-description">
                    <p>通过对D<sub>m</sub><sup>2</sup>-m关系进行线性拟合，拟合直线的斜率为4λR，从而计算得到透镜的曲率半径。</p>
                </div>
            </div>
        `;
    }
    
    // 添加误差分析（如果选择了包含误差分析）
    if (includeError) {
        reportHtml += `
            <div class="report-section">
                <h2>误差分析</h2>
                
                <h3>误差来源</h3>
                <ol>
                    <li><strong>系统误差</strong>
                        <ul>
                            <li>透镜与平板接触不完全，中心位置判断误差</li>
                            <li>透镜或平板表面的不规则性</li>
                            <li>光源非单色性导致的干涉条纹模糊</li>
                        </ul>
                    </li>
                    <li><strong>随机误差</strong>
                        <ul>
                            <li>读数误差</li>
                            <li>环边缘判断的主观性</li>
                            <li>环测量过程中的随机波动</li>
                        </ul>
                    </li>
                </ol>
                
                <h3>误差处理方法</h3>
                <ol>
                    <li>采用线性回归方法降低随机误差的影响</li>
                    <li>选择外环进行测量，因为外环直径较大，相对误差较小</li>
                    <li>多次测量取平均值</li>
                    <li>利用最小二乘法拟合斜率，计算标准差评估测量精度</li>
                </ol>
                
                <h3>改进措施</h3>
                <ol>
                    <li>提高光源的单色性，使干涉条纹更清晰</li>
                    <li>改进透镜与平板的接触方式，减少中心定位误差</li>
                    <li>使用高精度测量工具，减少读数误差</li>
                    <li>优化拟合算法，如加权最小二乘法</li>
                </ol>
            </div>
        `;
    }
    
    // 添加拓展思考题（如果选择了包含思考题）
    if (includeQuestions) {
        reportHtml += `
            <div class="report-section">
                <h2>拓展思考</h2>
                
                <ol>
                    <li>
                        <p><strong>问题：</strong>如果使用不同波长的光源进行牛顿环实验，对测量结果有何影响？</p>
                        <p><strong>回答：</strong>使用不同波长的光源会直接影响干涉环的大小。根据公式D<sub>m</sub><sup>2</sup> = 4mλR，波长λ越大，同一环序m对应的环直径D<sub>m</sub>也越大。短波长光源（如蓝光）会产生更密集的干涉环，而长波长光源（如红光）产生的干涉环间距较大。理论上，短波长光源可以提供更高的测量精度，但干涉环过于密集也可能增加判读难度。</p>
                    </li>
                    
                    <li>
                        <p><strong>问题：</strong>牛顿环实验中，为什么通常使用单色光而非白光作为光源？</p>
                        <p><strong>回答：</strong>单色光的波长单一，产生的干涉条纹清晰稳定，便于观察和测量。而白光包含各种波长的光，不同波长产生的干涉条纹位置不同，会相互重叠形成彩色条纹，使条纹边缘模糊难以准确测量。此外，使用单色光可以直接应用D<sub>m</sub><sup>2</sup> = 4mλR公式计算曲率半径，实验结果更为准确。</p>
                    </li>
                    
                    <li>
                        <p><strong>问题：</strong>如何评估牛顿环实验中的系统误差和随机误差？</p>
                        <p><strong>回答：</strong>系统误差可通过与标准样品比对评估，如使用已知曲率半径的标准透镜进行实验，比较测得值与标准值的差异。也可以通过改变实验条件（如光源位置、透镜与平板的接触方式）观察结果的变化趋势来分析系统误差来源。随机误差可通过重复测量并计算标准差来评估，多次独立测量同一环的直径，分析数据离散程度。使用线性回归分析D<sub>m</sub><sup>2</sup>与m的关系，拟合优度（R²值）也可反映随机误差的大小。</p>
                    </li>
                </ol>
            </div>
        `;
    }
    
    // 添加结论
    reportHtml += `
        <div class="report-section">
            <h2>实验结论</h2>
            
            <p>通过牛顿环实验，成功测量了平凸透镜的曲率半径。实验验证了干涉理论，特别是等厚干涉的基本原理。</p>
            
            <p>测量结果显示，透镜的曲率半径为${experimentData.measuredRadius ? experimentData.measuredRadius.toFixed(2) : '--'} mm，与设定值${experimentData.setRadius} mm相比，相对误差为${experimentData.relativeError ? experimentData.relativeError.toFixed(2) : '--'}%。</p>
            
            <p>通过本实验，掌握了牛顿环干涉条件及形成原理，学习了精确测量和数据处理方法，对光学干涉现象有了更深入的理解。</p>
        </div>
    `;
    
    return reportHtml;
}

/**
 * 收集实验数据
 * @returns {Object} 实验数据对象
 */
function collectExperimentData() {
    // 初始化数据对象
    const data = {
        wavelength: 589, // 默认波长值(nm)
        setRadius: 150,  // 默认设定半径(mm)
        rings: [],
        slope: null,
        measuredRadius: null,
        relativeError: null
    };
    
    try {
        // 尝试获取实际参数值
        // 获取波长
        const wavelengthElem = document.querySelector('.wavelength-btn.active');
        if (wavelengthElem) {
            const wavelength = wavelengthElem.getAttribute('data-wavelength');
            if (wavelength) {
                data.wavelength = parseFloat(wavelength);
            }
        }
        
        // 获取设定曲率半径
        const radiusInput = document.getElementById('radius');
        if (radiusInput && radiusInput.value) {
            data.setRadius = parseFloat(radiusInput.value);
        }
        
        // 获取测量环数据
        const ringsTable = document.querySelector('.measurement-table tbody');
        if (ringsTable) {
            const rows = ringsTable.querySelectorAll('tr');
            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const order = index + 1;
                    const diameter = parseFloat(cells[1].textContent);
                    if (!isNaN(diameter)) {
                        data.rings.push({
                            order: order,
                            diameter: diameter
                        });
                    }
                }
            });
        }
        
        // 获取拟合斜率和测量结果
        const slopeElem = document.getElementById('fit-slope');
        if (slopeElem && slopeElem.textContent && slopeElem.textContent !== '--') {
            const slopeText = slopeElem.textContent.replace('mm²/环', '').trim();
            data.slope = parseFloat(slopeText);
        }
        
        const radiusElem = document.getElementById('predicted-radius') || document.getElementById('calc-radius');
        if (radiusElem && radiusElem.textContent && radiusElem.textContent !== '-- mm') {
            const radiusText = radiusElem.textContent.replace('mm', '').trim();
            data.measuredRadius = parseFloat(radiusText);
            
            // 计算相对误差
            if (data.measuredRadius && data.setRadius) {
                data.relativeError = Math.abs((data.measuredRadius - data.setRadius) / data.setRadius * 100);
            }
        }
        
    } catch (error) {
        console.error('获取实验数据时出错:', error);
    }
    
    return data;
}

/**
 * 初始化科学前沿应用视频功能
 */
function initApplicationVideo() {
    console.log('初始化科学前沿应用视频...');
    
    // 等待DOM完全加载
    setTimeout(function() {
        const videoWrapper = document.querySelector('.video-wrapper');
        const video = document.getElementById('application-video');
        const playBtn = document.querySelector('.video-play-btn');
        const videoContainer = document.querySelector('.application-video-container');
        
        if (!video) {
            console.error('找不到视频元素 #application-video');
            return;
        }
        
        if (!videoWrapper) {
            console.error('找不到视频容器 .video-wrapper');
            return;
        }
        
        console.log('找到视频元素，设置事件监听器');
        
        // 检查视频文件是否存在
        fetch(video.src)
            .then(response => {
                if (!response.ok) {
                    console.error(`视频文件加载失败: ${video.src}，状态码: ${response.status}`);
                    // 如果视频无法加载，添加一个错误提示
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'video-error-message';
                    errorMsg.innerHTML = '视频文件无法加载，请检查路径';
                    videoWrapper.appendChild(errorMsg);
                } else {
                    console.log('视频文件存在并可以访问');
                }
            })
            .catch(error => {
                console.error('视频文件检查失败:', error);
            });
        
        // 确保视频和容器是可点击的
        if (video) {
            video.style.pointerEvents = 'auto';
            console.log('视频元素可点击性已设置');
        }
        
        if (videoWrapper) {
            videoWrapper.style.pointerEvents = 'auto';
            console.log('视频容器可点击性已设置');
        }
        
        // 绑定点击事件到视频容器
        if (videoContainer) {
            videoContainer.addEventListener('click', function(e) {
                console.log('视频容器被点击');
                // 检查是否点击在视频或播放按钮上
                if (e.target === video || e.target === playBtn || playBtn.contains(e.target) || 
                    e.target === videoWrapper || e.target.classList.contains('play-icon')) {
                    handleVideoClick();
                }
            });
        }
        
        // 单独绑定视频元素的点击事件
        if (video) {
            video.addEventListener('click', function(e) {
                console.log('视频元素被直接点击');
                e.stopPropagation();
                handleVideoClick();
            });
        }
        
        // 单独绑定播放按钮的点击事件
        if (playBtn) {
            playBtn.addEventListener('click', function(e) {
                console.log('播放按钮被点击');
                e.stopPropagation();
                handleVideoClick();
            });
        }
        
        console.log('视频事件监听器已全部绑定');
    }, 500); // 延迟500ms确保DOM完全加载
    
    /**
     * 处理视频点击，创建全屏播放界面
     */
    function handleVideoClick() {
        console.log('处理视频点击事件，准备全屏播放');
        
        try {
            // 创建全屏容器
            const fullscreenContainer = document.createElement('div');
            fullscreenContainer.className = 'video-fullscreen';
            fullscreenContainer.style.position = 'fixed';
            fullscreenContainer.style.top = '0';
            fullscreenContainer.style.left = '0';
            fullscreenContainer.style.width = '100%';
            fullscreenContainer.style.height = '100%';
            fullscreenContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            fullscreenContainer.style.zIndex = '9999';
            fullscreenContainer.style.display = 'flex';
            fullscreenContainer.style.alignItems = 'center';
            fullscreenContainer.style.justifyContent = 'center';
            
            // 创建关闭按钮
            const closeBtn = document.createElement('div');
            closeBtn.className = 'close-video-btn';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '20px';
            closeBtn.style.right = '20px';
            closeBtn.style.width = '40px';
            closeBtn.style.height = '40px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = '10000';
            closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            closeBtn.style.borderRadius = '50%';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.justifyContent = 'center';
            
            closeBtn.innerHTML = '<span style="color: white; font-size: 30px;">&times;</span>';
            
            fullscreenContainer.appendChild(closeBtn);
            
            // 创建视频元素
            const fullscreenVideo = document.createElement('video');
            fullscreenVideo.src = document.getElementById('application-video').src;
            fullscreenVideo.controls = true;
            fullscreenVideo.autoplay = true;
            fullscreenVideo.style.width = '90%';
            fullscreenVideo.style.maxWidth = '1200px';
            fullscreenVideo.style.maxHeight = '80vh';
            fullscreenVideo.style.objectFit = 'contain';
            
            fullscreenContainer.appendChild(fullscreenVideo);
            
            // 添加到body
            document.body.appendChild(fullscreenContainer);
            console.log('全屏视频界面已创建并添加到页面');
            
            // 关闭按钮事件
            closeBtn.addEventListener('click', function() {
                console.log('关闭按钮被点击');
                document.body.removeChild(fullscreenContainer);
            });
            
            // ESC键关闭
            const escHandler = function(e) {
                if (e.key === 'Escape') {
                    console.log('ESC键被按下');
                    if (document.body.contains(fullscreenContainer)) {
                        document.body.removeChild(fullscreenContainer);
                    }
                    document.removeEventListener('keydown', escHandler);
                }
            };
            
            document.addEventListener('keydown', escHandler);
            
            // 视频播放结束关闭
            fullscreenVideo.addEventListener('ended', function() {
                console.log('视频播放结束');
                if (document.body.contains(fullscreenContainer)) {
                    document.body.removeChild(fullscreenContainer);
                }
            });
            
        } catch (error) {
            console.error('创建全屏视频时出错:', error);
        }
    }
}

// 确保在DOMContentLoaded事件中初始化视频
document.addEventListener('DOMContentLoaded', function() {
    // 其他初始化代码...
    
    // 初始化科学前沿应用视频
    initApplicationVideo();
});