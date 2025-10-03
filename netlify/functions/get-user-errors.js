// 文件路径: netlify/functions/get-user-errors.js

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

    // 这是一段复杂的数据库查询指令：
    // 1. 从 `answers` 表开始查找
    // 2. 条件是：`user_id` 匹配当前用户，并且 `is_correct` 为 false (答错了)
    // 3. `select` 指令不仅查询 `answers` 表本身，还通过关联关系，把 `questions` 表的所有信息，
    //    以及 `questions` 表再关联的 `knowledge_points` 表的信息，都一并查询出来！
    // 4. 按答题时间 `answered_at` 降序排列，最新的错题在最前面。
    let { data: wrongAnswers, error } = await supabase
      .from('answers')
      .select(`
        id,
        answered_at,
        user_answer,
        questions (
          full_question,
          correct_answer,
          image_url,
          question_knowledge_point_link (
            knowledge_points ( name )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_correct', false)
      .order('answered_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 将查询到的错题记录返回给前端
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