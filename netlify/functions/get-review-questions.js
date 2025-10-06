// 文件路径: netlify/functions/get-review-questions.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: "User ID is required." };
    }

    // 查询 review_queue 表中，所有属于该用户，并且复习日期已到期（小于等于当前时间）的记录
    const { data: reviewItems, error } = await supabase
      .from('review_queue')
      .select(`
        id,
        due_date,
        repetitions,
        questions (
          *,
          question_knowledge_point_link (
            knowledge_points ( name )
          )
        )
      `)
      .eq('user_id', userId)
      .lte('due_date', new Date().toISOString()) // lte = less than or equal to
      .order('due_date', { ascending: true }); // 最早到期的排在最前面

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify(reviewItems),
    };

  } catch (error) {
    console.error("获取复习队列时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取复习队列失败。" }),
    };
  }
};