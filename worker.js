// ==========================================
// Cloudflare Worker — 马六甲计划 Gemini API 安全代理
// 1. 把 API Key 藏在 Worker 环境变量里，学生无需手动输入
// 2. 限制调用来源，仅放行正式发布的 GitHub Pages 域名及本地调试域名
// ==========================================

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // --- 安全验证：域名白名单过滤 ---
    const isAllowed =
      origin === 'https://chewyenhan.github.io' ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin === 'null' || // 允许双击本地 html 文件直接运行 (Origin 为 "null")
      origin === '';       // 允许无 Origin 的直接调用 (如 curl 测试)

    if (!isAllowed) {
      return new Response('CORS Blocked: Unauthorized Origin', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // --- CORS 预检 ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // --- 端点 1: 获取模型列表 ---
    if (url.pathname === '/models' && request.method === 'GET') {
      const models = {
        models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash (推荐)' },
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
          { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
          { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' }
        ]
      };
      return new Response(JSON.stringify(models), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- 端点 2: Gemini 对话 ---
    if (url.pathname === '/gemini' && request.method === 'POST') {
      try {
        const body = await request.json();
        const model = body.model || 'gemini-2.5-flash';

        const geminiBody = {
          contents: body.contents
        };

        if (body.system_instruction) {
          geminiBody.system_instruction = body.system_instruction;
        }

        if (body.generationConfig) {
          geminiBody.generationConfig = body.generationConfig;
        }

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': env.GEMINI_API_KEY
            },
            body: JSON.stringify(geminiBody)
          }
        );

        return new Response(await resp.text(), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'AI 请求失败: ' + e.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // --- 其他路径 ---
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
