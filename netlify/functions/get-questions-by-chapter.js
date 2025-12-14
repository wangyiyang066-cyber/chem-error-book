const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const chapterId = event.queryStringParameters.id;
    if (!chapterId) {
      return { statusCode: 400, body: "Chapter ID is required." };
    }

    console.log(`Searching questions for Chapter: ${chapterId}`);

    // 🔥 核心查询：关联查询
    // 只要题目的关联知识点编号是以 "chapterId" 开头的，就选出来
    // 例如 id=1，就会选出 1.1.1, 1.2.3 等
    let { data: questions, error } = await supabase
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
      `)
      // 过滤：关联表中的知识点编号，必须以 "chapterId." 开头
      // 注意：这里使用 ilike 忽略大小写
      .ilike('question_knowledge_point_link.knowledge_nodes.full_code', `${chapterId}.%`);

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questions),
    };

  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取题目失败" }),
    };
  }
};