// 文件路径: netlify/functions/save-graph.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const graphData = JSON.parse(event.body);

    // 使用 upsert，如果 id=1 的记录已存在则更新，不存在则创建
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .upsert({ id: 1, graph_data: graphData, updated_at: new Date() })
      .select();

    if (error) { throw error; }
    return { statusCode: 200, body: JSON.stringify({ message: '图谱已保存！' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};