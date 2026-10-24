document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const elements = {
        // Controls
        testRadius: document.getElementById('test-radius'),
        testRadiusValue: document.getElementById('test-radius-value'),
        testRadiusInput: document.getElementById('test-radius-input'),
        testWavelength: document.getElementById('test-wavelength'),
        testWavelengthValue: document.getElementById('test-wavelength-value'),
        testWavelengthInput: document.getElementById('test-wavelength-input'),
        noiseLevel: document.getElementById('noise-level'),
        noiseLevelValue: document.getElementById('noise-level-value'),
        noiseLevelInput: document.getElementById('noise-level-input'),
        sampleCount: document.getElementById('sample-count'),
        sampleCountValue: document.getElementById('sample-count-value'),
        sampleCountInput: document.getElementById('sample-count-input'),
        confidenceLevel: document.getElementById('confidence-level'),
        analysisMethod: document.getElementById('analysis-method'),
        predictBtn: document.getElementById('predict-btn'),
        resetBtn: document.getElementById('reset-btn'),
        exportDataBtn: document.getElementById('export-data'),

        // Status
        modelStatus: document.getElementById('model-status'),
        confidenceInterval: document.getElementById('confidence-interval'),
        
        // Results Display
        predictedRadius: document.getElementById('predicted-radius'),
        predictionTime: document.getElementById('prediction-time'),
        fitSlope: document.getElementById('fit-slope'),
        actualRadius: document.getElementById('actual-radius'),
        actualPoints: document.getElementById('actual-points'),
        actualStdDev: document.getElementById('actual-std-dev'),
        relativeError: document.getElementById('relative-error'),
        
        // 仪表盘元素 - 这些已被删除，将引用设为null
        accuracyValue: null, // 原为 document.getElementById('accuracy-value')
        rSquared: null, // 原为 document.getElementById('r-squared')
        avgResponse: null, // 原为 document.getElementById('avg-response')
        stdDeviation: null, // 原为 document.getElementById('std-deviation')

        // Advanced View
        advancedViewToggle: document.getElementById('advanced-view-toggle'),
        advancedControls: document.querySelector('.advanced-controls')
    };

    // Chart instances
    let charts = {};
    let predictionData = [];

    // Initial State
    const initialParams = {
        radius: 200,
        wavelength: 589,
        noise: 2,
        samples: 10,
        confidence: 0.95,
        method: 'least-squares'
    };

    function initializeCharts() {
        const commonChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: false,
                    labels: {
                        color: '#ccc'
                    }
                } 
            },
            scales: { 
                x: { 
                    title: { display: true, text: '环数 (m)', color: '#ccc' }, 
                    ticks: { color: '#ccc' }, 
                    grid: { color: 'rgba(255,255,255,0.1)' } 
                },
                y: { 
                    title: { display: true, text: '环径平方 (D²_m, mm²)', color: '#ccc' }, 
                    ticks: { color: '#ccc', callback: function(value) { return value.toExponential(2); } }, 
                    grid: { color: 'rgba(255,255,255,0.1)' } 
                }
            }
        };
        
        const legendPlugin = {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#ccc',
                    boxWidth: 20,
                    padding: 20
                }
            }
        };

        charts.predictionChart = new Chart(document.getElementById('prediction-chart').getContext('2d'), {
            type: 'scatter',
            data: { datasets: [] },
            options: { ...commonChartOptions, plugins: { ...commonChartOptions.plugins, ...legendPlugin } }
        });

        charts.actualChart = new Chart(document.getElementById('actual-chart').getContext('2d'), {
            type: 'scatter',
            data: { datasets: [] },
             options: { ...commonChartOptions, plugins: { ...commonChartOptions.plugins, legend: {display: true, labels: {color: '#ccc'}} } }
        });
        
        // 数据分析仪表盘图表已被删除，不再初始化
        charts.accuracyGauge = null;
        charts.predictionTrends = null;
        charts.errorDistribution = null;
    }
    
    function updateParameterDisplay() {
        if (elements.testRadiusValue) elements.testRadiusValue.textContent = `${elements.testRadius.value} mm`;
        if (elements.testRadiusInput) elements.testRadiusInput.value = elements.testRadius.value;
        
        if (elements.testWavelengthValue) elements.testWavelengthValue.textContent = `${elements.testWavelength.value} nm`;
        if (elements.testWavelengthInput) elements.testWavelengthInput.value = elements.testWavelength.value;
        
        if (elements.noiseLevelValue) elements.noiseLevelValue.textContent = `${elements.noiseLevel.value}%`;
        if (elements.noiseLevelInput) elements.noiseLevelInput.value = elements.noiseLevel.value;
        
        if (elements.sampleCountValue) elements.sampleCountValue.textContent = `${elements.sampleCount.value}`;
        if (elements.sampleCountInput) elements.sampleCountInput.value = elements.sampleCount.value;
    }
    
    function resetParameters() {
        // 添加按钮反馈
        const originalText = elements.resetBtn.textContent;
        elements.resetBtn.textContent = '重置中...';
        elements.resetBtn.disabled = true;
        
        setTimeout(() => {
            try {
                elements.testRadius.value = initialParams.radius;
                elements.testWavelength.value = initialParams.wavelength;
                elements.noiseLevel.value = initialParams.noise;
                elements.sampleCount.value = initialParams.samples;
                elements.confidenceLevel.value = initialParams.confidence;
                elements.analysisMethod.value = initialParams.method;
                updateParameterDisplay();
                
                // 清空预测历史
                predictionData = [];
                
                // 清理不再使用的图表更新逻辑
                // if (charts.predictionTrends) {
                //     charts.predictionTrends.data.labels = [];
                //     charts.predictionTrends.data.datasets[0].data = [];
                //     charts.predictionTrends.data.datasets[1].data = [];
                //     charts.predictionTrends.update();
                // }
                
                // if (charts.errorDistribution) {
                //     charts.errorDistribution.data.labels = [];
                //     charts.errorDistribution.data.datasets[0].data = [];
                //     charts.errorDistribution.update();
                // }
                
                // 重置指标显示
                if (elements.predictedRadius) elements.predictedRadius.textContent = "-- mm";
                if (elements.predictionTime) elements.predictionTime.textContent = "-- ms";
                if (elements.fitSlope) elements.fitSlope.textContent = "-- mm²/环";
                if (elements.relativeError) elements.relativeError.textContent = "--";
                // if (elements.rSquared) elements.rSquared.textContent = "--";
                // if (elements.stdDeviation) elements.stdDeviation.textContent = "--";
                // if (elements.avgResponse) elements.avgResponse.textContent = "--";
                if (elements.confidenceInterval) elements.confidenceInterval.textContent = "±0.00 mm";
                
                // 执行一次新的预测
                startPrediction();
            } catch (error) {
                console.error("Reset failed:", error);
                alert(`重置失败: ${error.message}`);
            } finally {
                // 恢复按钮状态
                elements.resetBtn.textContent = originalText;
                elements.resetBtn.disabled = false;
            }
        }, 300);
    }

    function linearRegression(data) {
        const n = data.length;
        if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (const point of data) {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumX2 += point.x * point.x;
        }
        const x_mean = sumX / n;
        const y_mean = sumY / n;

        let ss_tot = 0, ss_res = 0;
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = y_mean - slope * x_mean;

        for (const point of data) {
            ss_tot += Math.pow(point.y - y_mean, 2);
            ss_res += Math.pow(point.y - (slope * point.x + intercept), 2);
        }
        
        const r2 = ss_tot === 0 ? 1 : 1 - (ss_res / ss_tot);
        return { slope, intercept, r2 };
    }

    function startPrediction() {
        // 添加按钮状态反馈
        const originalText = elements.predictBtn.textContent;
        elements.predictBtn.textContent = '计算中...';
        elements.predictBtn.disabled = true;
        elements.predictBtn.style.cursor = 'wait';
        elements.modelStatus.textContent = '正在计算...';
        
        // 延迟一小段时间执行计算，使UI状态变化可见
        setTimeout(() => {
            try {
                const startTime = performance.now();
                
                const R_actual = parseFloat(elements.testRadius.value); // mm
                const lambda = parseFloat(elements.testWavelength.value) * 1e-6; // mm
                const noisePercent = parseFloat(elements.noiseLevel.value);
                const numSamples = parseInt(elements.sampleCount.value);

                // 添加详细的错误日志
                console.log('开始预测计算...');
                console.log('参数:', {
                    R_actual,
                    lambda,
                    noisePercent,
                    numSamples
                });

                // 检查参数有效性
                if (isNaN(R_actual) || isNaN(lambda) || isNaN(noisePercent) || isNaN(numSamples)) {
                    throw new Error('无效的输入参数');
                }

                // 计算逻辑
                let actualData = [];
                for (let m = 1; m <= numSamples; m++) {
                    const D_m_sq = 4 * m * lambda * R_actual;
                    actualData.push({ x: m, y: D_m_sq });
                }

                console.log('实际数据:', actualData);

                let measuredData = actualData.map(p => {
                    const noise = (Math.random() - 0.5) * 2 * p.y * (noisePercent / 100);
                    return { x: p.x, y: p.y + noise };
                });

                console.log('测量数据:', measuredData);

                const regression = linearRegression(measuredData);
                console.log('回归结果:', regression);

                const R_predicted = regression.slope / (4 * lambda);
                console.log('预测曲率半径:', R_predicted);

                const endTime = performance.now();
                const duration = (endTime - startTime).toFixed(1);

                // 计算置信区间
                const confidenceValue = parseFloat(elements.confidenceLevel.value);
                const t_value = getConfidenceT(confidenceValue, numSamples - 2);
                const standard_error = calculateStandardError(measuredData, regression);
                const confidence_interval = (t_value * standard_error / (4 * lambda)).toFixed(2);
                elements.confidenceInterval.textContent = `±${confidence_interval} mm`;

                updateUI(R_actual, R_predicted, duration, regression, actualData, measuredData);
                
                elements.modelStatus.textContent = '计算完成';
                
                // 添加成功提示效果
                elements.predictBtn.classList.add('button-success');
                setTimeout(() => elements.predictBtn.classList.remove('button-success'), 1000);
                
                // 保存最近一次计算的数据，用于导出
                window.lastCalculationData = {
                    timestamp: new Date().toLocaleString(),
                    parameters: {
                        radius: R_actual,
                        wavelength: elements.testWavelength.value,
                        noise: noisePercent,
                        samples: numSamples,
                        method: elements.analysisMethod.value
                    },
                    results: {
                        predicted_radius: R_predicted.toFixed(2),
                        relative_error: ((Math.abs(R_predicted - R_actual) / R_actual) * 100).toFixed(2),
                        r_squared: regression.r2.toFixed(4),
                        slope: regression.slope.toExponential(3),
                        confidence_interval: confidence_interval
                    },
                    actualData,
                    measuredData
                };
            } catch (error) {
                console.error("Prediction failed:", error);
                elements.modelStatus.textContent = `计算失败: ${error.message}`;
                alert(`计算出错：\n${error.message}\n请检查参数或刷新页面重试。`);
            } finally {
                // 恢复按钮状态
                elements.predictBtn.textContent = originalText;
                elements.predictBtn.disabled = false;
                elements.predictBtn.style.cursor = 'pointer';
            }
        }, 100);
    }
    
    function calculateStandardError(data, regression) {
        if (data.length <= 2) return 0;
        
        const n = data.length;
        let sum_squared_residuals = 0;
        let sum_x_squared = 0;
        let mean_x = 0;
        
        // 计算x的平均值
        for (const point of data) {
            mean_x += point.x;
        }
        mean_x /= n;
        
        // 计算残差平方和和x平方和
        for (const point of data) {
            const predicted_y = regression.slope * point.x + regression.intercept;
            sum_squared_residuals += Math.pow(point.y - predicted_y, 2);
            sum_x_squared += Math.pow(point.x - mean_x, 2);
        }
        
        // 计算标准误差
        const variance = sum_squared_residuals / (n - 2);
        const standard_error = Math.sqrt(variance / sum_x_squared);
        
        return standard_error;
    }
    
    function getConfidenceT(confidence, df) {
        // 简化的t分布临界值查找
        // 只实现了常用的95%和99%置信水平
        const t_table = {
            "0.9": { // 90%置信水平
                5: 2.015, 10: 1.812, 15: 1.753, 20: 1.725
            },
            "0.95": { // 95%置信水平
                5: 2.571, 10: 2.228, 15: 2.131, 20: 2.086
            },
            "0.99": { // 99%置信水平
                5: 4.032, 10: 3.169, 15: 2.947, 20: 2.845
            }
        };
        
        // 查找最接近的自由度
        let closest_df = Object.keys(t_table[confidence]).reduce((prev, curr) => {
            return (Math.abs(curr - df) < Math.abs(prev - df) ? curr : prev);
        });
        
        return t_table[confidence][closest_df];
    }

    function updateUI(R_actual, R_predicted, duration, regression, actualData, measuredData) {
        // Update text results
        elements.predictedRadius.textContent = `${R_predicted.toFixed(2)} mm`;
        elements.predictionTime.textContent = `${duration} ms`;
        elements.fitSlope.textContent = `${(regression.slope).toExponential(3)} mm²/环`;
        elements.actualRadius.textContent = `${R_actual.toFixed(2)} mm`;
        elements.actualPoints.textContent = actualData.length;
        const actualStd = Math.sqrt(actualData.map(p => Math.pow(p.y - (p.x * R_actual * parseFloat(elements.testWavelength.value) * 1e-6), 2)).reduce((a,b)=>a+b,0) / actualData.length);
        elements.actualStdDev.textContent = actualStd.toExponential(2);
        const relativeErrorValue = (Math.abs(R_predicted - R_actual) / R_actual) * 100;
        elements.relativeError.textContent = `${relativeErrorValue.toFixed(2)}%`;


        // Update charts
        const regressionLine = actualData.map(p => ({ x: p.x, y: regression.slope * p.x + regression.intercept }));

        charts.predictionChart.data.datasets = [
            { label: '模拟测量数据', data: measuredData, backgroundColor: 'rgba(255, 99, 132, 0.6)', type: 'scatter' },
            { label: '线性拟合', data: regressionLine, borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 2, fill: false, type: 'line', pointRadius: 0 }
        ];
        charts.predictionChart.update();

        charts.actualChart.data.datasets = [{ label: '理想数据点', data: actualData, backgroundColor: 'rgba(75, 192, 192, 0.6)', type: 'scatter' }];
        charts.actualChart.update();
        
        // 保存预测数据以便之后使用
        predictionData.push({x: predictionData.length + 1, y: R_predicted});
        if(predictionData.length > 30) predictionData.shift();
    }

    function exportData() {
        if (!window.lastCalculationData) {
            alert("请先生成数据再导出。");
            return;
        }
        
        // 添加按钮反馈
        const originalText = elements.exportDataBtn.textContent;
        elements.exportDataBtn.textContent = '导出中...';
        elements.exportDataBtn.disabled = true;
        
        setTimeout(() => {
            try {
                const data = window.lastCalculationData;
                const measuredData = data.measuredData;
                const actualData = data.actualData;
                
                // 准备CSV数据
                let csvContent = "data:text/csv;charset=utf-8,";
                
                // 添加元数据
                csvContent += "# 牛顿环曲率测量虚拟仿真实验数据\n";
                csvContent += `# 导出时间: ${data.timestamp}\n`;
                csvContent += "# 参数设置:\n";
                csvContent += `# 曲率半径 (R): ${data.parameters.radius} mm\n`;
                csvContent += `# 光波长 (λ): ${data.parameters.wavelength} nm\n`;
                csvContent += `# 噪声水平: ${data.parameters.noise}%\n`;
                csvContent += `# 采样数量: ${data.parameters.samples}\n`;
                csvContent += `# 分析方法: ${data.parameters.method}\n`;
                csvContent += "#\n";
                csvContent += "# 分析结果:\n";
                csvContent += `# 预测曲率半径: ${data.results.predicted_radius} mm\n`;
                csvContent += `# 相对误差: ${data.results.relative_error}%\n`;
                csvContent += `# 拟合优度 (R²): ${data.results.r_squared}\n`;
                csvContent += `# 置信区间 (95%): ±${data.results.confidence_interval} mm\n`;
                csvContent += "#\n";
                
                // 添加数据表头
                csvContent += "环数(m),理想半径平方(r²_m, mm²),测量半径平方(r²_m, mm²)\n";
                
                // 添加数据行
                for (let i = 0; i < measuredData.length; i++) {
                    csvContent += `${measuredData[i].x},${actualData[i].y.toExponential(5)},${measuredData[i].y.toExponential(5)}\n`;
                }
                
                // 创建下载链接
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // 添加成功提示效果
                elements.exportDataBtn.classList.add('button-success');
                setTimeout(() => elements.exportDataBtn.classList.remove('button-success'), 1000);
            } catch (error) {
                console.error("Export failed:", error);
                alert(`导出数据失败: ${error.message}`);
            } finally {
                // 恢复按钮状态
                elements.exportDataBtn.textContent = originalText;
                elements.exportDataBtn.disabled = false;
            }
        }, 500);
    }

    // Event Listeners
    elements.predictBtn.addEventListener('click', startPrediction);
    elements.resetBtn.addEventListener('click', resetParameters);
    elements.exportDataBtn.addEventListener('click', exportData);
    
    // 滑块与输入框交互
    elements.testRadius.addEventListener('input', function() {
        elements.testRadiusInput.value = this.value;
        updateParameterDisplay();
    });
    
    elements.testRadiusInput.addEventListener('change', function() {
        let value = parseFloat(this.value);
        if (isNaN(value)) value = 200;
        value = Math.min(Math.max(value, 100), 300);
        this.value = value;
        elements.testRadius.value = value;
        updateParameterDisplay();
    });
    
    elements.testWavelength.addEventListener('input', function() {
        elements.testWavelengthInput.value = this.value;
        updateParameterDisplay();
    });
    
    elements.testWavelengthInput.addEventListener('change', function() {
        let value = parseFloat(this.value);
        if (isNaN(value)) value = 589;
        value = Math.min(Math.max(value, 400), 700);
        this.value = value;
        elements.testWavelength.value = value;
        updateParameterDisplay();
    });
    
    elements.noiseLevel.addEventListener('input', function() {
        elements.noiseLevelInput.value = this.value;
        updateParameterDisplay();
    });
    
    elements.noiseLevelInput.addEventListener('change', function() {
        let value = parseFloat(this.value);
        if (isNaN(value)) value = 2;
        value = Math.min(Math.max(value, 0), 10);
        this.value = value;
        elements.noiseLevel.value = value;
        updateParameterDisplay();
    });
    
    elements.sampleCount.addEventListener('input', function() {
        elements.sampleCountInput.value = this.value;
        updateParameterDisplay();
    });
    
    elements.sampleCountInput.addEventListener('change', function() {
        let value = parseInt(this.value);
        if (isNaN(value)) value = 10;
        value = Math.min(Math.max(value, 5), 20);
        this.value = value;
        elements.sampleCount.value = value;
        updateParameterDisplay();
    });
    
    ['testRadius', 'testWavelength', 'noiseLevel', 'sampleCount'].forEach(id => {
         elements[id].addEventListener('input', updateParameterDisplay);
    });
    
    elements.advancedViewToggle.addEventListener('change', () => {
        elements.advancedControls.style.display = elements.advancedViewToggle.checked ? 'block' : 'none';
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    });

    // Initial setup
    initializeCharts();
    resetParameters();
    elements.modelStatus.textContent = '准备就绪';
}); 