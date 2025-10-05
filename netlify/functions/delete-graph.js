// 文件路径: netlify/functions/delete-graph.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    // 从请求头中提取用户的 JWT
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) };
    }
    const token = authHeader.split(' ')[1];

    // 创建一个带有用户认证信息的 Supabase 客户端实例
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });

    const { graphId } = JSON.parse(event.body);
    if (!graphId) {
        return { statusCode: 400, body: JSON.stringify({ message: '未提供图谱ID' }) };
    }

    try {
        // RLS 策略会自动检查当前用户是否有权限删除这一行
        const { error } = await supabase
            .from('knowledge_graphs')
            .delete()
            .eq('id', graphId);

        if (error) {
            // 如果 RLS 阻止了操作，会在这里抛出错误
            console.error('删除失败:', error);
            throw new Error('删除失败，你可能没有权限。');
        }

        return { statusCode: 200, body: JSON.stringify({ message: '删除成功' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};