(() => {
  const home = new URL('./', document.currentScript.src);
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href*="teacher-dashboard.html"]').forEach(a => a.remove());
    const modal = document.getElementById('loginModalOverlay');
    if (modal) modal.hidden = true;
    const missing = ["videos/education.mp4"];
    document.querySelectorAll('video').forEach(video => {
      const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src');
      if (!src) return;
      const url = new URL(src, document.baseURI);
      if (missing.some(file => decodeURI(url.pathname) === decodeURI(new URL(file, home).pathname))) {
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach(source => source.remove());
        video.load();
        const message = document.createElement('p');
        message.textContent = '此教学视频暂未收录到在线展示版，请使用实验原理与仿真操作页面。';
        video.replaceWith(message);
      }
    });
  });
})();
