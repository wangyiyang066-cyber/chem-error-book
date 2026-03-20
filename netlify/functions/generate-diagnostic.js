// 文件路径: netlify/functions/generate-diagnostic.js

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const UNIT_MAP = {
  1: "第一单元 走进化学世界", 2: "第二单元 我们周围的空气", 3: "第三单元 物质构成的奥秘",
  4: "第四单元 自然界的水", 5: "第五单元 化学方程式", 6: "第六单元 碳和碳的氧化物",
  7: "第七单元 燃料及其利用", 8: "第八单元 金属和金属材料", 9: "第九单元 溶液",
  10: "第十单元 酸和碱", 11: "第十一单元 盐 化肥", 12: "第十二单元 化学与生活"
};

const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "只允许 POST 请求" }) };
  }

  if (!DEEPSEEK_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "服务器端未配置 AI 密钥" }) };
  }

  try {
    const body = JSON.parse(event.body);
    
    if (body.action !== "generate_diagnostic") {
      return { statusCode: 400, body: JSON.stringify({ error: "非法的操作指令" }) };
    }

    const learnedUnits = body.learned_units || [];
    const questionCount = body.question_count || 5;

    if (learnedUnits.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "请至少选择一个学习单元" }) };
    }

    const unitNames = learnedUnits.map(id => UNIT_MAP[id]).filter(Boolean).join("、");

    const systemPrompt = {
      role: "system",
      content: "你是一名资深的中考化学命题专家。你的任务是根据学生已学的单元进度，精准生成一套能力诊断测试题。你必须严格遵循知识边界，绝不能超纲出题。你返回的结果必须是纯净的 JSON 数据，不要包含任何 Markdown 标记（如 ```json）或额外的解释说明。"
    };

    const userPrompt = {
      role: "user",
      content: `当前学生正在进行首次能力诊断。该学生目前只学过以下化学单元：【${unitNames}】。
请严格限制在这个知识范围内，生成 ${questionCount} 道单项选择题，难度需包含基础、中等和拔高（用于IRT能力测试）。

请务必返回一个标准的 JSON 对象，格式如下：
{
  "questions": [
    {
      "id": 1,
      "text": "题目具体内容（如：下列关于氧气说法正确的是？）",
      "options": ["选项A的内容", "选项B的内容", "选项C的内容", "选项D的内容"],
      "answer": "A",
      "difficulty": "基础",
      "knowledge_point": "氧气的性质"
    }
  ]
}
注意：仅返回 JSON 字符串本身，不要输出任何其他的文字。`
    };

    // 🌟 终极绝招：把网址拆散，骗过编辑器的自动超链接格式化！
    const protocol = "https://";
    const domain = "api.deepseek.com";
    const path = "/chat/completions";
    const apiEndpoint = protocol + domain + path; 
    
    try {
      console.log("正在向 DeepSeek 发起请求...");
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [systemPrompt, userPrompt],
          stream: false 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ DeepSeek API 拒绝了请求. 状态码: ${response.status}`);
        throw new Error(`DeepSeek API 错误: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0].message) {
          throw new Error("AI 返回的数据缺少必要内容字段");
      }

      let aiContent = data.choices[0].message.content.trim();
      aiContent = aiContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsedQuestions;
      try {
        parsedQuestions = JSON.parse(aiContent);
      } catch (parseErr) {
        console.error("❌ JSON解析失败，原始内容为:", aiContent);
        throw new Error("AI 格式化生成失败，未返回合法的 JSON");
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedQuestions)
      };

    } catch (apiError) {
      console.error("API 错误:", apiError.message);
      return { statusCode: 502, body: JSON.stringify({ error: apiError.message }) };
    }

  } catch (globalError) {
    console.error("全局异常:", globalError);
    return { statusCode: 500, body: JSON.stringify({ error: "服务器内部异常" }) };
  }
};

module.exports = { handler };