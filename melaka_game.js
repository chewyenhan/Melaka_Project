// ==========================================
// 1. 核心状态与初始化
// ==========================================
const gameState = {
    role: '', 
    wealth: 50,          // 财富
    security: 50,        // 安全
    diplomacy: 50,       // 外交
    religion: 50,        // 宗教
    choiceHistory: [],   // 关键选择记录，用于结局复盘
    keywordHit: false,   // AI 判定机制：是否说中历史关键词
    hearts: 3            // 剩余谈判机会
};

let customApiKey = ""; let gData = []; let cIdx = -1; let aiCnt = 0;
let speechVolume = 0.8;
let speakSeq = 0;

// ==========================================
// 2. 本地音效与语音控制 (沿用 1789 逻辑)
// ==========================================
function controlBGM(action = 'start') {
    const bgm = document.getElementById('bg-music');
    if (!bgm) return;
    
    if (action === 'start') {
        const sliderVal = document.getElementById('vol-drum').value;
        bgm.volume = Math.pow(parseFloat(sliderVal), 3) * 0.1; 
        bgm.play().catch(e => console.log("等待激活"));
    } else {
        bgm.pause();
        bgm.currentTime = 0;
    }
}

document.getElementById('vol-drum')?.addEventListener('input', function() {
    const bgm = document.getElementById('bg-music');
    if (bgm) {
        bgm.volume = Math.pow(parseFloat(this.value), 3) * 0.1; 
    }
});

function playEffect() {
    const vol = document.getElementById('vol-drum')?.value || 0.2;
    if (vol <= 0) return;
    createBeep(vol);
}

function createBeep(volume) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine'; 
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(volume * 0.2, audioCtx.currentTime); 
        
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1); 
    } catch (e) {
        console.log("Web Audio API 不支持或被拦截");
    }
}

let systemVoices = [];
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        systemVoices = window.speechSynthesis.getVoices();
    };
}

function speak(txt) {
    if (!('speechSynthesis' in window)) return;
    
    const slider = document.getElementById('vol-speech');
    const v = slider ? parseFloat(slider.value) : speechVolume;
    speechVolume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : speechVolume;
    
    window.speechSynthesis.cancel();
    if (speechVolume <= 0) return;

    const seq = ++speakSeq;
    setTimeout(() => {
        if (seq !== speakSeq) return;
        const u = new SpeechSynthesisUtterance(txt.replace(/<[^>]*>?/gm, ''));
        u.lang = 'zh-CN';
        u.volume = speechVolume;
        
        if (systemVoices.length === 0) {
            systemVoices = window.speechSynthesis.getVoices();
        }
        // 优先寻找中文语音
        const zhVoice = systemVoices.find(voice => 
            voice.lang.replace('_', '-').toLowerCase().includes('zh') || 
            voice.name.toLowerCase().includes('chinese') ||
            voice.name.includes('中文')
        );
        if (zhVoice) {
            u.voice = zhVoice;
        }

        window.speechSynthesis.speak(u);
    }, 60);
}

document.getElementById('vol-speech')?.addEventListener('input', function() {
    const v = parseFloat(this.value);
    speechVolume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : speechVolume;
    if ('speechSynthesis' in window) {
        if (speechVolume <= 0) {
            window.speechSynthesis.cancel();
        }
    }
});

