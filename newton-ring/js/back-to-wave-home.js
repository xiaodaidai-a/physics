(function () {
    function getWaveOpticsHomeUrl() {
        return new URL('../', document.baseURI).href;
    }

    function wireBackToWaveHome() {
        const homeUrl = getWaveOpticsHomeUrl();
        document.querySelectorAll('a.back-link, a.back-button').forEach((anchor) => {
            const href = (anchor.getAttribute('href') || '').trim();
            if (href === 'index.html' || href === '../index.html') {
                anchor.href = homeUrl;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireBackToWaveHome);
    } else {
        wireBackToWaveHome();
    }

    window.getWaveOpticsHomeUrl = getWaveOpticsHomeUrl;
})();
