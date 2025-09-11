// 文件路径: netlify/functions/get-ai-analysis.js (带有“真话药剂”的最终调试版)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

exports.handler = async function (event, context) {
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
        { "role": "user", "content": `请根据以下信息，为我生成一段题目解析。解析需要包含：知识点回顾、解题思路、易错点分析。\n---\n题目信息：\n- 核心知识点: ${keyPoint}\n- 题目内容: ${question}\n- 正确答案: ${correctAnswer}\n---\n请开始你的解析：` }
      ]
    };

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // --- ↓↓↓ “真话药剂”在这里！ ↓↓↓ ---
    // 如果 API 的响应不成功 (比如 401, 402, 500 等错误)
    if (!response.ok) {
      // 我们先读取并打印出 DeepSeek 返回的真实错误信息
      const errorBody = await response.text();
      console.error('DeepSeek API 返回了错误:', response.status, response.statusText, errorBody);
      // 然后再抛出我们自己的错误
      throw new Error(`DeepSeek API 服务响应失败，状态码: ${response.status}`);
    }
    // --- ↑↑↑ “真话药剂”在这里！ ↑↑↑ ---

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ analysis: analysisText }),
    };
  } catch (error) {
    console.error("AI 解析时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "调用 AI 解析失败。" }),
    };
  }
};