const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  // 1. 只允许 GET 请求
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const chapterId = event.queryStringParameters.id;
    const userId = event.queryStringParameters.userId; // 获取前端传来的用户ID

    if (!chapterId) {
      return { statusCode: 400, body: "Chapter ID is required." };
    }

    console.log(`正在查询第 ${chapterId} 单元，用户ID: ${userId || '未登录'}`);

    // 2. 构建查询链
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
        )
        ${userId ? ', answers(id)' : ''} 
      `)
      // 3. 核心过滤：只找关联了该单元知识点的题目
      .ilike('question_knowledge_point_link.knowledge_nodes.full_code', `${chapterId}.%`);

    // 4. 如果有用户ID，只查询该用户的答题记录 (用于判断 is_done)
    if (userId) {
      query = query.eq('answers.user_id', userId);
    }

    const { data: rawQuestions, error } = await query;

    if (error) {
      console.error("Supabase 查询错误:", error);
      throw error;
    }

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