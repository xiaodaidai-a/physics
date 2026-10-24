/**
 * AI 智能助手模块 - 内置知识库版
 * 无需外部 API，基于关键词匹配 + 模板回复
 */
(function() {
    'use strict';

    // ==================== 内置知识库 ====================
    var KNOWLEDGE_BASE = [
        {
            keywords: ['什么是偏振', '偏振光', '偏振定义', '偏振是什么', '光的偏振'],
            answer: '<strong>偏振（Polarization）</strong>是横波的一种特性。自然光在垂直于传播方向的平面内各个方向振动均匀分布，而偏振光则只在特定方向振动。<br><br>常见的偏振方式有：<br>&bull; <strong>线偏振光</strong>：振动方向固定在一个平面内<br>&bull; <strong>圆偏振光</strong>：电场矢量端点做圆周运动<br>&bull; <strong>椭圆偏振光</strong>：电场矢量端点做椭圆运动<br><br>在本实验中，我们主要研究<strong>线偏振光</strong>通过旋光性物质后的行为变化。',
            tag: '理论'
        },
        {
            keywords: ['起偏器', '检偏器', '偏振片', 'polarizer', 'analyzer'],
            answer: '<strong>起偏器（Polarizer）</strong>和<strong>检偏器（Analyzer）</strong>是偏振实验中的两个核心元件：<br><br>&bull; <strong>起偏器</strong>：将自然光转换为线偏振光，只允许某一方向的振动分量通过<br>&bull; <strong>检偏器</strong>：检测光的偏振状态，通过旋转可以测量偏振方向<br><br>当起偏器与检偏器的透振方向<strong>平行</strong>时，光强最大；当两者<strong>垂直（正交）</strong>时，出现<strong>完全消光</strong>现象——这正是本实验判断消光位置的原理依据。',
            tag: '器件'
        },
        {
            keywords: ['马吕斯定律', "malus", '马吕斯', '光强公式', 'I=I0'],
            answer: '<strong>马吕斯定律（Malus\'s Law）</strong>描述了线偏振光通过检偏器后的光强变化规律：<br><br><div style="text-align:center;padding:10px;background:rgba(59,130,246,0.05);border-radius:8px;margin:8px 0;font-size:1.05em;">I = I\u2080 \u00B7 cos\u00B2\u03B8</div><br>其中：<br>&bull; I\u2080 — 入射到检偏器的偏振光强度<br>&bull; \u03B8 — 起偏器与检偏器透振方向的夹角<br>&bull; I — 通过检偏器后的光强<br><br>当 \u03B8 = 0\u00B0 时，I = I\u2080（最大）；当 \u03B8 = 90\u00B0 时，I = 0（完全消光）。你可以前往「马吕斯验证」模块交互式体验这一定律。',
            tag: '理论'
        },
        {
            keywords: ['旋光', '旋光度', '旋光性', 'optical rotation', '比旋光度'],
            answer: '<strong>旋光性（Optical Activity）</strong>是指某些物质能使通过它的偏振光的振动面发生旋转的现象。<br><br>关键概念：<br><br>&bull; <strong>旋光度 \u03B1</strong>：偏振面旋转的角度，单位为度（\u00B0）<br>&bull; <strong>比旋光度 [\u03B1]</strong>：单位长度、单位浓度下的旋光度，计算公式：<br><div style="text-align:center;padding:8px;background:rgba(139,92,246,0.06);border-radius:8px;margin:8px 0;">[\u03B1]\u1D7C\u209C = \u03B1 / (L \u00B7 c)</div><br>L 为光程长度(dm)，c 为溶液浓度(g/mL)<br><br>蔗糖的比旋光度约为 <strong>+66.5\u00B0\u00B7mL/(dm\u00B7g)</strong>（钠 D 线，20\u00B0C），右旋为正。',
            tag: '核心'
        },
        {
            keywords: ['三分视场', '半影法', '视场', '暗界', '亮度', '等亮'],
            answer: '<strong>三分视场（Tripartite Field）</strong>是精密旋光仪的核心观测方法，采用半波片将视野分为三个区域：<br><br><div style="display:flex;gap:8px;justify-content:center;margin:10px 0;"><span style="padding:6px 14px;border-radius:6px;background:#E2E8F0;color:#475569;font-size:12px;">左暗中亮右暗</span></div><br>三种典型状态：<br>&bull; <strong>等亮位置</strong>（\u03B8=0）：三部分亮度相同，人眼对亮度的微小差异最敏感，此位置读数精度最高<br>&bull; <strong>明-暗分界明显</strong>：两侧与中间有明显边界<br>&bull; <strong>完全消光</strong>：整体最暗但不易精确判断零点<br><br>本实验的3D模拟完整还原了三分视场的视觉效果，点击底部工具栏的「目镜视角」即可观察。',
            tag: '操作'
        },
        {
            keywords: ['实验步骤', '操作流程', '怎么用', '如何操作', '使用方法', '怎么做实验'],
            answer: '<strong>本实验的标准操作流程：</strong><br><br><strong>第一步 - 调零：</strong>不放样品管，旋转检偏器找到等亮位置，记录初始角度 \u03B8\u2080<br><br><strong>第二步 - 放样：</strong>装入待测蔗糖溶液样品管<br><br><strong>第三步 - 测量：</strong>再次旋转检偏器找到新的等亮位置，记录角度 \u03B8\u2081<br><br><strong>第四步 - 计算：</strong>旋光度 \u03B1 = \u03B8\u2081 - \u03B8\u2080，再代入公式求浓度或比旋光度<br><br>💡 <em>提示：在本3D实验室中，你可以直接操作左侧任务面板引导完成全部步骤。</em>',
            tag: '操作'
        },
        {
            keywords: ['误差', '系统误差', '随机误差', '准确度', '精度', '不确定度'],
            answer: '<strong>旋光实验的主要误差来源：</strong><br><br><strong>1. 系统误差：</strong><br>&bull; 仪器零点漂移 → 解决：每次测量前调零<br>&bull; 样品管壁的双折射效应 → 解决：使用高质量石英管<br>&bull; 温度影响比旋光度 → 解决：恒温条件下测量<br><br><strong>2. 随机误差：</strong><br>&bull; 人眼判断等亮位置的主观偏差 → 解决：多次测量取平均<br>&bull; 读数估读误差 → 解决：估读到 0.01\u00B0<br>&bull> 溶液浓度不均匀 → 解决：充分搅拌溶解<br><br>📊 详细的误差分析功能可在「数据分析」页面的第③模块中使用。',
            tag: '分析'
        },
        {
            keywords: ['蔗糖', '糖', '溶液', '浓度', 'c', '配置', '配制'],
            answer: '<strong>蔗糖溶液是本实验的标准样品：</strong><br><br>常用参数：<br>&bull; 分子式：C\u2081\u2082H\u2082\u2082O\u2081\u2081<br>&bull; 摩尔质量：342.30 g/mol<br>&bull; 推荐浓度范围：0.1 ~ 0.5 g/mL<br>&bull; 建议配制的标准浓度：0.1、0.15、0.20、0.25、0.30 g/mL<br><br>⚠️ 注意事项：<br>&bull; 使用蒸馏水配制，避免杂质引入额外旋光性<br>&bull> 充分溶解后静置排除气泡<br>&bull; 测量前确保溶液温度稳定（推荐 20\u00B0C ± 2\u00B0C）',
            tag: '样品'
        },
        {
            keywords: ['3d', '三维', '视角', '旋转', '缩放', '拖拽', '操作场景'],
            answer: '<strong>3D 实验室的操作指南：</strong><br><br><strong>视角控制：</strong><br>&bull; 🖱️ <strong>左键拖拽</strong>：旋转视角（绕中心点 orbit）<br>&bull; 🖱️ <strong>滚轮</strong>：缩放视图<br>&bull; 🖱️ <strong>右键拖拽</strong>：平移视图<br><br><strong>底部工具栏按钮：</strong><br>&bull; 「重置视角」— 回到默认观察位置<br>&bull; 「网格」— 切换坐标网格显示/隐藏<br>&bull; 「目镜视角」— 打开三分视场观测窗口<br>&bull; 「帮助」— 显示操作提示<br><br>左侧面板显示当前任务进度，按步骤操作即可完成实验。',
            tag: '操作'
        },
        {
            keywords: ['你好', 'hello', 'hi', '嗨', '您好', '帮助', 'help', '你是谁', '什么'],
            answer: '你好！我是<strong>AI 实验助手</strong>，专门为你解答关于<strong>液相旋光虚拟仿真实验</strong>的问题。<br><br>我可以帮你解答以下方面的问题：<br><br>&bull; 🔬 <strong>理论知识</strong>：偏振、旋光、马吕斯定律...<br>&bull; ⚙️ <strong>器件原理</strong>：起偏器、检偏器、旋光仪结构...<br>&bull; 📋 <strong>操作指导</strong>：实验步骤、三分视场判断...<br>&bull; 📊 <strong>数据分析</strong>：误差来源、数据处理方法...<br>&bull; 🧪 <strong>样品知识</strong>：蔗糖溶液配制要点...<br><br>直接输入你的问题即可，我会尽力为你解答！',
            tag: '问候'
        }
    ];

    // ==================== 状态 ====================
    var isOpen = false;
    var isTyping = false;
    var chatHistory = [];

    // ==================== DOM 引用 ====================
    function getBtn() { return document.getElementById('aiToggleBtn'); }
    function getPanel() { return document.getElementById('aiAssistantPanel'); }
    function getInput() { return document.getElementById('aiInput'); }
    function getMessages() { return document.getElementById('aiMessages'); }

    // ==================== 切换面板 ====================
    window.toggleAIAssistant = function() {
        var panel = getPanel();
        if (!panel) return;

        isOpen = !isOpen;

        if (isOpen) {
            panel.classList.add('ai-panel-open');
            // 首次打开时发送欢迎语
            if (chatHistory.length === 0) {
                setTimeout(function() {
                    appendMessage('bot', '你好！我是你的 AI 实验助手 👋<br>有什么关于<strong>3D 偏振模拟实验</strong>的问题都可以问我。试试输入「实验步骤」或「什么是旋光」？');
                }, 350);
            }
            setTimeout(function() {
                if (getInput()) getInput().focus();
            }, 450);
        } else {
            panel.classList.remove('ai-panel-open');
        }
    };

    // ==================== 关闭面板 ====================
    window.closeAIPanel = function() {
        var panel = getPanel();
        if (!panel) return;
        isOpen = false;
        panel.classList.remove('ai-panel-open');
    };

    // ==================== 发送消息 ====================
    window.sendAIMessage = function() {
        var input = getInput();
        if (!input) return;
        var text = input.value.trim();
        if (!text || isTyping) return;

        // 用户消息
        appendMessage('user', text);
        input.value = '';

        // 匹配回答
        isTyping = true;
        showAIThinking();

        // 模拟思考延迟（思考阶段）
        var thinkTime = 600 + Math.random() * 900;
        setTimeout(function() {
            removeAIThinking();
            var reply = findAnswer(text);
            typeBotMessage(reply);  // 逐字打字效果
        }, thinkTime);
    };

    // ==================== 关键词匹配引擎 ====================
    function findAnswer(query) {
        var q = query.toLowerCase().replace(/\s+/g, '');

        // 精确匹配
        for (var i = 0; i < KNOWLEDGE_BASE.length; i++) {
            var item = KNOWLEDGE_BASE[i];
            for (var j = 0; j < item.keywords.length; j++) {
                if (q.indexOf(item.keywords[j].toLowerCase()) !== -1) {
                    return item.answer;
                }
            }
        }

        // 模糊匹配：计算关键词重叠度
        var bestScore = 0;
        var bestAnswer = null;
        var queryChars = q.split('');

        for (var k = 0; k < KNOWLEDGE_BASE.length; k++) {
            var item = KNOWLEDGE_BASE[k];
            var score = 0;
            for (var m = 0; m < item.keywords.length; m++) {
                var kw = item.keywords[m];
                // 计算公共字符比例
                var common = 0;
                for (var n = 0; n < kw.length; n++) {
                    if (q.indexOf(kw[n]) !== -1) common++;
                }
                score = Math.max(score, common / Math.max(kw.length, 1));
            }
            if (score > bestScore && score > 0.25) {
                bestScore = score;
                bestAnswer = item.answer;
            }
        }

        if (bestAnswer) return bestAnswer;

        // 兜底回复
        var fallbacks = [
            '这个问题我暂时没有找到最佳匹配答案 😅<br><br>不过你可以尝试问我这些：<br>&bull; 「什么是偏振光」<br>&bull; 「马吕斯定律是什么」<br>&bull; 「如何进行实验」<br>&bull; 「三分视场怎么看」<br>&bull; 「误差来源有哪些」',
            '抱歉，我还在学习中 📚<br><br>建议你尝试更具体的关键词，比如：<br>&bull; 旋光性的原理<br>&bull; 蔗糖溶液配制<br>&bull; 实验操作步骤<br>&bull; 3D 场景操作指南',
            '这个话题超出了我的知识范围 🤔<br><br>我的强项是<strong>光学偏振</strong>和<strong>旋光实验</strong>相关问题。你可以问问我：<br>&bull; 理论知识（偏振、马吕斯定律）<br>&bull; 操作方法（实验步骤、三分视场）<br>&bull; 数据处理（误差分析、公式计算）'
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // ==================== 消息渲染（用户消息：直接显示） ====================
    function appendMessage(role, html) {
        var container = getMessages();
        if (!container) return;

        chatHistory.push({ role: role, content: html });

        var msgDiv = document.createElement('div');
        msgDiv.className = 'ai-msg ai-msg-' + role;
        msgDiv.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.28s cubic-bezier(0.22,1,0.36,1);';

        var avatar = role === 'bot'
            ? '<div class="ai-avatar ai-avatar-bot">&#129302;</div>'
            : '<div class="ai-avatar ai-avatar-user">&#128100;</div>';

        var bubble = document.createElement('div');
        bubble.className = 'ai-bubble ai-bubble-' + role;
        bubble.innerHTML = html;

        var timeLabel = document.createElement('div');
        timeLabel.className = 'ai-msg-time';
        timeLabel.textContent = formatTime();

        msgDiv.innerHTML = avatar;
        msgDiv.appendChild(bubble);
        msgDiv.appendChild(timeLabel);
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        requestAnimationFrame(function() {
            msgDiv.style.opacity = '1';
            msgDiv.style.transform = 'translateY(0)';
        });
    }

    // ==================== AI 思考中动画（增强版） ====================
    function showAIThinking() {
        var container = getMessages();
        if (!container) return;

        // 移除空状态提示
        var emptyHint = container.querySelector('.ai-empty-hint');
        if (emptyHint) emptyHint.style.display = 'none';

        var div = document.createElement('div');
        div.className = 'ai-msg ai-msg-bot';
        div.id = 'ai-thinking';
        div.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.3s ease;';

        // 思考动画内容
        var thinkTexts = ['正在检索知识库', '分析问题语义', '组织回答内容'];
        var randomThink = thinkTexts[Math.floor(Math.random() * thinkTexts.length)];

        div.innerHTML =
            '<div class="ai-avatar ai-avatar-bot" style="position:relative;">' +
                '&#129302;' +
                '<span class="ai-think-pulse"></span>' +
            '</div>' +
            '<div class="ai-bubble ai-bubble-bot">' +
                '<div style="display:flex;align-items:center;gap:8px;padding:2px 0;">' +
                    '<div class="ai-think-brain">&#129504;</div>' +
                    '<span class="ai-think-text">' + randomThink + '</span>' +
                    '<span class="ai-think-dots"><i></i><i></i><i></i></span>' +
                '</div>' +
            '</div>';

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        // 入场动画
        requestAnimationFrame(function() {
            div.style.opacity = '1';
            div.style.transform = 'translateY(0)';
        });

        // 思考文字轮换（每 1.5s 切换一句）
        div._thinkInterval = setInterval(function() {
            var textEl = div.querySelector('.ai-think-text');
            if (textEl) {
                var idx = (thinkTexts.indexOf(textEl.textContent) + 1) % thinkTexts.length;
                textEl.style.opacity = '0';
                setTimeout(function() {
                    textEl.textContent = thinkTexts[idx];
                    textEl.style.opacity = '1';
                }, 200);
            }
        }, 1500);
    }

    function removeAIThinking() {
        var el = document.getElementById('ai-thinking');
        if (el) {
            if (el._thinkInterval) clearInterval(el._thinkInterval);
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
            setTimeout(function() { if (el.parentNode) el.remove(); }, 250);
        }
    }

    // ==================== Bot 消息逐字打字效果 ====================
    function typeBotMessage(html) {
        var container = getMessages();
        if (!container) return;

        chatHistory.push({ role: 'bot', content: html });

        // 创建消息容器
        var msgDiv = document.createElement('div');
        msgDiv.className = 'ai-msg ai-msg-bot';
        msgDiv.id = 'ai-typing-msg';
        msgDiv.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.28s cubic-bezier(0.22,1,0.36,1);';

        var avatarHtml = '<div class="ai-avatar ai-avatar-bot">&#129302;</div>';
        var bubble = document.createElement('div');
        bubble.className = 'ai-bubble ai-bubble-bot';
        bubble.innerHTML = '';  // 初始为空，逐字填充

        var timeLabel = document.createElement('div');
        timeLabel.className = 'ai-msg-time';
        timeLabel.textContent = formatTime();

        msgDiv.innerHTML = avatarHtml;
        msgDiv.appendChild(bubble);
        msgDiv.appendChild(timeLabel);
        container.appendChild(msgDiv);

        // 入场动画
        requestAnimationFrame(function() {
            msgDiv.style.opacity = '1';
            msgDiv.style.transform = 'translateY(0)';
        });

        // 解析 HTML 并逐字输出
        typeHTML(bubble, html, function() {
            isTyping = false;
            // 打字完成后添加光标闪烁效果结束
            var cursor = bubble.querySelector('.ai-type-cursor');
            if (cursor) cursor.remove();
        });
    }

    /**
     * 核心：将 HTML 字符串解析后逐字符/逐标签输出到目标元素
     * 策略：用隐藏的临时 DOM 解析 HTML → 提取文本节点 → 逐字显示
     */
    function typeHTML(targetEl, htmlStr, onComplete) {
        // 创建临时解析器
        var parser = document.createElement('div');
        parser.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
        parser.innerHTML = htmlStr;
        document.body.appendChild(parser);

        // 收集所有需要输出的片段 [{type:'html'|'text', content:''}]
        var segments = [];
        walkDOM(parser, segments);
        document.body.removeChild(parser);

        // 如果没有内容
        if (segments.length === 0) {
            targetEl.innerHTML = htmlStr;
            if (onComplete) onComplete();
            return;
        }

        var segIdx = 0;
        var charIdx = 0;
        var currentSeg = segments[0];
        var textBuffer = '';   // 已输出的纯文本累积（用于 innerHTML）
        var tagBuffer = [];   // 已输出的标签累积

        // 光标元素
        var cursorSpan = document.createElement('span');
        cursorSpan.className = 'ai-type-cursor';
        cursorSpan.style.cssText =
            'display:inline-block;width:2px;height:1em;background:#3B82F6;' +
            'vertical-align:text-bottom;margin-left:1px;animation:typeCursorBlink 0.7s step-end infinite;';
        targetEl.appendChild(cursorSpan);

        // 打字速度配置
        var BASE_SPEED = 32;       // 基础间隔 ms
        var PUNCT_SPEED = 120;     // 标点符号停顿
        var TAG_INSTANT = true;    // 标签瞬间完成
        var LINE_BREAK_PAUSE = 80; // <br> 后微停

        // 标点集合（中文 + 英文）
        var punctSet = new Set(['。', '，', '！', '？', '；', '：', '、', '…', '.', ',', '!', '?', ';', ':']);

        function nextChar() {
            if (segIdx >= segments.length) {
                // 全部输出完毕
                if (onComplete) onComplete();
                return;
            }

            currentSeg = segments[segIdx];

            if (currentSeg.type === 'html') {
                // HTML 标签：直接追加到 buffer
                tagBuffer.push(currentSeg.content);
                rebuildHTML();
                segIdx++;
                setTimeout(nextChar, TAG_INSTANT ? 5 : 20);
                return;
            }

            // 文本节点：逐字输出
            var text = currentSeg.content;
            if (charIdx >= text.length) {
                // 当前段落完毕
                segIdx++;
                charIdx = 0;
                setTimeout(nextChar, LINE_BREAK_PAUSE);
                return;
            }

            var ch = text[charIdx];
            charIdx++;

            // 转义特殊字符用于显示
            var displayCh = ch === '&' ? '&amp;' : (ch === '<' ? '&lt;' : (ch === '>' ? '&gt;' : ch));
            textBuffer += displayCh;
            rebuildHTML();

            // 计算下一个字符延迟
            var delay = punctSet.has(ch) ? PUNCT_SPEED : (BASE_SPEED + Math.random() * 18);
            setTimeout(nextChar, delay);
        }

        // 重建 innerHTML：按顺序拼接所有已输出内容
        function rebuildHTML() {
            var output = '';
            for (var t = 0; t < tagBuffer.length; t++) output += tagBuffer[t];
            output += textBuffer;
            targetEl.innerHTML = output;
            targetEl.appendChild(cursorSpan);  // 保持光标在末尾
            autoScroll(container);
        }

        // 启动打字
        setTimeout(nextChar, 150);
    }

    /**
     * 递归遍历 DOM 节点，提取文本和标签片段
     */
    function walkDOM(node, segments) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.nodeType === Node.TEXT_NODE) {
                var txt = child.textContent;
                if (txt.trim()) {
                    segments.push({ type: 'text', content: txt });
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // 开始标签
                var outerStart = '';
                for (var a = 0; a < child.attributes.length; a++) {
                    outerStart += ' ' + child.attributes[a].name + '="' + child.attributes[a].value + '"';
                }
                segments.push({ type: 'html', content: '<' + child.nodeName.toLowerCase() + outerStart + '>' });

                // 递归子节点
                walkDOM(child, segments);

                // 结束标签
                segments.push({ type: 'html', content: '</' + child.nodeName.toLowerCase() + '>' });
            }
        }
    }

    function autoScroll(container) {
        if (!container) return;
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }

    // ==================== 旧版打字指示器（保留兼容） ====================
    function showTypingIndicator() { showAIThinking(); }
    function removeTypingIndicator() { removeAIThinking(); }

    // ==================== 工具函数 ====================
    function formatTime() {
        var d = new Date();
        var h = d.getHours().toString().padStart(2, '0');
        var m = d.getMinutes().toString().padStart(2, '0');
        return h + ':' + m;
    }

    // ==================== 快捷问题 ====================
    window.aiQuickAsk = function(question) {
        var input = getInput();
        if (input) {
            input.value = question;
            sendAIMessage();
        }
    };

    // ==================== 键盘事件 ====================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen) {
            closeAIPanel();
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            var input = getInput();
            if (input && document.activeElement === input) {
                e.preventDefault();
                sendAIMessage();
            }
        }
    });

    console.log('[coze-assistant] AI 助手模块已加载 | 内置知识库: ' + KNOWLEDGE_BASE.length + ' 条规则');

})();
