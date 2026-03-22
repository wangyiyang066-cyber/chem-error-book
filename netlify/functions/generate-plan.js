// 文件路径: netlify/functions/generate-plan.js
const { createClient } = require('@supabase/supabase-js');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getServerWeekId() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  // 🌟 1. 从请求头拦截身份 Token 🌟
  const authHeader = event.headers.authorization;
  if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: '未提供认证信息，拒绝访问' }) };
  }
  const token = authHeader.split(' ')[1];

  try {
    const body = JSON.parse(event.body);
    const { theta, trace } = body;

    // 🌟 2. 带着 Token 初始化 Supabase 客户端 🌟
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 🌟 3. 让 Supabase 验证 Token 并返回绝对真实的 User ID 🌟
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        throw new Error("Token 无效或已过期，请重新登录");
    }
    const real_user_id = user.id; // 这就是无法伪造的真实 ID！

    // ==========================================
    // 调用 DeepSeek 生成计划 (极速版逻辑)
    // ==========================================
    let traceContext = trace.length > 0 
        ? trace.map((t, i) => `Q${i+1}:考点[${t.kp}],难度[${t.difficulty}],${t.isCorrect?'对':'错'},${t.timeSpent}s`).join(";")
        : "无";

    const systemPrompt = { role: "system", content: "你是一个极其高效的数据生成器。只输出紧凑的JSON数组，绝不换行，绝不包含任何解释或Markdown符号。语言极度精简。" };
    const userPrompt = { role: "user", content: `Theta:${theta.toFixed(2)}。轨迹:${traceContext}。\n按此JSON格式输出7天计划(周一至周日)，要求task极简(限10字)，kp明确：\n[{"day":"周一","date":"今天","target_diff":"${(theta+0.05).toFixed(2)}","task":"复习错题","kp":"质量守恒"}]` };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [systemPrompt, userPrompt], stream: false, temperature: 0.1, max_tokens: 300 })
    });

    if (!response.ok) throw new Error(`DeepSeek API 错误: ${response.status}`);
    
    const data = await response.json();
    let aiContent = data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsedPlan = JSON.parse(aiContent);

    // ==========================================
    // 🌟 4. 安全存入数据库 🌟
    // ==========================================
    const weekId = getServerWeekId();
    const { error: dbError } = await supabase
        .from('weekly_plans')
        .insert([{ 
            user_id: real_user_id, // 使用刚刚验证通过的真实 ID
            week_id: weekId,
            theta_score: theta.toFixed(3),
            plan_json: parsedPlan 
        }]);

    if (dbError) throw dbError;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedPlan) };

  } catch (error) {
    console.error("系统运行失败:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};