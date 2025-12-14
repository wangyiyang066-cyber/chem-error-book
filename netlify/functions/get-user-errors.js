// 不改了
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取当前登录用户的ID
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: "User ID is required." };
    }

    // 修复点：这里修改了关联查询的表名和字段名
    // 将 knowledge_points (name) 改为了 knowledge_nodes (title)
    let { data: wrongAnswers, error } = await supabase
      .from('answers')
      .select(`
        id,
        answered_at,
        user_answer,
        questions (
          full_question,
          correct_answer,
          image_urls, 
          question_knowledge_point_link (
            knowledge_nodes ( title )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_correct', false)
      .order('answered_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(wrongAnswers),
    };

  } catch (error) {
    console.error("获取错题记录时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取错题记录失败。" }),
    };
  }
};