// 文件路径: netlify/functions/get-ai-analysis.js (超级嗅探器版)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

exports.handler = async function (event, context) {
  console.log('--- [get-ai-analysis] Function started. ---');
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { question, correctAnswer, keyPoint } = JSON.parse(event.body);
    const apiEndpoint = 'https://api.deepseek.com/chat/completions';
    
    const payload = {
      model: "deepseek-chat",
      messages: [
        { "role": "system", "content": "你是一名资深的初三化学老师，擅长用清晰、易懂的方式解释复杂的化学问题。你的任务是为学生答错的题目生成一段高质量的解析。" },
        { "role": "user", "content": `请根据以下信息，为我生成一段题目解析。解析需要包含：知识点回顾、解题思路、易错点分析，请你注意，关注学生的错误选项，思考为什么学生会在这里出错，并据此给出完整解析。\n---\n题目信息：\n- 核心知识点: ${keyPoint}\n- 题目内容: ${question}\n- 正确答案: ${correctAnswer}\n---\n请开始你的解析：` }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    };

    // --- ▼▼▼ 核心嗅探区域 ▼▼▼ ---
    console.log('[DEBUG] Preparing to call DeepSeek API.');
    console.log('[DEBUG] Endpoint:', apiEndpoint);
    // 为了安全，我们不打印完整的密钥，只打印它是否存在以及长度
    console.log('[DEBUG] API Key loaded:', !!DEEPSEEK_API_KEY, 'Length:', DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.length : 0);
    console.log('[DEBUG] Payload being sent:', JSON.stringify(payload, null, 2));

    console.log('[DEBUG] Sending fetch request now...');
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    console.log('[DEBUG] Received a response from DeepSeek API.');
    console.log('[DEBUG] Response Status:', response.status, response.statusText);
    // --- ▲▲▲ 核心嗅探区域结束 ▲▲▲ ---

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('DeepSeek API returned an error:', errorBody);
      throw new Error(`DeepSeek API service responded with status: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    console.log('--- [get-ai-analysis] Function finished successfully. ---');
    return {
      statusCode: 200,
      body: JSON.stringify({ analysis: analysisText }),
    };
  } catch (error) {
    console.error("--- [get-ai-analysis] CRITICAL ERROR caught: ---", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "调用 AI 解析失败。" }),
    };
  }
};