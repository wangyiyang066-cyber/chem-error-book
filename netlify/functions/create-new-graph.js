// 文件路径: netlify/functions/create-new-graph.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  try {
    const { userId, graphName } = JSON.parse(event.body);
    if (!userId || !graphName) {
      return { statusCode: 400, body: "User ID and graph name are required." };
    }

    // 在 knowledge_graphs 表中插入一条新记录
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .insert({ name: graphName, user_id: userId, is_public: false })
      .select() // select() 让我们能把新创建的记录返回
      .single(); // .single() 确保我们只获取一条记录

    if (error) { throw error; }

    // 将新创建的图谱信息返回给前端
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};