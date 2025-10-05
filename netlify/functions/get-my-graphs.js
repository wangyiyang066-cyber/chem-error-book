// 文件路径: netlify/functions/get-my-graphs.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) { return { statusCode: 400, body: "User ID is required." }; }

    // 查询所有公共图谱，或者由当前用户创建的私人图谱
    let { data, error } = await supabase
      .from('knowledge_graphs')
      .select('id, name, is_public, user_id')
      .or(`is_public.eq.true,user_id.eq.${userId}`);

    if (error) { throw error; }
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};