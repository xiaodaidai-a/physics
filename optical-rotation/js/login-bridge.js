(function applyLoginBridgeFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const bridgeUser = params.get('bridgeUser');
    const bridgeToken = params.get('bridgeToken');
    let changed = false;

    if (bridgeUser) {
        try {
            localStorage.setItem('currentUser', bridgeUser);
            changed = true;
        } catch (e) {
            console.warn('login-bridge: bridgeUser 无效', e);
        }
    }

    if (bridgeToken) {
        try {
            localStorage.setItem('auth_token', bridgeToken);
            changed = true;
        } catch (e) {
            console.warn('login-bridge: bridgeToken 无效', e);
        }
    }

    if (!changed) return;

    params.delete('bridgeUser');
    params.delete('bridgeToken');
    const qs = params.toString();
    const nextUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    history.replaceState(null, '', nextUrl);
})();
