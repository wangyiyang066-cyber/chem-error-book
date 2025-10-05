// 文件路径: netlify/functions/get-graph.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  try {
    // 查找 id=1 的那张图
    let { data, error } = await supabase
      .from('knowledge_graphs')
      .select('graph_data')
      .eq('id', 1)
      .single(); // .single() 表示我们只想要一条记录

    if (error && error.code !== 'PGRST116') { // PGRST116 是“找不到行”的错误，是正常的
        throw error;
    }

    return { statusCode: 200, body: JSON.stringify(data ? data.graph_data : null) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};