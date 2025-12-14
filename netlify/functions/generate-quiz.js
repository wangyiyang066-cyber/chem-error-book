// 文件路径: netlify/functions/generate-quiz.js
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const fetch = require('node-fetch');

// 系统提示词：增加了对“多知识点融合”的指令
const systemPrompt = { 
  "role": "system", 
  "content": `你是一位初三化学出题专家。
  任务：根据用户提供的【知识点列表】，出一道单项选择题。
  要求：
  1. 如果只有一个知识点，考察该点的核心概念。
  2. 【重要】如果有多个知识点，请设计一道“综合题”，题目背景必须同时涉及这几个知识点（例如将A物质的制备与B性质结合）。
  3. 必须严格以 JSON 格式返回，无 Markdown。
  4. JSON 格式：
  {
    "question": "题干（包含情境描述）",
    "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
    "correct": "A",
    "analysis": "解析：说明本题是如何综合考察了这几个知识点的..."
  }` 
};

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    // 接收数组或单个对象
    const { items } = JSON.parse(event.body); 
    
    // 把知识点名称拼接起来，告诉 AI
    const names = items.map(i => i.name).join(" + ");
    const descriptions = items.map(i => i.content).join("；");

    const userMessage = {
      "role": "user",
      "content": `请出题。涉及知识点：[${names}]。背景描述参考：${descriptions}`
    };

    const finalMessages = [ systemPrompt, userMessage ];
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: finalMessages,
        temperature: 1.2,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    let aiContent = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();

    return { statusCode: 200, body: aiContent };
    
  } catch (error) {
    console.error("出题失败:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "出题服务繁忙" }) };
  }
};