// ==========================================
// 3. AI 提示词构建
// ==========================================
function buildKingPrompt(playerInput) {
    let npc = "";
    let background = "";
    let focusStats = "";
    let isLow = false;

    if (gameState.role === "商人") {
        npc = "港务官";
        // 港务官不在乎你个人赚了多少钱，他只在乎你是否遵守外交礼仪与保障港口安全
        focusStats = `外交(${gameState.diplomacy})和安全(${gameState.security})`;
        background = "你是马六甲专门处理各地商人商务与移民事项的官员。玩家希望你提供优惠税率。";
        if(gameState.diplomacy < 45 || gameState.security < 45) isLow = true;
    } else if (gameState.role === "副官") {
        npc = "大明使臣郑和";
        // 郑和不在乎你个人掌握了多少兵权，他在乎的是马六甲作为大明属国的稳定与外交诚意
        focusStats = `外交(${gameState.diplomacy})和安全(${gameState.security})`;
        background = "你是大明使臣郑和，奉命七次下西洋停泊在马六甲。玩家希望大明提供军事保护以牵制暹罗。";
        if(gameState.diplomacy < 45 || gameState.security < 45) isLow = true;
    } else if (gameState.role === "传教士") {
        npc = "苏丹目札法沙";
        // 苏丹不在乎你有多狂热，他在乎的是宗教是否能带来外交上的盟友与国内的和谐
        focusStats = `外交(${gameState.diplomacy})和宗教核心价值(${gameState.religion})`;
        background = "你是马六甲统治者。玩家希望你定伊斯兰教为国教。";
        if(gameState.diplomacy < 45 || gameState.religion < 45) isLow = true;
    }

    let toneInstr = isLow 
        ? "\n⚠️ 警告：玩家之前的表现极差（核心数值过低），你现在对他充满了厌恶和不耐烦。你的语气要非常严厉，可以大骂他的无能和之前的错误决策。在这种状态下，除非他能说出极其惊艳的历史关键知识点，否则绝不让他【交涉成功】。"
        : "\n注意：如果上述核心数值低于50，说明他之前的决策有误，你会感到不悦，增加说服难度。";

    return `你扮演15世纪的【${npc}】。面对的是一名马六甲的【${gameState.role}】。
背景设定：${background}
当前核心数值：${focusStats}。${toneInstr}
判定规则：如果玩家的话完全打动了你（不仅满足背景设定中的关键词，且结合了当前的局势逻辑），请在回复的最末尾加上【交涉成功】四个字。如果没有完全打动你，或者数值太低你不信任他，请进行驳斥或提出进一步要求，千万不要加上【交涉成功】。
要求：严禁脱离历史人物身份，回复50字内。
玩家说：${playerInput}`;
}

// 检查玩家输入是否包含课文知识点
function checkKeywords(msg) {
    const keywordsMap = {
        "商人": ["84种", "语言", "金币", "银币", "锡币", "巡查", "客栈", "货厂", "仓库", "马来语"],
        "副官": ["暹罗", "明朝", "尹庆", "郑和", "营寨", "官厂", "黄伞", "诰印", "彩衣", "进贡", "称臣"],
        "传教士": ["小麦加", "巴塞", "国教", "研究中心", "阿拉伯", "印度", "伊斯兰", "繁荣", "通婚"]
    };
    
    const roleKeywords = keywordsMap[gameState.role] || [];
    if (roleKeywords.some(k => msg.includes(k))) {
        gameState.keywordHit = true;
    }
}

// ==========================================
// 4. 游戏引擎逻辑
// ==========================================
function startGroup(i) {
    cIdx = i; aiCnt = 0;
    controlBGM('start');
    playEffect();

    // 初始化数值
    gameState.role = ''; 
    gameState.wealth = 50; 
    gameState.security = 50;
    gameState.diplomacy = 50; 
    gameState.religion = 50; 
    gameState.choiceHistory = [];
    gameState.keywordHit = false;
    gameState.hearts = 3;

    document.getElementById('hearts-display').innerText = '❤️❤️❤️';
    document.getElementById('choice-area').style.display = 'block'; 
    document.getElementById('ai-area').style.display = 'none';
    document.getElementById('chat-box').innerHTML = '';
    document.getElementById('final-revolt').style.display = 'none';
    const inp = document.getElementById('ai-input');
    if (inp) {
        inp.disabled = false;
        inp.placeholder = "开始交涉...";
    }
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '';
        sendBtn.style.cursor = '';
    }
    document.getElementById('show-gname').innerText = `当前玩家：${gData[i].name}`;
    
    updateStatusDisplay();
    runScene("START"); 
    showP('p-game');
}

let toastTimer = null;
function showToast(html, ms = 1600) {
    const el = document.getElementById('custom-toast');
    if (!el) return;
    el.innerHTML = html;
    el.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
}

function snapshotCoreStats() {
    return {
        wealth: gameState.wealth,
        security: gameState.security,
        diplomacy: gameState.diplomacy,
        religion: gameState.religion
    };
}

