// netlify/functions/create-new-graph.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    
    // 🚀 把 try 块移到最顶层
    try {
        const authHeader = event.headers.authorization;
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) };
        }
        const token = authHeader.split(' ')[1];

        // 1. 增加一个对环境变量是否加载的检查
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('服务器环境变量配置不正确。');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        // 2. 增加对 body 的检查
        if (!event.body) {
            throw new Error('请求正文 (request body) 为空');
        }
        const { graphName } = JSON.parse(event.body);
        
        // 3. 检查用户认证
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        // 如果 authError 存在，手动抛出
        if (authError) {
            throw authError;
        }
        if (!user) {
            throw new Error('无法验证用户信息，Token 可能无效或已过期。');
        }

        // 4. 执行数据库插入
        const { data, error: insertError } = await supabase
            .from('knowledge_graphs')
            .insert({ name: graphName, user_id: user.id })
            .select()
            .single();

        // 如果 insertError 存在，手动抛出
        if (insertError) {
            throw insertError;
        }
        
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        // 🚀 现在这个 catch 块可以捕获所有错误
        console.error('函数执行出错:', error.message); // 在 Netlify Log 中打印错误
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                message: '函数内部错误', 
                detail: error.message 
            }) 
        };
    }
};