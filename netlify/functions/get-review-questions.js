// 文件路径: netlify/functions/get-review-questions.js
// 不改了
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { userId } = JSON.parse(event.body);

    // 获取当前时间的 ISO 字符串
    const now = new Date().toISOString();

    console.log("正在查询复习队列，用户:", userId, "时间截点:", now);

    let { data: reviewItems, error } = await supabase
      .from('review_queue')
      .select(`
        *,
        questions (
          id,
          full_question,
          correct_answer,
          image_urls
        )
      `)
      .eq('user_id', userId)
      .lte('due_date', now) // 🔥 核心：只查“到期时间”小于等于“现在”的
      .order('due_date', { ascending: true }); // 先复习最急的

    if (error) throw error;

    console.log("查询结果数量:", reviewItems ? reviewItems.length : 0);

    return {
      statusCode: 200,
      body: JSON.stringify(reviewItems),
    };

  } catch (error) {
    console.error("获取复习队列失败:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};