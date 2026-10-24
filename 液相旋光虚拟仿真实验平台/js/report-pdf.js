/**
 * PDF 导出辅助模块
 *
 * 基于浏览器原生打印功能（window.print()）实现报告导出为 PDF。
 * 核心策略：打开新窗口 -> 写入 HTML 内容 + 打印专用 CSS -> 触发打印对话框。
 * 用户在打印对话框中选择"另存为 PDF"即可完成导出。
 *
 * @module report-pdf
 * @version 1.0.0
 */

const ReportPDF = {
    // ==================== 主导出方法 ====================

    /**
     * 触发报告的 PDF 导出流程
     *
     * 完整流程：
     * 1. 创建新的浏览器窗口（或 iframe）
     * 2. 将 HTML 内容与打印专用样式一并写入
     * 3. 等待内容渲染完成后自动触发 window.print()
     * 4. 用户在系统打印对话框中选择"另存为 PDF"
     *
     * @public
     * @param {string} htmlContent - 报告的完整 HTML 字符串（由 ReportGenerator 生成）
     * @param {string} [filename='实验报告'] - 建议的文件名（用于打印对话框标题）
     * @returns {boolean} 是否成功启动导出流程
     */
    exportToPDF(htmlContent, filename = '液相旋光实验报告') {
        if (!htmlContent || typeof htmlContent !== 'string') {
            console.error('[ReportPDF] 导出失败: HTML 内容无效');
            return false;
        }

        try {
            // 方案一：使用新窗口（主流方案）
            const printWindow = window.open('', '_blank');

            if (!printWindow) {
                console.warn('[ReportPDF] 新窗口被阻止，尝试使用备选方案...');
                return this._fallbackExport(htmlContent, filename);
            }

            // 构建完整的可打印文档（注入增强型打印样式）
            const enhancedHTML = this._injectPrintStyles(htmlContent, filename);

            // 写入内容
            printWindow.document.open();
            printWindow.document.write(enhancedHTML);
            printWindow.document.close();

            // 等待资源加载后触发打印
            printWindow.onload = function () {
                // 额外延迟确保字体和样式完全渲染
                setTimeout(() => {
                    try {
                        printWindow.focus();
                        printWindow.print();
                    } catch (e) {
                        console.error('[ReportPDF] 调用 print() 失败:', e);
                    }
                }, 500);
            };

            return true;

        } catch (e) {
            console.error('[ReportPDF] 导出过程发生异常:', e);
            return this._fallbackExport(htmlContent, filename);
        }
    },

    /**
     * 使用 iframe 进行静默式打印预览（适用于嵌入页面内的场景）
     *
     * 在当前页面内创建隐藏的 iframe，写入内容并调用其打印功能。
     * 适用于需要在不打开新窗口的情况下触发的场景。
     *
     * @public
     * @param {string} htmlContent - 报告 HTML 内容
     * @param {string} [filename] - 文件名
     * @returns {boolean} 是否成功
     */
    exportViaIframe(htmlContent, filename = '实验报告') {
        if (!htmlContent) {
            console.error('[ReportPDF] iframe 导出失败: HTML 内容无效');
            return false;
        }

        try {
            // 清理可能存在的旧 iframe
            const oldIframe = document.getElementById('report-print-iframe');
            if (oldIframe) oldIframe.remove();

            // 创建隐藏 iframe
            const iframe = document.createElement('iframe');
            iframe.id = 'report-print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.border = 'none';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';

            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const enhancedHTML = this._injectPrintStyles(htmlContent, filename);

            iframeDoc.open();
            iframeDoc.write(enhancedHTML);
            iframeDoc.close();

            // 等待渲染完成后打印
            iframe.onload = function () {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();

                        // 打印完成后延迟清理 iframe
                        setTimeout(() => {
                            if (document.getElementById('report-print-iframe')) {
                                document.getElementById('report-print-iframe').remove();
                            }
                        }, 3000);
                    } catch (e) {
                        console.error('[ReportPDF] iframe print() 调用失败:', e);
                    }
                }, 600);
            };

            return true;
        } catch (e) {
            console.error('[ReportPDF] iframe 导出异常:', e);
            return false;
        }
    },

    /**
     * 仅获取打印样式的 CSS 字符串
     *
     * 可供外部模块单独使用，例如将打印样式注入到已有页面中。
     *
     * @public
     * @returns {string} 完整的打印专用 CSS 字符串
     */
    getPrintStyles() {
        return this._buildPrintCSS();
    },

    // ==================== 内部实现方法 ====================

    /**
     * 将增强型打印样式注入到原始 HTML 中
     *
     * 注入策略：
     * - 在 <head> 中追加/替换打印样式 <style> 块
     * - 添加打印时的页眉/页脚脚本
     * - 设置文档标题以便打印对话框显示正确的文件名
     *
     * @private
     * @param {string} originalHTML - 原始 HTML 字符串
     * @param {string} filename - 文件名
     * @returns {string} 注入打印样式后的完整 HTML
     */
    _injectPrintStyles(originalHTML, filename) {
        const printCSS = this._buildPrintCSS();
        const pageScript = this._getPageScript(filename);

        // 检查是否已有 <head> 标签
        if (originalHTML.includes('<head>')) {
            return originalHTML.replace(
                '<head>',
                `<head>
    <!-- 自动注入: PDF 打印优化样式 -->
    <style type="text/css">
${printCSS}
    </style>
    ${pageScript}`
            );
        } else if (originalHTML.includes('<html>')) {
            // 有 <html> 但没有显式的 <head>
            return originalHTML.replace(
                '<html',
                `<html><head><meta charset="UTF-8"><title>${this._escapeAttr(filename)}</title>
    <style type="text/css">
${printCSS}
    </style>
    ${pageScript}</style></head>`
            );
        }

        // 如果不是完整 HTML 文档，包装一下
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._escapeAttr(filename)}</title>
    <style type="text/css">
