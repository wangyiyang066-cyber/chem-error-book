// 文件路径: netlify/functions/create-new-graph.js (最终根治版)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { userId, graphName } = JSON.parse(event.body);

    if (!userId || !graphName) {
      return { statusCode: 400, body: "创建图谱需要提供用户ID和图谱名称。" };
    }
    
    // 我们不再需要自己创建ID了，数据库会帮我们自动处理！
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .insert([
        { 
          // 把 id 那一行彻底删掉！
          name: graphName,
          user_id: userId,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("插入新图谱到 Supabase 时发生致命错误:", error);
      throw error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error("create-new-graph 函数最终捕获到的错误:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `服务器内部发生错误: ${error.message}` }),
    };
  }
};