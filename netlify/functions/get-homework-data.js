const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

exports.handler = async function (event, context) {
  try {
    const authHeader = event.headers.authorization;
    // 验证用户身份
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return { statusCode: 401, body: "Unauthorized" };

    // 1. 还原课时：101 -> 1
    const virtualId = parseInt(event.queryStringParameters.id);
    const lessonNum = virtualId - 100;

    // 2. 🚀 直接抓取带有 shifouzuoguo 字段的作业题
    const { data: homeworkQuestions, error } = await supabase
        .from('questions')
        .select('*, shifouzuoguo') // 明确要求返回你的布尔字段
        .eq('zuoyeti', true)      // 必须是作业题
        .eq('lesson_num', lessonNum);

    if (error) throw error;

    // 3. 原封不动传给前端，让 homework-quiz.js 的 filter 去处理
    return { 
        statusCode: 200, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(homeworkQuestions) 
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};