const script = {
    // --- 序章：身份选择 ---
    "START": {
        img: "assets/start_bg.png",
        text: "<b>【15世纪：马六甲的崛起】</b><br>位于东西方贸易要道上的马六甲，正从一个小渔村发展为东南亚贸易中心。这里充满机遇与危机。<br><br>请选择你的历史身份：",
        btns: [
            { t: "1. 爪哇商人 (财富与商路的开拓者)", next: "MER_1", effect: () => { gameState.role = '商人'; gameState.wealth = 50; gameState.security = 40; gameState.diplomacy = 50; gameState.religion = 30; } },
            { t: "2. 敦吡叻副官 (国家防御的执行官)", next: "ADJ_1", effect: () => { gameState.role = '副官'; gameState.wealth = 40; gameState.security = 50; gameState.diplomacy = 50; gameState.religion = 40; } },
            { t: "3. 阿拉伯传教士 (文化与信仰的播种者)", next: "MIS_1", effect: () => { gameState.role = '传教士'; gameState.wealth = 40; gameState.security = 40; gameState.diplomacy = 50; gameState.religion = 50; } }
        ]
    },

    // --- 路径 A：爪哇商人 ---
    "MER_1": {
        img: "assets/mer_arrival.png",
        text: "<b>【入港的选择】</b><br>你的船队满载檀香与香料。马六甲河口已设立关卡。港务官正审视着你的货物。你决定：",
        btns: [
            { t: "按章纳税并在官方货厂租赁仓库", next: "MER_2", effect: () => { gameState.wealth -= 10; gameState.security += 10; gameState.diplomacy += 10; } },
            { t: "私下联络腐败官员逃税以博取暴利", next: "MER_2", effect: () => { gameState.wealth += 30; gameState.security -= 15; gameState.diplomacy -= 15; } },
            { t: "将部分香料作为珍玩进贡给王室，寻求特许", next: "MER_2", effect: () => { gameState.wealth -= 20; gameState.diplomacy += 15; gameState.security += 5; } }
        ]
    },

    "MER_2": {
        img: "assets/mer_bazaar.png",
        text: "<b>【巴刹的纷争】</b><br>在马六甲的市场，你遇到了语言障碍。同时，不同国家的商人对货币成色争执不下。你打算：",
        btns: [
            { t: "主动推广使用官方金银锡币并学习马来语", next: "MER_PRE_AI", effect: () => { gameState.wealth += 15; gameState.diplomacy += 10; gameState.security += 10; } },
            { t: "暗中建立黑市交易圈，拒绝使用官方货币", next: "MER_PRE_AI", effect: () => { gameState.wealth += 40; gameState.diplomacy -= 20; gameState.security -= 20; } },
            { t: "设立临时翻译与兑换摊位协助其他外商", next: "MER_PRE_AI", effect: () => { gameState.wealth += 5; gameState.diplomacy += 5; gameState.security += 15; } }
        ]
    },

    "MER_PRE_AI": {
        img: "assets/mer_office_ext.png",
        text: "<b>【最终交涉】</b><br>你在马六甲已积攒了不少私产，但若想获得更优惠的长期经营权，必须面对掌握港口秩序的港务官。",
        btns: [
            { t: "求见“港务官”，开启最后的利益博弈", next: "AI_MERCHANT", effect: () => {} }
        ]
    },

    // --- 路径 B：敦吡叻副官 ---
    "ADJ_1": {
        img: "assets/adj_defense.png",
        text: "<b>【防御策论】</b><br>暹罗大军压境的消息传来。作为防务核心，你对防御工事的建议是：",
        btns: [
            { t: "立即派出使者，向北方的中国明朝寻求外交干预", next: "ADJ_2", effect: () => { gameState.diplomacy += 15; gameState.security += 5; } },
            { t: "在红树林设置火攻陷阱，但不向外界求援以显独立", next: "ADJ_2", effect: () => { gameState.security += 15; gameState.diplomacy -= 10; } },
            { t: "强行征召外商武装家丁参战，扩充临时兵员", next: "ADJ_2", effect: () => { gameState.security += 20; gameState.diplomacy -= 20; gameState.wealth -= 10; } }
        ]
    },

    "ADJ_2": {
        img: "assets/adj_ming_fleet.png",
        text: "<b>【大国平衡】</b><br>郑和的宝船舰队停靠在马六甲。明朝的力量足以震慑暹罗。你建议：",
        btns: [
            { t: "划出土地让明朝建立“官厂”，换取全方位保护", next: "ADJ_PRE_AI", effect: () => { gameState.diplomacy += 15; gameState.security += 10; } },
            { t: "对明朝使团保持距离，试图自行组建远洋舰队", next: "ADJ_PRE_AI", effect: () => { gameState.security += 15; gameState.diplomacy -= 20; gameState.wealth -= 20; } },
            { t: "利用明朝到来的时机，向周边小国强行索要贡品", next: "ADJ_PRE_AI", effect: () => { gameState.wealth += 20; gameState.diplomacy -= 20; gameState.security += 10; } }
        ]
    },

    "ADJ_PRE_AI": {
        img: "assets/adj_tent_ext.png",
        text: "<b>【最终交涉】</b><br>虽然你手中握有兵权，但马六甲的存亡更取决于能否获得大明帝国的真正信任。",
        btns: [
            { t: "进入大明帅帐，求见大使郑和", next: "AI_ADJUTANT", effect: () => {} }
        ]
    },

    // --- 路径 C：阿拉伯传教士 ---
    "MIS_1": {
        img: "assets/mis_preach.png",
        text: "<b>【真理之种】</b><br>马六甲正处于文化交汇点。你希望将信仰融入这个多元社会。你的第一步行动是：",
        btns: [
            { t: "向苏丹分析伊斯兰教在团结贸易网络上的战略价值", next: "MIS_2", effect: () => { gameState.religion += 10; gameState.diplomacy += 10; } },
            { t: "在街头通过激烈辩论否定当地传统神灵", next: "MIS_2", effect: () => { gameState.religion += 25; gameState.diplomacy -= 20; gameState.security -= 10; } },
            { t: "在市集中心建立医疗站，先通过善行赢取民众", next: "MIS_2", effect: () => { gameState.religion += 5; gameState.diplomacy += 15; gameState.security += 5; } }
        ]
    },

    "MIS_2": {
        img: "assets/mis_study.png",
        text: "<b>【学术与根基】</b><br>苏丹对你的学识表示赞赏，但在确立国教的问题上依然犹豫。你提出：",
        btns: [
            { t: "协助王室建立经文研究中心，培养受过教育的官僚", next: "MIS_PRE_AI", effect: () => { gameState.religion += 15; gameState.diplomacy += 10; } },
            { t: "要求苏丹立即废除一切异教神像，强力推行教法", next: "MIS_PRE_AI", effect: () => { gameState.religion += 25; gameState.diplomacy -= 25; gameState.security -= 15; } },
            { t: "推动穆斯林商人与本地望族通婚，实现和平交融", next: "MIS_PRE_AI", effect: () => { gameState.religion += 5; gameState.diplomacy += 20; } }
        ]
    },

    "MIS_PRE_AI": {
        img: "assets/mis_palace_ext.png",
        text: "<b>【最终交涉】</b><br>马六甲的灵魂走向正悬于一线。只有苏丹的正式支持，才能让这里成为真正的“小麦加”。",
        btns: [
            { t: "步入金碧辉煌的大殿，求见苏丹目札法沙", next: "AI_MISSIONARY", effect: () => {} }
        ]
    },

    // --- AI 对话入口 ---
    "AI_MERCHANT": {
        img: "assets/npc_harbor_master.png",
        text: "<b>【港务衙门】</b><br>你站在威严的港务官面前，准备为你的商队争取更多的利益与便利。",
        btns: [
            { t: "开始交涉...", next: "AI_MERCHANT" }
        ]
    },

    "AI_ADJUTANT": {
        img: "assets/npc_zheng_he.png",
        text: "<b>【大明官厂】</b><br>你来到大明使臣郑和的营帐，试图说服他给予马六甲更多的军事和政治保护。",
        btns: [
            { t: "开始交涉...", next: "AI_ADJUTANT" }
        ]
    },

    "AI_MISSIONARY": {
        img: "assets/npc_sultan.png",
        text: "<b>【皇宫大殿】</b><br>你觐见苏丹目札法沙，准备提出将伊斯兰教定为国教的伟大构想。",
        btns: [
            { t: "开始交涉...", next: "AI_MISSIONARY" }
        ]
    },

    "ENDING": {
        img: "",
        text: "", // 由 JS 动态生成
        btns: [{ t: "🏁 返回大厅，开启新的一局", next: "MENU" }]
    }
};
