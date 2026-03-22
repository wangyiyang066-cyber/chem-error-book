// 文件路径: netlify/functions/generate-diagnostic.js
const { createClient } = require('@supabase/supabase-js');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const UNIT_MAP = {
  1: "第一单元 走进化学世界", 2: "第二单元 我们周围的空气", 3: "第三单元 物质构成的奥秘",
  4: "第四单元 自然界的水", 5: "第五单元 化学方程式", 6: "第六单元 碳和碳的氧化物",
  7: "第七单元 燃料及其利用", 8: "第八单元 金属和金属材料", 9: "第九单元 溶液",
  10: "第十单元 酸和碱", 11: "第十一单元 盐 化肥", 12: "第十二单元 化学与生活"
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "只允许 POST" }) };

  // 🌟 1. 核心修复：检查身份令牌 (防盗刷保护) 🌟
  const authHeader = event.headers.authorization;
  if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: '未提供认证令牌' }) };
  }
  const token = authHeader.split(' ')[1];

  if (!DEEPSEEK_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "未配置 API 密钥" }) };

  try {
    // 🌟 2. 验证令牌的合法性
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("身份验证失败，请重新登录");

    const body = JSON.parse(event.body);
    if (body.action !== "generate_adaptive_question") return { statusCode: 400, body: JSON.stringify({ error: "非法操作" }) };

    const learnedUnits = body.units || [];
    const currentTheta = body.current_theta !== undefined ? body.current_theta : 0.5;
    const trace = body.trace || [];

    if (learnedUnits.length === 0) return { statusCode: 400, body: JSON.stringify({ error: "缺少范围" }) };
    const unitNames = learnedUnits.map(id => UNIT_MAP[id]).filter(Boolean).join("、");

    // --- 难度逻辑 ---
    let targetDifficulty = "中等", difficultyPrompt = "生成一道中等难度题，测试基础掌握情况。", difficultyVal = "0";
    if (currentTheta < 0.35) {
        difficultyPrompt = "生成一道基础题。由于学生水平初级，请降低难度，侧重基本概念记忆。"; difficultyVal = "-1";
    } else if (currentTheta > 0.65) {
        difficultyPrompt = "生成一道拔高题。请增加难度，侧重综合运用或易错陷阱。"; difficultyVal = "1";
    }

    let traceContext = "无";
    if (trace.length > 0) {
        traceContext = trace.map((t, i) => `第${i+1}题|考点:[${t.kp}]|难度:[${t.difficulty}]|结果:${t.isCorrect ? '对' : '错'}|耗时:${(t.timeSpent/1000).toFixed(1)}s`).join("\n");
    }

    const systemPrompt = { role: "system", content: "你是一个IRT自适应中考化学名师。根据学生水平估算值和答题轨迹，精准生成【1道】单项选择题。必须返回纯净JSON对象，不要Markdown。" };
    const userPrompt = { role: "user", content: `【范围】：${unitNames}\n【Theta估算】：${currentTheta.toFixed(2)}\n【轨迹】：${traceContext}\n\n指令：避开刚考过的考点，${difficultyPrompt}\n返回1道题JSON：{"id":时间戳,"text":"题目","options":["A..","B..","C..","D.."],"answer":"A","difficulty_val":"${difficultyVal}","knowledge_point":"细分考点"}` };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [systemPrompt, userPrompt], stream: false, temperature: 0.7 })
    });

    if (!response.ok) throw new Error(`DeepSeek 报错: ${response.status}`);
    const data = await response.json();
    let aiContent = data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: aiContent };

  } catch (error) {
    console.error("生成诊断题失败:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};