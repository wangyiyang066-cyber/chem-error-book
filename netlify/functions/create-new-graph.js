// 文件路径: netlify/functions/create-new-graph.js (最终正确版)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    const authHeader = event.headers.authorization;
    if (!authHeader) { return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) }; }
    const token = authHeader.split(' ')[1];

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { graphName } = JSON.parse(event.body);
    const { data: { user } } = await supabase.auth.getUser();

    try {
        const { data, error } = await supabase
            .from('knowledge_graphs')
            .insert({ name: graphName, user_id: user.id })
            .select()
            .single();
        
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};