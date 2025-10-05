// 文件路径: netlify/functions/toggle-graph-public.js (最终正确版)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 注意：这个函数需要 SERVICE_KEY，因为它需要先绕过RLS查询图谱的当前状态
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);


exports.handler = async function(event, context) {
    const authHeader = event.headers.authorization;
    if (!authHeader) { return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) }; }
    const token = authHeader.split(' ')[1];

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { graphId } = JSON.parse(event.body);

    try {
        // 先用 Admin 权限查出当前状态，避免 RLS 影响
        let { data: graph, error: fetchError } = await supabaseAdmin.from('knowledge_graphs').select('is_public').eq('id', graphId).single();
        if (fetchError) throw new Error('找不到图谱');

        // 再用用户权限去更新，这样RLS会检查他是否是owner
        const { error } = await supabase
            .from('knowledge_graphs')
            .update({ is_public: !graph.is_public })
            .eq('id', graphId);

        if (error) throw new Error('权限不足或更新失败');
        return { statusCode: 200, body: JSON.stringify({ message: '状态切换成功' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};