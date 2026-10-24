/**
 * 报告下载处理模块
 *
 * 提供多种格式的下载功能：
 * - HTML 格式报告下载（保留完整样式，可用浏览器直接打开查看）
 * - JSON 数据包下载（结构化数据，便于归档或二次处理）
 * - 一键导出全套（同时下载 HTML 报告 + JSON 数据包）
 *
 * 基于 Blob API 和动态创建 <a> 标签实现纯前端下载，
 * 无需服务端参与，兼容所有现代浏览器。
 *
 * @module download-report
 * @version 1.0.0
 */

const DownloadReport = {
    // ==================== 单格式下载 ====================

    /**
     * 将内容下载为 HTML 文件
     *
     * 适用场景：用户需要离线查看完整报告、通过邮件发送报告文件等。
     * 生成的 HTML 文件包含内联样式，可在任何现代浏览器中正常显示。
     *
     * @public
     * @param {string} content - HTML 字符串内容
     * @param {string} [filename='实验报告.html'] - 下载文件名
     * @returns {boolean} 是否下载成功
     */
    downloadAsHTML(content, filename = '液相旋光实验报告.html') {
        if (!content || typeof content !== 'string') {
            console.error('[DownloadReport] HTML 下载失败: 内容为空或非字符串');
            return false;
        }

        // 确保 .html 后缀
        if (!filename.toLowerCase().endsWith('.html')) {
            filename += '.html';
        }

        try {
            const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
            this._triggerDownload(blob, filename);
            return true;
        } catch (e) {
            console.error('[DownloadReport] HTML 下载过程中出错:', e);
            return false;
        }
    },

    /**
     * 将数据对象下载为 JSON 文件
     *
     * 适用场景：数据备份、教师端批量导入评分、数据分析等。
     * 输出的 JSON 为格式化文本（2 空格缩进），便于人工阅读。
     *
     * @public
     * @param {Object|Array|string} data - 要序列化的数据（对象会自动 JSON.stringify）
     * @param {string} [filename='实验数据.json'] - 下载文件名
     * @param {boolean} [pretty=true] - 是否格式化输出
     * @returns {boolean} 是否下载成功
     */
    downloadDataPackage(data, filename = '液相旋光实验数据.json', pretty = true) {
        if (data === undefined || data === null) {
            console.error('[DownloadReport] JSON 下载失败: 数据为空');
            return false;
        }

        // 确保 .json 后缀
        if (!filename.toLowerCase().endsWith('.json')) {
            filename += '.json';
        }

        try {
            let jsonString;
            if (typeof data === 'string') {
                // 已是字符串，尝试验证是否为合法 JSON
                try {
                    JSON.parse(data); // 验证
                    jsonString = pretty ? JSON.stringify(JSON.parse(data), null, 2) : data;
                } catch {
                    // 不是合法 JSON，原样保存
                    jsonString = data;
                }
            } else {
                // 对象/数组，序列化为 JSON
                jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
            }

            // UTF-8 BOM 以确保 Windows 记事本正确识别编码
            const bom = '\uFEFF';
            const blob = new Blob([bom + jsonString], { type: 'application/json;charset=utf-8' });
            this._triggerDownload(blob, filename);
            return true;
        } catch (e) {
            console.error('[DownloadReport] JSON 下载过程中出错:', e);
            return false;
        }
    },

    /**
     * 将内容下载为纯文本文件
     *
     * 适用场景：生成简版摘要、导入其他系统等。
     *
     * @public
     * @param {string} content - 文本内容
     * @param {string} [filename='报告摘要.txt'] - 下载文件名
     * @returns {boolean} 是否下载成功
     */
    downloadAsText(content, filename = '实验报告摘要.txt') {
        if (!content || typeof content !== 'string') {
            console.error('[DownloadReport] 文本下载失败: 内容无效');
            return false;
        }

        if (!filename.toLowerCase().endsWith('.txt')) {
            filename += '.txt';
        }

        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            this._triggerDownload(blob, filename);
            return true;
        } catch (e) {
            console.error('[DownloadReport] 文本下载过程中出错:', e);
            return false;
        }
    },

    // ==================== 批量/组合下载 ====================

    /**
     * 一键导出全套资料
     *
     * 依次触发以下下载（每个间隔 800ms 以避免浏览器拦截连续下载）：
     * 1. 物理实验报告 (HTML)
     * 2. 课程思政报告 (HTML)
     * 3. 完整实验数据 (JSON)
     *
     * @public
     * @param {string} physicsReport - 物理实验报告 HTML 字符串
     * @param {string} ideologicalReport - 课程思政报告 HTML 字符串
     * @param {Object} experimentData - 完整实验数据对象
     * @param {Object} [options] - 选项
     * @param {number} [options.interval=800] - 连续下载之间的间隔（毫秒）
     * @param {string} [options.prefix=''] - 文件名前缀（如学号_姓名）
     * @returns {void}
     */
    downloadAll(physicsReport, ideologicalReport, experimentData, options = {}) {
        const interval = options.interval || 800;
        const prefix = options.prefix ? `${options.prefix}_` : '';

        // 准备文件名
        const names = {
            physics: `${prefix}液相旋光实验_物理实验报告.html`,
            ideological: `${prefix}液相旋光实验_课程思政学习报告.html`,
            data: `${prefix}液相旋光实验_原始数据.json`
        };

        const downloads = [];

        // 排队下载任务
        if (physicsReport) {
            downloads.push({ content: physicsReport, filename: names.physics, type: 'html' });
        }
        if (ideologicalReport) {
            downloads.push({ content: ideologicalReport, filename: names.ideologicalReport, type: 'html' });
        }
        if (experimentData) {
            downloads.push({ content: experimentData, filename: names.data, type: 'json' });
        }

        if (downloads.length === 0) {
            console.warn('[DownloadReport] 没有可供下载的内容');
            return;
        }

        console.log(`[DownloadReport] 开始一键导出，共 ${downloads.length} 个文件`);

        // 依次触发下载
        downloads.forEach((item, index) => {
            setTimeout(() => {
                switch (item.type) {
                    case 'html':
                        this.downloadAsHTML(item.content, item.filename);
                        break;
                    case 'json':
                        this.downloadDataPackage(item.content, item.filename);
                        break;
                    default:
                        this.downloadAsText(typeof item.content === 'string' ? item.content : JSON.stringify(item.content), item.filename);
                }
            }, index * interval);
        });
    },

    /**
     * 生成并下载评分结果报告
     *
     * 将 ReportCalculator.calculate() 的输出整理为可读的评分报告并下载。
     *
     * @public
     * @param {Object} scoreResult - ReportCalculator.calculate() 返回的结果对象
     * @param {Object} [studentInfo] - 学生信息（用于文件名和报告头部）
     * @returns {boolean} 是否下载成功
     */
    downloadScoreReport(scoreResult, studentInfo = {}) {
        if (!scoreResult || typeof scoreResult.totalScore !== 'number') {
            console.error('[DownloadReport] 评分报告下载失败: 无效的评分结果');
            return false;
        }

        const name = studentInfo.name || '学生';
        const id = studentInfo.studentId || '';

        // 构建评分报告文本
        let reportLines = [];
        reportLines.push('=' .repeat(60));
        reportLines.push('  液相旋光实验报告 -- 自动评分结果');
        reportLines.push('=' .repeat(60));
        reportLines.push('');
        reportLines.push(`学生姓名: ${name}`);
        reportLines.push(`学    号: ${id}`);
        reportLines.push(`评阅时间: ${new Date().toLocaleString('zh-CN')}`);
        reportLines.push('');
        reportLines.push('-'.repeat(60));
        reportLines.push('  总分与等级');
        reportLines.push('-'.repeat(60));
        reportLines.push(`  总  分: ${scoreResult.totalScore} / 100`);
        reportLines.push(`  等  级: ${scoreResult.grade}`);
        reportLines.push('');

        // 各维度明细
        reportLines.push('-'.repeat(60));
        reportLines.push('  各维度得分明细');
        reportLines.push('-'.repeat(60));

        const dimensionNames = {
            dataCompleteness: '数据完整性',
            calculationAccuracy: '计算准确性',
            errorAnalysisQuality: '误差分析质量',
            ideologicalReflection: '思政反思质量',
            reportFormatting: '报告格式规范'
        };

        Object.keys(scoreResult.breakdown).forEach(key => {
            const dim = scoreResult.breakdown[key];
            const label = dimensionNames[key] || key;
            reportLines.push(`  【${label}】`);
            reportLines.push(`    得分: ${dim.score} / ${dim.maxScore}`);
            if (dim.details) {
                Object.keys(dim.details).forEach(detailKey => {
                    reportLines.push(`      - ${detailKey}: ${JSON.stringify(dim.details[detailKey])}`);
                });
            }
            reportLines.push('');
        });

        // 反馈意见
        if (scoreResult.feedback && scoreResult.feedback.length > 0) {
            reportLines.push('-'.repeat(60));
            reportLines.push('  详细反馈意见');
            reportLines.push('-'.repeat(60));
            scoreResult.feedback.forEach((fb, idx) => {
                reportLines.push(`  ${idx + 1}. ${fb}`);
            });
            reportLines.push('');
        }

        reportLines.push('=' .repeat(60));

        const filename = `${name}${id ? '_' + id : ''}_评分结果_${new Date().toISOString().split('T')[0]}.txt`;
        return this.downloadAsText(reportLines.join('\n'), filename);
    },

    // ==================== 底层下载机制 ====================

    /**
     * 通过创建临时 <a> 元素触发浏览器下载
     *
     * 这是纯前端下载的核心实现方式：
     * 1. 将内容封装为 Blob 对象
     * 2. 通过 URL.createObjectURL 创建临时 URL
     * 3. 创建隐藏的 <a> 标签指向该 URL
     * 4. 触发 click() 启动下载
     * 5. 清理临时资源（释放 URL 和移除 DOM 元素）
     *
     * @private
     * @param {Blob} blob - 文件内容的 Blob 对象
     * @param {string} filename - 目标文件名
     * @returns {void}
     */
    _triggerDownload(blob, filename) {
        // 检查运行环境
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            throw new Error('[DownloadReport] 当前环境不支持 DOM 操作，无法触发下载');
        }

        // 检查 API 支持
        if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            throw new Error('[DownloadReport] 浏览器不支持 Blob 或 URL API，请升级浏览器');
        }

        // 创建临时 URL
        const url = URL.createObjectURL(blob);

        // 创建并配置下载链接
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';   // 隐藏元素
        anchor.setAttribute('target', '_blank'); // 某些浏览器需要此属性

        // 添加到 DOM（必须添加才能在某些浏览器中生效）
        document.body.appendChild(anchor);

        // 触发下载
        try {
            anchor.click();
        } finally {
            // 清理：无论点击是否成功都要释放资源
            setTimeout(() => {
                // 释放 Blob URL
                URL.revokeObjectURL(url);
                // 移除 DOM 元素
                if (anchor.parentNode) {
                    anchor.parentNode.removeChild(anchor);
                }
            }, 100); // 短暂延迟确保下载已开始
        }
    },

    // ==================== 工具方法 ====================

    /**
     * 生成带时间戳的唯一文件名
     *
     * @public
     * @param {string} baseName - 基础名称
     * @param {string} extension - 文件扩展名（含点号，如 '.html'）
     * @returns {string} 格式如 "基础名称_20260608_143022.html"
     */
    generateTimestampedFilename(baseName, extension = '.html') {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');

        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        return `${baseName}_${timestamp}${extension.startsWith('.') ? extension : '.' + extension}`;
    },

    /**
     * 从学生信息生成规范的文件名前缀
     *
     * 格式: 学号_姓名 （去除非法字符）
     *
     * @public
     * @param {Object} studentInfo - 含 name 和 studentId 的对象
     * @returns {string} 如 "20230101_张三"
     */
    generateStudentPrefix(studentInfo = {}) {
        const id = (studentInfo.studentId || '').replace(/[\\/:*?"<>|]/g, '_');
        const name = (studentInfo.name || '').replace(/[\\/:*?"<>|]/g, '_');

        if (id && name) return `${id}_${name}`;
        if (id) return id;
        if (name) return name;
        return '';
    },

    /**
     * 检测当前环境的下载支持情况
     *
     * @public
     * @returns {Object} 支持状态信息
     */
    checkSupport() {
        return {
            hasBlob: typeof Blob !== 'undefined',
            hasURL: typeof URL !== 'undefined',
            hasCreateObjectURL: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
            hasRevokeObjectURL: typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function',
            hasDOM: typeof document !== 'undefined' && typeof document.createElement === 'function',
            fullySupported: typeof Blob !== 'undefined' &&
                              typeof URL !== 'undefined' &&
                              typeof URL.createObjectURL === 'function'
        };
    }
};

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadReport;
}
