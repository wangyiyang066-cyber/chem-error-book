// 文件路径: netlify/functions/save-graph.js (V2版 - 支持多图谱)

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取图谱ID和图谱数据
    const { graphId, graphData } = JSON.parse(event.body);

    if (!graphId || !graphData) {
      return { statusCode: 400, body: "Graph ID and data are required." };
    }
    
    // 在 knowledge_graphs 表中，找到对应ID的记录，并更新它的 graph_data
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update({ graph_data: graphData, updated_at: new Date() })
      .eq('id', graphId);

    if (error) { throw error; }

    return { statusCode: 200, body: JSON.stringify({ message: `图谱 ${graphId} 已保存！` }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};