function diffStats(before, after) {
    const keys = ['wealth', 'security', 'diplomacy', 'religion'];
    const d = {};
    keys.forEach(k => d[k] = (after[k] ?? 0) - (before[k] ?? 0));
    return d;
}

function formatDelta(label, v, emoji) {
    if (!v) return "";
    const sign = v > 0 ? "+" : "";
    return `${emoji}${label}${sign}${v}`;
}

function recordChoice({ sceneId, choiceText, deltas }) {
    gameState.choiceHistory.push({
        t: choiceText,
        sid: sceneId,
        at: Date.now(),
        d: deltas
    });
    if (gameState.choiceHistory.length > 30) gameState.choiceHistory.shift();
}

function runScene(sid) {
    if(sid === "MENU") { 
        controlBGM('stop'); 
        if (gData[cIdx]) gData[cIdx].done = true; 
        renderMenu(); 
        showP('p-menu'); 
        return; 
    }

    const s = script[sid];
    if(!s) return;

    const txt = document.getElementById('story-text');
    const area = document.getElementById('choice-area');
    const imgArea = document.getElementById('scene-img-area'); 

    if (imgArea) {
        imgArea.innerHTML = ''; 
        if (s.img) {
            const imgEl = document.createElement('img');
            imgEl.src = s.img;
            imgEl.className = 'scene-img';
            imgArea.appendChild(imgEl);
        }
    }
    
    if(sid.startsWith("AI_")) {
        playEffect();
        txt.innerHTML = s.text;
        document.getElementById('choice-area').style.display = 'none';
        document.getElementById('ai-area').style.display = 'flex';
        document.getElementById('final-revolt').style.display = 'none';
        
        let npcName = "";
        if (gameState.role === "商人") npcName = "港务官";
        else if (gameState.role === "副官") npcName = "大明使臣郑和";
        else if (gameState.role === "传教士") npcName = "苏丹目札法沙";
        
        speak(`${npcName}看着你，等待你的发言。`);

        if (!customApiKey) {
            const fr = document.getElementById('final-revolt');
            fr.innerText = "⚠️ 未设置API：直接查看结局";
            fr.style.display = 'block';
        }
    } else if (sid === "ENDING") {
        playEffect();
        const endingHtml = buildEndingHtml();
        txt.innerHTML = endingHtml;
        
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = endingHtml;
        const textToSpeak = tempDiv.innerText || tempDiv.textContent;
        speak(textToSpeak.replace(/💡.*/, ''));
        
        document.getElementById('choice-area').style.display = 'block';
        document.getElementById('ai-area').style.display = 'none';
        area.innerHTML = '';
        s.btns.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerText = b.t;
            btn.onclick = () => {
                playEffect();
                if(b.effect) b.effect();
                updateStatusDisplay();
                runScene(b.next);
            };
            area.appendChild(btn);
        });
    } else {
        document.getElementById('choice-area').style.display = 'block';
        document.getElementById('ai-area').style.display = 'none';
        const fr = document.getElementById('final-revolt');
        if (fr) {
            fr.style.display = 'none';
        }
        txt.innerHTML = s.text;
        speak(s.text);
        area.innerHTML = '';
        
        s.btns.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerText = b.t;
            btn.onclick = () => {
                playEffect();
                const before = snapshotCoreStats();
                if(b.effect) b.effect();
                const after = snapshotCoreStats();
                const d = diffStats(before, after);

                recordChoice({ sceneId: sid, choiceText: b.t, deltas: d });
                const parts = [
                    formatDelta('财富', d.wealth, '💰'),
                    formatDelta('安全', d.security, '🛡️'),
                    formatDelta('外交', d.diplomacy, '🤝'),
                    formatDelta('宗教', d.religion, '🕌'),
                ].filter(Boolean);
                if (parts.length) {
                    showToast(`<b>数值变动</b><br>${parts.join(' ｜ ')}`);
                }
                updateStatusDisplay();
                runScene(b.next); 
            };
            area.appendChild(btn);
        });
    }
}

