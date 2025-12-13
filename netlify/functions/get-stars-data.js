const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// 依然使用 Service Key 或 Anon Key 均可，确保能读数据
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('服务器环境变量未配置');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // 验证部分保持不变...
        const authHeader = event.headers.authorization;
        // ... (此处省略验证代码，与之前一致，保留即可) ...

        // 🚀【关键修改】在这里增加了 'content' 字段
        const { data, error } = await supabase
            .from('knowledge_nodes')
            .select('id, parent_id, title, layer, full_code, content'); 

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
            body: JSON.stringify({ message: '获取数据失败' })
        };
    }
};