// 文件路径: netlify/functions/get-questions-by-chapter.js (最终修复版)
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
    if (chapterId === undefined) {
      return { statusCode: 400, body: "Chapter ID is required." };
    }

    // ▼▼▼ 核心改动：在查询模式的最前面加上 '%' 通配符 ▼▼▼
    // 为了更兼容您数据中可能存在的 "question" 或 "[question]" 写法，我们只匹配 "question" + 章节号
    const pattern = `%question${chapterId}.%`;
    // ▲▲▲ 核心改动结束 ▲▲▲

    let { data: questions, error } = await supabase
      .from('questions')
      .select(`
        *,
        question_knowledge_point_link (
          knowledge_points ( * )
        )
      `)
      .like('full_question', pattern); // .like() 会使用我们新的、更灵活的 pattern

    if (error) throw error;
    
    return {
      statusCode: 200,
      body: JSON.stringify(questions),
    };

  } catch (error) {
    console.error("按章节获取题目时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取题目失败。" }),
    };
  }
};