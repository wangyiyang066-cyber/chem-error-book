const { createClient } = require('@supabase/supabase-js');

// 这里读取 Netlify 环境变量，绝对安全，不会暴露给前端
const supabaseUrl = process.env.SUPABASE_URL;
// 这里可以用 SERVICE_KEY (因为是在服务端)，确保能绕过 RLS 读到数据
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    // 1. 处理 OPTIONS 预检请求 (解决跨域问题)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('服务器环境变量未配置');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 2. 验证用户 Token (可选，建议保留以增强安全性)
        // 从请求头获取 Authorization: Bearer <token>
        const authHeader = event.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return { statusCode: 401, headers, body: JSON.stringify({ message: '用户未登录或Token过期' }) };
            }
        } else {
             // 如果你希望只有登录用户能看，这里可以返回 401
             // return { statusCode: 401, headers, body: JSON.stringify({ message: '未授权访问' }) };
        }

        // 3. 查询数据库 (只取绘图需要的字段)
        const { data, error } = await supabase
            .from('knowledge_nodes')
            .select('id, parent_id, title, layer, full_code');

        if (error) throw error;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: '获取星空数据失败', detail: error.message })
        };
    }
};