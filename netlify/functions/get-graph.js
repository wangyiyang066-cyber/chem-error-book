// 文件路径: netlify/functions/get-graph.js (V2版 - 支持多图谱)

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  // 我们改成 POST 请求，方便从 body 中接收 graphId
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取要加载的图谱ID
    const { graphId } = JSON.parse(event.body);
    if (!graphId) {
      return { statusCode: 400, body: "Graph ID is required." };
    }

    // 查找指定ID的那张图
    let { data, error } = await supabase
      .from('knowledge_graphs')
      .select('graph_data')
      .eq('id', graphId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 是“找不到行”的错误，是正常的
        throw error;
    }

    return { statusCode: 200, body: JSON.stringify(data ? data.graph_data : null) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};