function judgeAIEnding() {
    runScene("ENDING");
}

function buildEndingHtml() {
    const role = gameState.role || "无名氏";
    let title = "";
    let body = "";
    let tag = "";

    if (gameState.keywordHit) {
        title = "【全盛结局：东南亚的明珠】";
        tag = "交涉成功";
        body = `你运用精准的历史洞察力，成功说服了对方。<br>
        你的建议契合了历史的发展潮流。马六甲迎来了空前的繁荣：商船云集，八十四种语言在巴刹交汇，金银锡币流通顺畅，大明的黄伞与官厂保障了和平，伊斯兰教在这里生根发芽，马六甲成为名副其实的“小麦加”。<br>
        作为一名<b>${role}</b>，你促成了这个伟大的黄金时代！`;
    } else {
        title = "【衰落结局：风雨飘摇】";
        tag = "交涉失败";
        body = `你的言辞空洞无物，未能打动对方。<br>
        由于缺乏远见卓识的政策和强有力的外部保护，马六甲未能抓住历史的机遇。外有暹罗的持续施压，内有商业秩序的混乱，这片东方十字路口的辉煌逐渐黯淡。<br>
        作为一名<b>${role}</b>，你无奈地见证了王国的衰落。`;
    }

    const picks = (gameState.choiceHistory || []).slice(-3);
    const recap = picks.length
        ? `<div class="ending-body" style="margin-top:14px; background: rgba(0, 51, 102, 0.1);">
            <div style="font-size:1.2em; font-weight:900; margin-bottom:8px; color: #003366;">你的历程回顾</div>
            ${picks.map(x => {
                const dd = x.d || {};
                const p = [
                    formatDelta('财富', dd.wealth, '💰'),
                    formatDelta('安全', dd.security, '🛡️'),
                    formatDelta('外交', dd.diplomacy, '🤝'),
                    formatDelta('宗教', dd.religion, '🕌'),
                ].filter(Boolean).join(' ｜ ');
                return `<div style="margin:10px 0; color: #4a2e15;">
                    <div style="font-weight:900;">- ${x.t}</div>
                    <div style="opacity:0.9; font-size:1.1em;">${p || "（无明显变化）"}</div>
                </div>`;
            }).join('')}
          </div>`
        : "";

    return `
        <b style="color: #003366; font-size: 1.2em;">${title}</b><br>
        <div class="ending-meta">身份：<b>${role}</b> ｜ 标签：<b style="color: #cc0000;">${tag}</b></div>
        <div class="ending-body" style="color: #1a1a1a;">${body}</div>
        ${recap}
        <div class="ending-tip" style="color: #003366;">💡 历史课文提示：与关键NPC交涉时，如果能提及课本上的核心要素（如：84种语言、金银锡币、黄伞、官厂、小麦加等），将大幅提高说服成功率！</div>
    `;
}
    
