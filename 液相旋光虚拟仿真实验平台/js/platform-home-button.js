(function () {
    const PLATFORM_SEGMENT = '液相旋光虚拟仿真实验平台';

    function decodePathname() {
        try {
            return decodeURIComponent(window.location.pathname);
        } catch (_) {
            return window.location.pathname;
        }
    }

    function getPlatformIndexUrl() {
        const path = decodePathname();
        const idx = path.indexOf(PLATFORM_SEGMENT);
        if (idx >= 0) {
            const base = path.slice(0, idx + PLATFORM_SEGMENT.length);
            return `${window.location.origin}${base}/index.html`;
        }
        return `${window.location.origin}/${PLATFORM_SEGMENT}/index.html`;
    }

    function isOnPlatformIndex() {
        const path = decodePathname();
        return /液相旋光虚拟仿真实验平台\/?(index\.html)?$/.test(path);
    }

    function getHomeUrl() {
        if (isOnPlatformIndex()) {
            return new URL('../', document.baseURI).href;
        }
        return getPlatformIndexUrl();
    }

    function mountHomeButton() {
        if (document.getElementById('platformHomeFab')) return;

        const link = document.createElement('a');
        link.id = 'platformHomeFab';
        link.className = 'platform-home-fab';
        link.href = getHomeUrl();
        link.title = '返回首页';
        link.setAttribute('aria-label', '返回首页');
        link.innerHTML = '<span class="platform-home-fab-icon" aria-hidden="true">&#8592;</span><span class="platform-home-fab-text">返回首页</span>';

        document.body.appendChild(link);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountHomeButton);
    } else {
        mountHomeButton();
    }
})();