${printCSS}
    </style>
    ${pageScript}
</head>
<body>${originalHTML}</body>
</html>`;
    },

    /**
     * 构建完整的打印专用 CSS
     *
     * 包含：
     * - A4 纸张尺寸设置
     * - 页边距配置
     * - 字体回退方案
     * - 表格/图片打印优化
     * - 分页控制规则
     * - 页眉页脚设置
     * - 颜色强制打印（防止浏览器将背景色变白）
     *
     * @private
     * @returns {string} CSS 字符串
     */
    _buildPrintCSS() {
        return `
/* ==================== PDF 打印全局优化 ==================== */

@page {
    size: A4 portrait;           /* A4 纸张，纵向 */
    margin: 15mm 18mm 18mm 18mm; /* 上 右 下 左 页边距 */
}

@media print {

    /* ---- 强制颜色输出（防止浏览器省略背景色） ---- */
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }

    /* ---- 全局基础重置 ---- */
    html, body {
        width: 210mm;             /* A4 宽度约束 */
        margin: 0;
        padding: 0;
        background: #fff !important;
        font-family: "SimSun", "Songti SC", "STSong", "FangSong", "Noto Serif CJK SC", serif !important;
        font-size: 13px;         /* 打印时略小以容纳更多内容 */
        line-height: 1.75;
        color: #000 !important;
        -webkit-font-smoothing: antialiased;
    }

    /* ---- 报告容器 ---- */
    .report-body {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
    }

    /* ---- 封面处理 ---- */
    .page-cover {
        min-height: auto !important;
        height: auto !important;
        page-break-after: always !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 80px 40px 60px !important;
    }
    .ideological-cover {
        border-top: 4px solid #b71c1c !important;
    }

    /* ---- 章节分页控制 ---- */
    .section {
        page-break-inside: avoid !important;
        margin-bottom: 20px !important;
    }

    /* ---- 避免以下元素被截断分割 ---- */
    h2, h3, h4,
    table, .data-table,
    .fit-result-box,
    .formula-block,
    .case-card,
    .reflection-content,
    .error-category,
    .analysis-prompt,
    .reflection-prompt {
        page-break-inside: avoid !important;
    }

    /* ---- 表格打印优化 ---- */
    table.data-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 12px !important;
    }
    table.data-table th {
        background-color: #e3f2fd !important;
        border: 1px solid #90caf9 !important;
        padding: 6px 5px !important;
        color: #1565c0 !important;
        font-weight: bold !important;
    }
    table.data-table td {
        border: 1px solid #ccc !important;
        padding: 5px !important;
        text-align: center !important;
    }
    table.data-table tbody tr:nth-child(even) {
        background-color: #f8f9fa !important;
    }

    /* ---- 残差表特殊着色 ---- */
    .residual-table th {
        background-color: #fce4ec !important;
        border-color: #f48fb1 !important;
        color: #c62828 !important;
    }

    /* ---- 校准行 ---- */
    .calibration-row td {
        background-color: #fff8e1 !important;
    }

    /* ---- 公式块 ---- */
    .formula-block {
        background-color: #f5f5f5 !important;
        border-left: 3px solid #1565c0 !important;
        padding: 10px 16px !important;
    }

    /* ---- 拟合结果框 ---- */
    .fit-result-box {
        background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%) !important;
        border: 1px solid #cfd8dc !important;
        border-radius: 6px !important;
        padding: 16px 20px !important;
    }
    .result-item {
        background: #fff !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
        border-radius: 4px !important;
        padding: 8px 12px !important;
        min-width: 120px !important;
    }

    /* ---- 思政报告特有元素 ---- */
    .ideological-report .section-title {
        border-left-color: #b71c1c !important;
    }
    .ideological-cover .cover-title {
        color: #b71c1c !important;
    }
    .case-card {
        border: 1px solid #ffcdd2 !important;
        background: linear-gradient(135deg, #fff 0%, #ffebee 100%) !important;
        border-radius: 6px !important;
        padding: 14px 18px !important;
    }
    .reflection-content {
        background: #fafafa !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
    }
    .reflection-prompt {
        background: #e8f5e9 !important;
        border: 1px dashed #81c784 !important;
    }

    /* ---- 误差分析区域 ---- */
    .error-cat-title {
        background: #455a64 !important;
        color: #fff !important;
    }
    .analysis-prompt {
        background: #fffde7 !important;
        border: 1px dashed #fbc02d !important;
    }

    /* ---- 占位提示文字 ---- */
    .no-data-warning,
    .placeholder-text,
    .no-reflection-placeholder {
        color: #bbb !important;
        background: #f5f5f5 !important;
    }

    /* ---- 页脚 ---- */
    .page-footer {
        border-top: 1px solid #ddd !important;
        color: #999 !important;
        margin-top: 24px !important;
        padding-top: 10px !important;
        text-align: center !important;
        font-size: 11px !important;
    }

    /* ---- 隐藏非必要元素 ---- */
    nav, header.site-header, footer.site-footer,
    .toolbar, .sidebar, .navigation-bar,
    .btn-export, .btn-download, .no-print,
    [data-no-print] {
        display: none !important;
    }

    /* ---- 水印保留 ---- */
    .report-body::after {
        content: attr(data-watermark) !important;
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) rotate(-30deg) !important;
        font-size: 72px !important;
        color: rgba(200, 200, 200, 0.12) !important;
        z-index: 999 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
    }

    /* ---- 页码显示 ---- */
    .page-number {
        display: block !important;
    }
}`;
    },

    /**
     * 构建页面辅助脚本
     *
     * 功能：
     * - 设置文档标题（影响打印对话框中的文件名）
     * - 打印完成后自动聚焦回原窗口
     *
     * @private
     * @param {string} filename - 建议文件名
     * @returns {string} script 标签字符串
     */
    _getPageScript(filename) {
        return `
    <script type="text/javascript">
        // 设置文档标题（打印对话框中显示）
        document.title = '${this._escapeAttr(filename)}';

        // 打印结束后清理引用
        window.addEventListener('afterprint', function() {
            // 可选：打印完成后执行的操作
            if (window.opener && !window.closed) {
                try {
                    window.opener.focus();
                } catch(e) {}
            }
        });

        // 兼容性：部分浏览器不支持 afterprint，使用定时器兜底
        window.onbeforeprint = function() {};
    <\/script>`;
    },

    /**
     * 备选导出方案：当新窗口被阻止时的降级处理
     *
     * 尝试使用 iframe 方案；若仍失败则提示用户手动操作。
     *
     * @private
     * @param {string} htmlContent - HTML 内容
     * @param {string} filename - 文件名
     * @returns {boolean} 是否成功
     */
    _fallbackExport(htmlContent, filename) {
        // 尝试 iframe 方案
        if (typeof document !== 'undefined') {
            const result = this.exportViaIframe(htmlContent, filename);
            if (result) return true;
        }

        // 最终降级：复制到剪贴板并提示用户
        alert(
            '无法自动弹出打印窗口。请尝试以下操作：\n\n' +
            '1. 允许浏览器弹窗后重新点击导出\n' +
            '2. 或先预览报告，再使用 Ctrl+P 手动打印\n\n' +
            '（浏览器可能阻止了自动弹窗）'
        );
        return false;
    },

    /**
     * HTML 属性值转义（防 XSS）
     * @private
     */
    _escapeAttr(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    // ==================== 高级功能 ====================

    /**
     * 批量导出双轨报告为 PDF
     *
     * 依次触发物理报告和思政报告的打印/PDF 导出。
     * 两份报告会分别弹出打印窗口，用户需逐一确认保存。
     *
     * @public
     * @param {string} physicsHTML - 物理实验报告 HTML
     * @param {string} ideologicalHTML - 课程思政报告 HTML
     * @param {Object} [options] - 选项
     * @param {number} [options.delay=1500] - 两份报告之间的间隔时间（毫秒）
     * @returns {void}
     */
    exportDualReports(physicsHTML, ideologicalHTML, options = {}) {
        const delay = options.delay || 1500;

        // 先导出物理报告
        const firstResult = this.exportToPDF(physicsHTML, '液相旋光法测定蔗糖溶液比旋光度_物理实验报告');

        if (firstResult) {
            // 延迟后导出思政报告
            setTimeout(() => {
                this.exportToPDF(ideologicalHTML, '国计民生中的测量精度与工匠精神_课程思政学习报告');
            }, delay);
        } else {
            console.warn('[ReportPDF] 第一份报告导出未成功，跳过第二份');
        }
    },

    /**
     * 检测当前环境是否支持打印功能
     *
     * @public
     * @returns {Object} 支持状态信息
     */
    checkSupport() {
        const hasWindow = typeof window !== 'undefined';
        const hasDocument = typeof document !== 'undefined';
        const hasPrint = hasWindow && typeof window.print === 'function';
        const hasBlob = typeof Blob !== 'undefined';
        const hasURL = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

        return {
            supported: hasPrint,
            details: {
                hasWindow,
                hasDocument,
                hasPrintMethod: hasPrint,
                hasBlobAPI: hasBlob,
                hasCreateObjectURL: hasURL
            },
            recommendedMethod: hasPrint ? 'window.print()' : 'downloadAsHTML'
        };
    }
};

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportPDF;
}
