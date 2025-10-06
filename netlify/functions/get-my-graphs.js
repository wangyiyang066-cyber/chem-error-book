// 文件路径: netlify/functions/get-my-graphs.js (最终修复版 - 正确调用 RPC 函数)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    // 1. 从请求头中获取用户认证信息
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) };
    }
    const token = authHeader.split(' ')[1];

    // 2. 创建一个带有用户认证信息的 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });

    try {
        // --- ▼▼▼ 核心修正：调用我们精心准备的数据库函数 (RPC) ▼▼▼ ---
        
        // 我们不再直接查询表，而是调用 get_graphs_for_current_user 函数，
        // 它会为我们完成所有复杂的 JOIN 和查询工作，并返回包含 creator_email 的结果。
        const { data, error } = await supabase.rpc('get_graphs_for_current_user');
        
        // --- ▲▲▲ 核心修正结束 ▲▲▲ ---

        if (error) {
            console.error("调用 RPC 函数 get_graphs_for_current_user 时出错:", error);
            throw error;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("获取图谱列表时出错:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};