// ==========================================
// 5. API 通信与对话系统
// ==========================================
async function detectModels() {
    const keyInput = document.getElementById('api-key-input').value.trim();
    if(!keyInput) { alert("请先输入 API Key！"); return; }
    customApiKey = keyInput;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${customApiKey}`);
        const data = await response.json();
        const select = document.getElementById('model-select');
        select.innerHTML = '';
        data.models.forEach(m => {
            if(m.name.includes('gemini')) {
                const opt = document.createElement('option');
                opt.value = m.name.replace('models/', '');
                opt.text = m.displayName || m.name;
                select.appendChild(opt);
            }
        });
        select.style.display = 'inline-block';
        alert("✅ API 检测成功！");
    } catch (err) { alert("❌ 检测失败"); }
}

async function chatWithKing() {
    const inp = document.getElementById('ai-input');
    const box = document.getElementById('chat-box');
    const msg = inp.value.trim();
    if(!msg || !customApiKey) return;
    if (aiCnt >= 3) return;
    if (inp && inp.disabled) return;
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn && sendBtn.disabled) return;

    box.innerHTML += `<div class='msg user'><b>${gameState.role}:</b> ${msg}</div>`;
    inp.value = '';
    
    const prompt = buildKingPrompt(msg);
    const model = document.getElementById('model-select').value;
    
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${customApiKey}`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await resp.json();
        let replayRaw = data.candidates[0].content.parts[0].text;
        
        let isSuccess = replayRaw.includes("交涉成功");
        let replay = replayRaw.replace(/【交涉成功】/g, "").replace(/\[交涉成功\]/g, "").replace(/交涉成功/g, "").trim();
        
        gameState.hearts--;
        let heartStr = "";
        for(let h=0; h<gameState.hearts; h++) heartStr += "❤️";
        for(let h=gameState.hearts; h<3; h++) heartStr += "🤍";
        if (document.getElementById('hearts-display')) {
            document.getElementById('hearts-display').innerText = heartStr;
        }
        
        let npcName = "";
        if (gameState.role === "商人") npcName = "港务官";
        else if (gameState.role === "副官") npcName = "大明使臣郑和";
        else if (gameState.role === "传教士") npcName = "苏丹";

        box.innerHTML += `<div class='msg king'><b>${npcName}:</b> ${replay}</div>`;
        speak(replay);
        aiCnt++;
        
        const fr = document.getElementById('final-revolt');
        
        if (isSuccess) {
            gameState.keywordHit = true;
            inp.disabled = true;
            if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.6'; sendBtn.style.cursor = 'not-allowed'; }
            inp.placeholder = "交涉成功！";
            fr.innerText = "📜 对方已被说服，查看结局";
            fr.style.display = 'block';

        } else if (gameState.hearts <= 0) {
            gameState.keywordHit = false;
            inp.disabled = true;
            if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.6'; sendBtn.style.cursor = 'not-allowed'; }
            inp.placeholder = "交涉破裂！";
            fr.innerText = "📜 机会耗尽，查看结局";
            fr.style.display = 'block';

        }
    } catch (e) {
        box.innerHTML += `<div class='msg'>（对方沉默不语，请检查API连接或网络状态）</div>`;
        document.getElementById('final-revolt').style.display = 'block';
    }
    box.scrollTop = box.scrollHeight;
}

function handleEnter(event) {
    if (event.key === "Enter") {
        const inp = document.getElementById('ai-input');
        if (inp && !inp.disabled && aiCnt < 3) chatWithKing();
    }
}

// ==========================================
// 6. 系统底层辅助 (UI 实时刷新显示)
// ==========================================
function judgeAIEnding() {
    runScene('ENDING');
}

function updateStatusDisplay() {
    // 自动修正数值范围 (0-150)
    ['wealth', 'security', 'diplomacy', 'religion'].forEach(k => {
        gameState[k] = Math.max(0, Math.min(150, gameState[k]));
    });

    const el = document.getElementById('show-stat');
    if(el) {
        el.innerHTML = `💰财富:${gameState.wealth} | 🛡️安全:${gameState.security} | 🤝外交:${gameState.diplomacy} | 🕌宗教:${gameState.religion}`;
    }
}

function initAll() { showP('p-setup'); }

function goNaming() {
    const count = document.getElementById('g-count').value;
    const container = document.getElementById('name-container');
    container.innerHTML = '';
    for(let i=1; i<=count; i++) {
        container.innerHTML += `<div style='margin-bottom:15px;'>玩家 ${i}: <input type='text' id='gn-${i}' class='group-input' style='width:60%;'></div>`;
    }
    showP('p-naming');
}

function saveGroups() {
    const ins = document.querySelectorAll('#name-container input');
    gData = [];
    ins.forEach(it => gData.push({ name: it.value || '匿名航海家', done: false }));
    renderMenu(); showP('p-menu');
}

function renderMenu() {
    const list = document.getElementById('group-list');
    list.innerHTML = '';
    gData.forEach((g, i) => {
        const b = document.createElement('button');
        b.className = 'sys-btn';
        b.innerHTML = g.done ? `✅ ${g.name}` : `🚢 进入港口：【${g.name}】`;
        b.disabled = g.done;
        b.onclick = () => startGroup(i);
        list.appendChild(b);
    });
}

function showP(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    } else {
        console.error("找不到 ID 为 " + id + " 的面板");
    }
}
