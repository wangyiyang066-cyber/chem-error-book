// 文件路径: netlify/functions/save-graph.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event, context) {
    // 1. 从请求头中提取用户的 JWT (身份通行证)
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        return { statusCode: 401, body: JSON.stringify({ message: '未提供认证信息' }) };
    }
    const token = authHeader.split(' ')[1];

    // 2. 创建一个带有用户认证信息的 Supabase 客户端实例
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });

    // 3. 解析从前端发送过来的图谱数据
    const { graphId, graphData } = JSON.parse(event.body);
    if (!graphId || !graphData) {
        return { statusCode: 400, body: JSON.stringify({ message: '请求中缺少图谱ID或图谱数据' }) };
    }

    try {
        // 4. 执行更新操作
        // RLS 策略会自动检查当前用户是否有权限更新这个图谱
        const { error } = await supabase
            .from('knowledge_graphs')
            .update({ 
                graph_data: graphData, // 更新图谱内容
                updated_at: new Date().toISOString() // 同时更新“最后修改时间”
            })
            .eq('id', graphId);

        if (error) {
            // 如果 RLS 策略阻止了操作，会在这里抛出错误
            console.error('保存失败:', error);
            throw new Error('保存失败，你可能没有权限或图谱不存在。');
        }

        return { statusCode: 200, body: JSON.stringify({ message: '保存成功' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};