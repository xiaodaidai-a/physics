/**
 * 基于多智能体教学辅助的偏振光与蔗糖旋光现象仿真实验平台 - 主应用逻辑模块
 * 负责导航栏、Toast提示、返回顶部、页面动画、视频播放器增强、标签页切换、数据导出等功能
 */

(function () {
    'use strict';

    // ==================== 导航栏功能 ====================

    /**
     * 初始化导航栏
     * 滚动时添加阴影效果，移动端汉堡菜单切换，当前页面高亮
     */
    function initNavbar() {
        const navbar = document.querySelector('.navbar');
        const navToggle = document.querySelector('.nav-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (!navbar) return;

        // 滚动监听：添加阴影效果
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
        }, { passive: true });

        // 移动端汉堡菜单切换
        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                const isOpen = navLinks.classList.toggle('nav-open');
                navToggle.classList.toggle('active', isOpen);
                // 无障碍属性更新
                navToggle.setAttribute('aria-expanded', String(isOpen));
            });

            // 点击导航链接后关闭移动端菜单
            const linkItems = navLinks.querySelectorAll('.nav-link');
            linkItems.forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('nav-open');
                    navToggle.classList.remove('active');
                    navToggle.setAttribute('aria-expanded', 'false');
                });
            });

            // 点击页面其他区域关闭移动端菜单
            document.addEventListener('click', (e) => {
                if (!navbar.contains(e.target)) {
                    navLinks.classList.remove('nav-open');
                    navToggle.classList.remove('active');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }

    /**
     * 设置当前激活的导航项
     * @param {string} pageId - 页面标识符: 'home' | 'theory' | 'malus' | 'polar3d' | 'experiment' | 'analysis' | 'ideological' | 'contact'
     */
    function setActiveNav(pageId) {
        if (!pageId || typeof pageId !== 'string') return;

        const allNavLinks = document.querySelectorAll('.nav-link');
        allNavLinks.forEach(link => {
            link.classList.remove('active');
        });

        const targetLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
        if (targetLink) {
            targetLink.classList.add('active');
        }
    }

    // ==================== Toast 提示系统 ====================

    /**
     * 显示 Toast 提示消息
     * @param {string} message - 提示文本内容
     * @param {'success'|'error'|'warning'|'info'} type - 提示类型，默认 'info'
     * @param {number} duration - 显示时长(毫秒)，默认 3000
     */
    function showToast(message, type = 'info', duration = 3000) {
        if (typeof message !== 'string') return;

        const validTypes = ['success', 'error', 'warning', 'info'];
        const safeType = validTypes.includes(type) ? type : 'info';
        const safeDuration = typeof duration === 'number' && duration > 0 ? duration : 3000;

        // 确保容器存在
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.setAttribute('role', 'status');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }

        // 创建 toast 元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${safeType}`;

        // 图标映射
        const iconMap = {
            success: '&#10003;',
            error: '&#10007;',
            warning: '&#9888;',
            info: '&#8505;'
        };

        toast.innerHTML = `
            <span class="toast-icon">${iconMap[safeType] || ''}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="关闭提示">&times;</button>
        `;

        container.appendChild(toast);

        // 触发入场动画（使用 requestAnimationFrame 确保 DOM 已插入）
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // 关闭按钮事件
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => removeToast(toast));
        }

        // 自动移除
        setTimeout(() => removeToast(toast), safeDuration);
    }

    /**
     * 移除 Toast 元素
     * @param {HTMLElement} toastEl - 要移除的 toast DOM 元素
     */
    function removeToast(toastEl) {
        if (!toastEl || !toastEl.parentNode) return;
        toastEl.classList.remove('toast-show');
        toastEl.classList.add('toast-hide');

        // 动画结束后从 DOM 中移除
        toastEl.addEventListener('transitionend', () => {
            if (toastEl.parentNode) {
                toastEl.parentNode.removeChild(toastEl);
            }
        }, { once: true });

        // 兜底：如果 transitionend 未触发（如 display:none），延迟移除
        setTimeout(() => {
            if (toastEl.parentNode) {
                toastEl.parentNode.removeChild(toastEl);
            }
        }, 400);
    }

    // ==================== 返回顶部按钮 ====================

    /**
     * 初始化返回顶部按钮
     * scrollY > 300 时显示按钮，点击平滑滚动到顶部
     */
    function initBackToTop() {
        let btn = document.querySelector('.back-to-top');

        // 如果不存在则创建
        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'back-to-top';
            btn.innerHTML = '&uarr;';
            btn.setAttribute('aria-label', '返回顶部');
            btn.setAttribute('title', '返回顶部');
            document.body.appendChild(btn);
        }

        // 滚动显示/隐藏
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }, { passive: true });

        // 点击返回顶部
        btn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ==================== 页面动画 ====================

    /**
     * 初始化页面进入动画
     * 使用 IntersectionObserver 为 .fade-in 元素添加视口进入时的动画类
     */
    function initPageAnimations() {
        const fadeElements = document.querySelectorAll('.fade-in');
        if (fadeElements.length === 0) return;

        // 检查浏览器是否支持 IntersectionObserver
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('fade-in-visible');
                        observer.unobserve(entry.target); // 动画只触发一次
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            fadeElements.forEach(el => observer.observe(el));
        } else {
            // 降级处理：直接显示所有元素
            fadeElements.forEach(el => el.classList.add('fade-in-visible'));
        }
    }

    // ==================== 视频播放器增强 ====================

    /**
     * 初始化视频播放器增强功能
     * 为所有 .video-container 中的 video 元素添加自定义覆盖层和交互
     */
    function initVideoPlayers() {
        const containers = document.querySelectorAll('.video-container');
        if (containers.length === 0) return;

        containers.forEach(container => {
            const video = container.querySelector('video');
            if (!video) return;

            // 创建或查找覆盖层
            let overlay = container.querySelector('.video-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'video-overlay';
                overlay.innerHTML = '<span class="play-icon">&#9658;</span>';
                container.appendChild(overlay);
            }

            // 播放/暂停状态同步
            const updateOverlay = () => {
                if (video.paused || video.ended) {
                    overlay.classList.add('visible');
                } else {
                    overlay.classList.remove('visible');
                }
            };

            // 覆盖层点击：切换播放/暂停
            overlay.addEventListener('click', () => {
                if (video.paused) {
                    video.play().catch(() => {
                        showToast('视频播放失败，请检查文件路径', 'warning');
                    });
                } else {
                    video.pause();
                }
            });

            // 视频事件监听
            video.addEventListener('play', updateOverlay);
            video.addEventListener('pause', updateOverlay);
            video.addEventListener('ended', updateOverlay);

            // 初始状态
            updateOverlay();

            // 双击全屏
            video.addEventListener('dblclick', () => toggleFullScreen(video));

            // 全屏按钮（如果存在）
            const fullscreenBtn = container.querySelector('.fullscreen-btn');
            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', () => toggleFullScreen(video));
            }
        });
    }

    /**
     * 切换元素的全屏状态
     * @param {HTMLElement} element - 需要全屏的元素
     */
    function toggleFullScreen(element) {
        if (!element || !document.fullscreenEnabled) return;

        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(() => {
                showToast('无法进入全屏模式', 'warning');
            });
        } else {
            document.exitFullscreen();
        }
    }

    // ==================== 标签页切换器 ====================

    /**
     * 初始化标签页切换功能
     * 监听 [data-tab] 按钮，切换 [data-tab-panel] 的显示/隐藏
     */
    function initTabs() {
        const tabButtons = document.querySelectorAll('[data-tab]');
        if (tabButtons.length === 0) return;

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                if (!tabId) return;

                // 获取所属标签组（通过 data-tab-group 或父容器）
                const group = btn.closest('[data-tab-group]') || btn.parentElement?.parentElement;
                if (!group) return; // 防止 group 为 null

                // 清除同组内所有按钮的 active 状态
                const siblingBtns = group.querySelectorAll('[data-tab]');
                siblingBtns.forEach(b => b.classList.remove('active'));

                // 设置当前按钮为 active
                btn.classList.add('active');

                // 隐藏同组所有面板
                const panels = group.querySelectorAll('[data-tab-panel]');
                panels.forEach(panel => panel.classList.remove('active'));

                // 显示目标面板
                const targetPanel = group.querySelector(`[data-tab-panel="${tabId}"]`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    // ==================== 数据导出工具 ====================

    /**
     * 将数据导出为 JSON 文件并下载
     * @param {*} data - 要导出的数据对象
     * @param {string} filename - 下载文件名（不含扩展名）
     */
    function exportToJSON(data, filename) {
        if (data === undefined || data === null) {
            showToast('没有可导出的数据', 'warning');
            return;
        }

        const safeName = typeof filename === 'string' && filename.trim()
            ? filename.trim()
            : 'export';

        try {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}.json`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // 清理
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) {
                    document.body.removeChild(a);
                }
            }, 100);

            showToast(`文件 "${safeName}.json" 已开始下载`, 'success');
        } catch (err) {
            showToast('导出失败：' + err.message, 'error');
        }
    }

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本内容
     * @returns {Promise<boolean>} 是否复制成功
     */
    async function copyToClipboard(text) {
        if (typeof text !== 'string' || text.length === 0) {
            showToast('没有可复制的内容', 'warning');
            return false;
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                showToast('已复制到剪贴板', 'success');
                return true;
            } else {
                // 降级方案：使用 textarea + execCommand
                fallbackCopy(text);
                showToast('已复制到剪贴板', 'success');
                return true;
            }
        } catch (err) {
            // 降级方案
            try {
                fallbackCopy(text);
                showToast('已复制到剪贴板', 'success');
                return true;
            } catch (fallbackErr) {
                showToast('复制失败：' + fallbackErr.message, 'error');
                return false;
            }
        }
    }

    /**
     * 降级的剪贴板复制方法（兼容旧浏览器）
     * @param {string} text - 要复制的文本
     */
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!success) {
            throw new Error('execCommand 复制失败');
        }
    }

    // ==================== 导出到全局作用域 ====================
    // 将需要外部调用的函数挂载到全局对象上

    window.App = {
        setActiveNav,
        showToast,
        exportToJSON,
        copyToClipboard,
        initTabs,
        initPageAnimations
    };

    // ==================== 初始化入口 ====================

    document.addEventListener('DOMContentLoaded', () => {
        initNavbar();
        initBackToTop();
        initPageAnimations();
        initVideoPlayers();
        initTabs();
        console.log('[app] 应用初始化完成');
    });

})();
