// 文件路径: netlify/functions/get-ai-analysis.js

// 从环境变量中安全地获取你的 DeepSeek API 密钥
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 这是“服务员”的工作手册
exports.handler = async function (event, context) {
  // 规定服务员只接待 POST 类型的点餐请求
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 服务员从顾客（前端）的点餐单（请求）中，解析出需要什么菜（题目信息）
    const { question, correctAnswer, keyPoint } = JSON.parse(event.body);

    // DeepSeek 厨房的地址
    const apiEndpoint = 'https://api.deepseek.com/chat/completions';

    // 服务员按照厨房的规定，写下标准的订单
    const payload = {
      model: "deepseek-chat",
      messages: [
        {
          "role": "system",
          "content": "你是一名资深的初三化学老师，擅长用清晰、易懂的方式解释复杂的化学问题。你的任务是为学生答错的题目生成一段高质量的解析。"
        },
        {
          "role": "user",
          "content": `
            请根据以下信息，为我生成一段题目解析。
            解析需要包含：知识点回顾、解题思路、易错点分析。
            ---
            题目信息：
            - 核心知识点: ${keyPoint}
            - 题目内容: ${question}
            - 正确答案: ${correctAnswer}
            ---
            请开始你的解析：
          `
        }
      ]
    };

    // 服务员拿着订单和VIP钥匙，去厨房点餐
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('DeepSeek API 服务响应失败');
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    // 服务员把做好的菜品（解析）端回给顾客（前端）
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