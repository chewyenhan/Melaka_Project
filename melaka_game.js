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
    keywordCount: 0,     // 累计命中不重复关键词数
    usedKeywords: [],    // 已使用的关键词集合（去重）
    requiredKeywordMin: 4, // 最低关键词命中要求
    eventHit: false,     // 是否提及历史事件/概念
    usedEvents: [],      // 已使用的事件/概念集合
    hearts: 3            // 剩余谈判机会
};

let customApiKey = ""; let gData = []; let cIdx = -1; let aiCnt = 0;
let speechVolume = 0.8;
let speakSeq = 0;

const WORKER_URL = 'https://melaka-ai.chewyenhan.workers.dev';

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
    let requiredKwList = "";

    if (gameState.role === "商人") {
        npc = "港务官";
        focusStats = `外交(${gameState.diplomacy})和安全(${gameState.security})`;
        background = "你是马六甲专门处理各地商人商务与移民事项的官员。玩家希望你提供优惠税率。";
        requiredKwList = "【84种语言、金币、银币、锡币、货厂、仓库、马来语、巡查、客栈】";
        if(gameState.diplomacy < 70 || gameState.security < 60) isLow = true;
    } else if (gameState.role === "副官") {
        npc = "大明使臣郑和";
        focusStats = `外交(${gameState.diplomacy})和安全(${gameState.security})`;
        background = "你是大明使臣郑和，奉命七次下西洋停泊在马六甲。玩家希望大明提供军事保护以牵制暹罗。";
        requiredKwList = "【暹罗、明朝、郑和、官厂、黄伞、诰印、进贡、称臣、营寨】";
        if(gameState.diplomacy < 70 || gameState.security < 65) isLow = true;
    } else if (gameState.role === "传教士") {
        npc = "苏丹目札法沙";
        focusStats = `外交(${gameState.diplomacy})和宗教核心价值(${gameState.religion})`;
        background = "你是马六甲统治者。玩家希望你定伊斯兰教为国教。";
        requiredKwList = "【小麦加、巴塞、国教、伊斯兰、研究中心、阿拉伯、印度、繁荣、通婚】";
        if(gameState.diplomacy < 70 || gameState.religion < 70) isLow = true;
    }

    // 统计玩家本回合和累积已使用的关键词
    const remaining = gameState.requiredKeywordMin - gameState.keywordCount;
    const kwStatus = remaining > 0
        ? `\n📊 玩家当前已使用历史关键词：${gameState.keywordCount}/${gameState.requiredKeywordMin}（至少还需要${remaining}个）。`
        : "\n📊 玩家已达成最低关键词要求，但还需逻辑论述充分。";

    let toneInstr = isLow
        ? `\n⚠️ 警告：玩家之前的表现极差（核心数值过低），你现在对他充满了厌恶和不耐烦。你的语气要非常严厉，可以大骂他的无能和之前的错误决策。在这种状态下，除非他使用至少${gameState.requiredKeywordMin}个课文核心关键词并逻辑严密，否则绝不让他【交涉成功】。`
        : `\n⚠️ 注意：即使数值尚可，你也不能轻易被说服。你必须要求玩家在论述中体现具体的课文历史知识。如果他笼统地说"我会让马六甲繁荣"之类空洞的话，你必须追问："你具体打算怎么做？有什么历史依据？"`;

    return `你扮演15世纪的【${npc}】。面对的是一名马六甲的【${gameState.role}】。
背景设定：${background}
当前核心数值：${focusStats}。${toneInstr}
${kwStatus}
核心关键词：${requiredKwList}

判定规则（严格遵守）：
1. 玩家必须在其论述中使用足够的历史课文关键词（上述核心关键词中的至少${gameState.requiredKeywordMin}个），且论述必须符合15世纪马六甲的历史逻辑。
2. 如果玩家的论述笼统空洞（如"相信我"、"我会做好"），你必须要求他提供具体的历史依据，不要直接通过。
3. 只有当玩家用具体的历史知识点、结合当时局势说服了你，才能在回复末尾加上【交涉成功】四个字。
4. 如果没有完全打动你，请进行驳斥或提出进一步要求，千万不要加上【交涉成功】。

要求：严禁脱离历史人物身份，回复80字内。
玩家说：${playerInput}`;
}

