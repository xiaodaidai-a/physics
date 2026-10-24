(function () {
    var current = document.currentScript;
    if (!current || !current.src) return;

    var platformBase = current.src.replace(/\/js\/load-ai-assistant\.js(?:\?.*)?$/, '');
    var siteRoot = platformBase.replace(/\/液相旋光虚拟仿真实验平台$/, '');

    function loadScript(url, onload) {
        var s = document.createElement('script');
        s.src = url;
        s.onload = onload || null;
        s.onerror = function () {
            console.error('[AI助手] 脚本加载失败:', url);
        };
        document.head.appendChild(s);
    }

    loadScript(siteRoot + '/ai/js/ai-chat-config-polarization.js', function () {
        loadScript(siteRoot + '/ai/js/ai-chat.js');
    });
})();
