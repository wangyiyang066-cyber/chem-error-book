const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// 🚨 切换为匿名密钥 (ANON_KEY)
const supabaseKey = process.env.SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 🔥 1. 强制鉴权 (Security Check)
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        console.warn("请求缺少 Auth Header");
        return { statusCode: 401, body: "Unauthorized: Missing token." };
    }
    const token = authHeader.replace('Bearer ', '');
    
    // 使用 ANON_KEY 创建的客户端来验证 Token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        console.error("Token 验证失败:", authError?.message || "User not found.");
        return { statusCode: 401, body: "Unauthorized: Invalid token." };
    }
    
    // 成功获取到用户ID，覆盖前端传入的 userId（更安全）
    const authenticatedUserId = user.id;

    // --- 鉴权成功，开始处理业务逻辑 ---
    const chapterId = event.queryStringParameters.nodeId; // 注意：前端传的是 nodeId
    // 你的前端 quiz.js 传的是 nodeId，但你的后端在找 id
    // const chapterId = event.queryStringParameters.id; 
    
    if (!chapterId) {
      return { statusCode: 400, body: "Chapter ID is required." };
    }

    console.log(`正在查询第 ${chapterId} 单元，用户ID: ${authenticatedUserId}`);

    let query = supabase
      .from('questions')
      .select(`
        *,
        question_knowledge_point_link!inner (
          knowledge_nodes!inner (
            id,
            title,
            full_code
          )
        ),
        // 确保使用别名来筛选当前用户的答案
        answers:answers!inner(id, is_correct, user_id) 
      `, { head: false })
      .ilike('question_knowledge_point_link.knowledge_nodes.full_code', `${chapterId}.%`);

    // 🔥 强制筛选当前用户的答案记录
    // 注意：这里需要确保 RLS 允许匿名 Key 读取 questions 表和相关的 link 表。
    // RLS 策略应该设为：`auth.uid() = user_id`
    query = query.filter('answers.user_id', 'eq', authenticatedUserId);

    
    // 5. 数据清洗：标记 is_done
    const processedQuestions = rawQuestions.map(q => {
      // 如果 answers 数组不为空，说明找到了该用户的答题记录
      const isDone = userId && q.answers && q.answers.length > 0;
      
      // 把不需要的 answers 字段删掉，只留一个布尔值，保持数据清爽
      const { answers, ...rest } = q; 
      return {
        ...rest,
        is_done: isDone
      };
    });

    console.log(`查询成功，共返回 ${processedQuestions.length} 道题目`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processedQuestions),
    };

  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取题目失败" }),
    };
  }
};