// ==========================================
// Cloudflare Worker — 马六甲计划 Gemini API 代理
// 把 API Key 藏在 Worker 环境变量里，学生无需手动输入
// ==========================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- CORS 预检 ---
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

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
          system_instruction: body.system_instruction,
          contents: body.contents
        };

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
        return new Response(JSON.stringify({ error: 'AI 请求失败' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // --- 其他路径 ---
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
