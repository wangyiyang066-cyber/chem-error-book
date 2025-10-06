// 文件路径: netlify/functions/get-ai-analysis.js (最终版 - 强制注入化学老师角色)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// ▼▼▼ 核心改动：将我们的黄金提示词定义在后端 ▼▼▼
const systemPrompt = { 
  "role": "system", 
  "content": "你是一名资深的初三化学老师，擅长用清晰、易懂、循循善诱的方式解释复杂的化学问题。你的任务是为学生答错的题目生成高质量的解析和后续问答。请始终保持专业、耐心、友好的老师身份。" 
};
// ▲▲▲ 核心改动结束 ▲▲▲

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端接收用户的消息历史记录
    const { messages } = JSON.parse(event.body);
    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: "请求体中必须包含 messages 数组。" };
    }

    // ▼▼▼ 核心改动：智能地组合最终要发送的消息列表 ▼▼▼
    // 将我们的系统提示词，与前端传来的用户对话历史，合并成一个完整的列表
    const finalMessages = [
      systemPrompt, 
      ...messages 
    ];
    // ▲▲▲ 核心改动结束 ▲▲▲

    const apiEndpoint = 'https://api.deepseek.com/chat/completions';
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: finalMessages, // 发送我们组合后的、带有“化学老师”角色的消息列表
        stream: true
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('DeepSeek API returned an error:', response.status, errorBody);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: response.body
    };
    
  } catch (error) {
    console.error("AI 解析时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "调用 AI 解析失败。" }),
    };
  }
};