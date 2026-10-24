/**
 * 支持视频 Range 请求的 Node.js 静态文件服务器
 * 用法: node serve.js [端口]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 5000;
const ROOT = __dirname;

// MIME 类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    // 视频/音频（关键：支持 Range 请求）
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4v': 'video/mp4',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function parseRange(rangeHeader, fileSize) {
    // Range: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)?/);
    if (!match) return null;

    let start = match[1] ? parseInt(match[1]) : 0;
    let end = match[2] ? parseInt(match[2]) : fileSize - 1;

    // 边界检查
    start = Math.max(0, start);
    end = Math.min(end, fileSize - 1);

    if (start >= fileSize) return null;

    return { start, end, length: end - start + 1 };
}

const server = http.createServer((req, res) => {
    // 解析 URL，防止目录遍历
    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 安全处理：限制在项目根目录内
    if (pathname.includes('..')) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    // 默认首页
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.join(ROOT, pathname);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // 尝试找 index.html（用于 SPA 路由）
            const dirPath = path.join(ROOT, pathname, 'index.html');
            fs.stat(dirPath, (err2, stats2) => {
                if (err2 || !stats2.isFile()) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found: ' + pathname);
                    return;
                }
                serveFile(dirPath, stats2, req, res);
            });
            return;
        }

        serveFile(filePath, stats, req, res);
    });
});

function serveFile(filePath, stats, req, res) {
    const mimeType = getMimeType(filePath);
    const fileSize = stats.size;

    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    // 处理 Range 请求（视频播放关键！）
    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
        const range = parseRange(rangeHeader, fileSize);

        if (!range) {
            // 无效的 Range
            res.writeHead(416, {
                'Content-Range': `bytes */${fileSize}`,
                'Content-Type': mimeType,
            });
            res.end();
            return;
        }

        // 206 Partial Content
        const statusCode = 206;
        res.writeHead(statusCode, {
            'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': range.length,
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600',
        });

        const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
        stream.pipe(res);
        stream.on('error', () => {
            res.end();
        });
    } else {
        // 普通 200 响应
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600',
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('error', () => {
            res.end();
        });
    }
}

server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log(`  Node.js Static Server (Range Support)`);
    console.log(`  Port : ${PORT}`);
    console.log(`  Root : ${ROOT}`);
    console.log(`  URL  : http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');

    // 视频文件检测
    const videoFiles = ['ideo-video.mp4', '思政视频.mp4'];
    videoFiles.forEach(vf => {
        const vp = path.join(ROOT, vf);
        try {
            const s = fs.statSync(vp);
            const mb = (s.size / 1048576).toFixed(1);
            console.log(`  [video] ${vf} (${mb} MB) ✓`);
        } catch (e) {
            console.log(`  [video] ${vf} ✗ not found`);
        }
    });
    console.log('');
});
