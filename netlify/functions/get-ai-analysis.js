// 文件路径: netlify/functions/get-ai-analysis.js (最终版 - 兼容本地环境)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const systemPrompt = { 
  "role": "system", 
  "content": "你是一名资深的初三化学老师，擅长用清晰、易懂、循循善诱的方式解释复杂的化学问题。你的任务是为学生答错的题目生成高质量的解析和后续问答。请始终保持专业、耐心、友好的老师身份。" 
};

// Netlify Functions 要求 fetch 必须从 node-fetch 导入
const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { messages } = JSON.parse(event.body);
    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: "请求体中必须包含 messages 数组。" };
    }

    const finalMessages = [ systemPrompt, ...messages ];
    const apiEndpoint = 'https://api.deepseek.com/chat/completions';
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: finalMessages,
        stream: true 
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('DeepSeek API returned an error:', response.status, errorBody);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    // ▼▼▼ 核心改动：手动处理数据流，以兼容本地环境 ▼▼▼

    // 注意：这里的 ReadableStream 需要从 'stream' 导入
    const { Readable } = require('stream');

    // 创建一个新的可读流，并将API的响应体导入其中
    const readable = Readable.from(response.body);

    // 将流转换为字符串
    let responseText = '';
    for await (const chunk of readable) {
        responseText += chunk.toString();
    }
    
    // 直接返回完整的字符串，而不是流对象
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/event-stream' }, // 保持 header 类型不变
      body: responseText
    };
    // ▲▲▲ 核心改动结束 ▲▲▲
    
  } catch (error) {
    console.error("AI 解析时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "调用 AI 解析失败。" }),
    };
  }
};