// 检查玩家输入是否包含课文知识点（累计去重追踪）
function checkKeywords(msg) {
    const keywordsMap = {
        "商人": ["84种", "语言", "金币", "银币", "锡币", "巡查", "客栈", "货厂", "仓库", "马来语"],
        "副官": ["暹罗", "明朝", "尹庆", "郑和", "营寨", "官厂", "黄伞", "诰印", "彩衣", "进贡", "称臣"],
        "传教士": ["小麦加", "巴塞", "国教", "研究中心", "阿拉伯", "印度", "伊斯兰", "繁荣", "通婚"]
    };

    const roleKeywords = keywordsMap[gameState.role] || [];
    let newHit = false;
    roleKeywords.forEach(k => {
        if (msg.includes(k) && !gameState.usedKeywords.includes(k)) {
            gameState.usedKeywords.push(k);
            gameState.keywordCount++;
            newHit = true;
        }
    });
    if (newHit) {
        gameState.keywordHit = true;
    }
    return newHit;
}

// 检查玩家输入是否包含历史事件/概念（加分项）
function checkEvents(msg) {
    const eventsMap = {
        "商人": ["港务官制度", "多语言贸易", "东西方航线", "海峡贸易", "仓储系统", "关卡税收", "转口贸易", "香料路线", "马六甲海峡"],
        "副官": ["七下西洋", "进贡体系", "暹罗威胁", "宝船舰队", "属国关系", "军事保护", "朝贡贸易", "册封制度", "大明藩属"],
        "传教士": ["巴塞王国", "通婚融合", "贸易网络", "经文教育", "多元社会", "阿拉伯商路", "苏非派", "宗教宽容", "商业中枢"]
    };

    const roleEvents = eventsMap[gameState.role] || [];
    let newEvent = false;
    roleEvents.forEach(e => {
        if (msg.includes(e) && !gameState.usedEvents.includes(e)) {
            gameState.usedEvents.push(e);
            gameState.eventHit = true;
            newEvent = true;
        }
    });
    return newEvent;
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
    gameState.keywordCount = 0;
    gameState.usedKeywords = [];
    gameState.eventHit = false;
    gameState.usedEvents = [];
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
    const kwCount = gameState.keywordCount || 0;
    const evCount = (gameState.usedEvents || []).length;
    const requiredMin = gameState.requiredKeywordMin;

    // 三级结局判定
    if (gameState.keywordHit && kwCount >= 5) {
        // 完美结局：关键词≥5 且 AI 说服成功
        title = "【全盛结局：东南亚的明珠】";
        tag = `交涉完美（关键词${kwCount}个${evCount > 0 ? ' + 事件' + evCount + '个' : ''}）`;
        body = `你运用精准的历史洞察力和丰富的课文知识，成功说服了对方。<br>
        你的建议契合了历史的发展潮流。马六甲迎来了空前的繁荣：商船云集，八十四种语言在巴刹交汇，金银锡币流通顺畅，大明的黄伞与官厂保障了和平，伊斯兰教在这里生根发芽，马六甲成为名副其实的"小麦加"。<br>
        作为一名<b>${role}</b>，你促成了这个伟大的黄金时代！`;
    } else if (gameState.keywordHit && kwCount >= requiredMin) {
        // 合格结局：关键词达标 且 AI 说服成功
        title = "【发展结局：稳步前行】";
        tag = `交涉通过（关键词${kwCount}个，刚好达标）`;
        body = `你的论述包含了基本的历史知识点，成功说服了对方。<br>
        马六甲在你的推动下缓慢发展：贸易和外交有所改善，但因为你未能展现更深的历史洞见，许多潜在机遇未能充分把握。<br>
        作为一名<b>${role}</b>，你勉强及格，但历史本可以更加辉煌。💡下次试试使用更多课文关键词！`;
    } else {
        // 失败结局
        title = "【衰落结局：风雨飘摇】";
        tag = `交涉失败（关键词仅${kwCount}/${requiredMin}个）`;
        body = `你的言辞空洞无物，未能打动对方。<br>
        由于缺乏远见卓识的政策和有力的历史知识支撑，马六甲未能抓住历史的机遇。外有暹罗的持续施压，内有商业秩序的混乱，这片东方十字路口的辉煌逐渐黯淡。<br>
        作为一名<b>${role}</b>，你无奈地见证了王国的衰落。`;
    }

    // 显示已使用的关键词
    const usedKwDisplay = (gameState.usedKeywords || []).length > 0
        ? `<div style="margin-top:10px;padding:8px 12px;background:#e3f2fd;border-radius:8px;font-size:0.95em;">
            📝 你使用的历史关键词：<b>${gameState.usedKeywords.join('、')}</b>
           </div>`
        : `<div style="margin-top:10px;padding:8px 12px;background:#ffebee;border-radius:8px;font-size:0.95em;">
            ⚠️ 你未使用任何课文历史关键词。
           </div>`;

    const usedEvDisplay = (gameState.usedEvents || []).length > 0
        ? `<div style="margin-top:6px;padding:8px 12px;background:#f3e5f5;border-radius:8px;font-size:0.95em;">
            🏛️ 你提及的历史事件/概念：<b>${gameState.usedEvents.join('、')}</b>
           </div>`
        : "";

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
        ${usedKwDisplay}
        ${usedEvDisplay}
        ${recap}
        <div class="ending-tip" style="color: #003366;">💡 历史课文提示：与关键NPC交涉时，必须使用至少 <b>${requiredMin}</b> 个课文核心关键词（如：84种语言、金银锡币、黄伞、官厂、小麦加等），并提及相关历史事件，方能说服对方！</div>
    `;
}
    
// ==========================================
// 5. API 通信与对话系统
// ==========================================
async function detectModels() {
    try {
        const response = await fetch(`${WORKER_URL}/models`);
        const data = await response.json();
        const select = document.getElementById('model-select');
        select.innerHTML = '';
        data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name.replace('models/', '');
            opt.text = m.displayName || m.name;
            select.appendChild(opt);
        });
        select.style.display = 'inline-block';
        // 自动选择第一个模型
        if (select.options.length > 0) {
            select.selectedIndex = 0;
        }
    } catch (err) { console.error("❌ 模型加载失败", err); }
}

async function chatWithKing() {
    const inp = document.getElementById('ai-input');
    const box = document.getElementById('chat-box');
    const msg = inp.value.trim();
    if(!msg) return;
    if (aiCnt >= 3) return;
    if (inp && inp.disabled) return;
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn && sendBtn.disabled) return;

    box.innerHTML += `<div class='msg user'><b>${gameState.role}:</b> ${msg}</div>`;
    inp.value = '';

    // --- 客户端关键词与事件检测 ---
    const keywordJustHit = checkKeywords(msg);
    const eventJustHit = checkEvents(msg);

    // 构建反馈消息
    let feedbackHtml = '';
    const remaining = gameState.requiredKeywordMin - gameState.keywordCount;
    if (keywordJustHit || eventJustHit) {
        let parts = [];
        if (keywordJustHit) {
            parts.push(`📚 历史知识点 +1（累计 ${gameState.keywordCount}/${gameState.requiredKeywordMin}）`);
        }
        if (eventJustHit) {
            parts.push(`🏛️ 历史事件/概念命中！`);
        }
        feedbackHtml = `<div class='msg system' style='background:#e8f5e9;color:#2e7d32;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:0.9em;'>${parts.join(' ｜ ')}</div>`;
    }

    if (remaining > 0 && keywordJustHit) {
        feedbackHtml += `<div class='msg system' style='background:#fff3e0;color:#e65100;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:0.9em;'>⚠️ 还需 <b>${remaining}</b> 个不同的历史关键词才能说服对方</div>`;
    } else if (remaining <= 0 && gameState.keywordCount > 0) {
        feedbackHtml += `<div class='msg system' style='background:#e8f5e9;color:#2e7d32;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:0.9em;'>✅ 历史知识点数量已达标，继续用逻辑说服对方！</div>`;
    }

    if (feedbackHtml) {
        box.innerHTML += feedbackHtml;
    }
    // --- 客户端检测结束 ---

    const prompt = buildKingPrompt(msg);
    const model = document.getElementById('model-select').value;

    try {
        const resp = await fetch(`${WORKER_URL}/gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: model,
                contents: [{ parts: [{ text: prompt }] }] 
            })
        });
        const data = await resp.json();
        let replayRaw = data.candidates[0].content.parts[0].text;

        let isSuccess = replayRaw.includes("交涉成功");
        let replay = replayRaw.replace(/【交涉成功】/g, "").replace(/\[交涉成功\]/g, "").replace(/交涉成功/g, "").trim();

        // --- 客户端强制门槛：即使AI给了成功，关键词不够也拦截 ---
        let blockedByKeyword = false;
        if (isSuccess && gameState.keywordCount < gameState.requiredKeywordMin) {
            isSuccess = false;
            blockedByKeyword = true;
            replay = replay || "你的话虽有几分道理，但缺乏具体的历史依据。";
            box.innerHTML += `<div class='msg system' style='background:#ffebee;color:#c62828;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:0.9em;'>🚫 系统判定：你的论述缺乏足够的历史知识点（${gameState.keywordCount}/${gameState.requiredKeywordMin}），无法说服对方。请尝试使用更多课文关键词！</div>`;
        }
        // --- 客户端门槛结束 ---

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

function initAll() { 
    detectModels();
    showP('p-setup'); 
}

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

function toggleModal(show) {
    const modal = document.getElementById('guide-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
    }
}
