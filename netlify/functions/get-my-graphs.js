// 文件路径: netlify/functions/get-my-graphs.js (带有精确错误日志的最终版)

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  try {
    // 确保是 POST 请求
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: "User ID is required." };
    }

    // 查询所有公共图谱，或者由当前用户创建的私人图谱
    let { data, error } = await supabase
      .from('knowledge_graphs')
      .select('id, name, is_public, user_id')
      .or(`is_public.eq.true,user_id.eq.${userId}`);

    // --- ↓↓↓ “真话药剂”在这里！ ↓↓↓ ---
    // 如果 Supabase 在查询时返回了任何错误
    if (error) {
      // 我们先把这个原始的、详细的错误打印到我们的终端日志里
      console.error("从 Supabase 查询时发生错误:", error);
      // 然后再把这个错误抛出，让函数失败
      throw error;
    }
    // --- ↑↑↑ “真话药剂”结束 ↑↑↑ ---

    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    // 这里的日志现在会包含上面抛出的更详细的 Supabase 错误信息
    console.error("get-my-graphs 函数最终捕获的错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }), // 把更具体的消息返回给前端
    };
  }
};