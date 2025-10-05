// 文件路径: netlify/functions/delete-graph.js

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { graphId, userId } = JSON.parse(event.body);
    if (!graphId || !userId) {
      return { statusCode: 400, body: "Graph ID and User ID are required." };
    }

    // 安全检查：在删除前，先确认这个图谱确实是这个用户创建的
    let { data: graph, error: fetchError } = await supabase
      .from('knowledge_graphs')
      .select('user_id')
      .eq('id', graphId)
      .single();

    if (fetchError) throw fetchError;
    
    if (!graph || graph.user_id !== userId) {
      // 如果图谱不存在，或者所有者不匹配，则拒绝删除
      return { statusCode: 403, body: "Forbidden: You do not own this graph." };
    }

    // 确认无误后，执行删除操作
    const { error: deleteError } = await supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', graphId);

    if (deleteError) { throw deleteError; }

    return { statusCode: 200, body: JSON.stringify({ message: '图谱已成功删除！' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};