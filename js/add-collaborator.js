// 文件路径: netlify/functions/add-collaborator.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// 注意：这里我们需要使用 SERVICE_KEY，因为它有权限查询所有用户的信息
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
    // 1. 安全检查：确保是登录用户发出的请求
    const { user } = context.clientContext;
    if (!user) {
        return {
            statusCode: 401, // Unauthorized
            body: JSON.stringify({ message: '请先登录后再进行操作。' })
        };
    }

    // 2. 解析从前端发来的数据
    const { graphId, collaboratorEmail } = JSON.parse(event.body);
    if (!graphId || !collaboratorEmail) {
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ message: '缺少图谱ID或协作者邮箱。' })
        };
    }

    // 严谨起见，将邮箱转为小写并去除首尾空格
    const cleanEmail = collaboratorEmail.toLowerCase().trim();
    const requestUserId = user.sub; // 发出此请求的用户ID

    try {
        // 3. 权限检查：确认发出请求的人是这个图谱的原始创建者 (owner)
        const { data: graph, error: graphError } = await supabaseAdmin
            .from('knowledge_graphs')
            .select('user_id')
            .eq('id', graphId)
            .single();

        if (graphError) throw new Error('找不到指定的图谱。');
        if (graph.user_id !== requestUserId) {
            return {
                statusCode: 403, // Forbidden
                body: JSON.stringify({ message: '权限不足：只有图谱的创建者才能邀请协作者。' })
            };
        }

        // 4. 查找新成员：根据邮箱找到要被邀请的用户的ID
        // 我们使用 Supabase Admin 的 listUsers 方法来安全地通过邮箱查找用户
        const { data: { users: collaborators }, error: userError } = await supabaseAdmin.auth.admin.listUsers({
            email: cleanEmail
        });
        
        if (userError) throw userError;
        if (!collaborators || collaborators.length === 0) {
            return {
                statusCode: 404, // Not Found
                body: JSON.stringify({ message: '未找到该邮箱对应的注册用户。' })
            };
        }
        
        const collaborator = collaborators[0];
        const collaboratorId = collaborator.id;

        // 5. 防止自己邀请自己
        if (collaboratorId === requestUserId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: '不能邀请自己作为协作者。' })
            };
        }

        // 6. 登记备案：将新的协作关系插入到 `graph_collaborators` 表中
        // 这里我们使用 Supabase 的普通客户端，并传入请求用户的 JWT，
        // 这样 Supabase 就会用我们之前设置好的 RLS 策略来执行这次插入操作。
        const supabaseUserClient = createClient(supabaseUrl, context.clientContext.token);
        const { error: insertError } = await supabaseUserClient
            .from('graph_collaborators')
            .insert({
                graph_id: graphId,
                user_id: collaboratorId
            });

        // 如果插入失败，很可能是因为该用户已经是协作者了 (unique_graph_collaborator 约束)
        if (insertError) {
            if (insertError.code === '23505') { // unique constraint violation
                return {
                    statusCode: 409, // Conflict
                    body: JSON.stringify({ message: '该用户已经是协作者了。' })
                };
            }
            throw insertError;
        }

        // 7. 返回成功结果
        return {
            statusCode: 200,
            body: JSON.stringify({ message: '协作者添加成功！' })
        };

    } catch (error) {
        console.error('添加协作者时发生错误:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message || '服务器内部错误。' })
        };
    }
};