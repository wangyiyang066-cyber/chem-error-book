// 文件路径: netlify/functions/get-my-graphs.js (超级调试版)
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    // ================================================================
    // ===== 日志起点：函数被触发 =====
    console.log('--- [get-my-graphs] Function execution started. ---');
    // ================================================================
    
    try {
        // --- 步骤 1: 检查环境变量 ---
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        console.log('[DEBUG] Supabase URL loaded:', !!supabaseUrl);
        console.log('[DEBUG] Supabase Anon Key loaded:', !!supabaseAnonKey);

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[FATAL] Missing Supabase environment variables!');
            throw new Error('服务器配置不完整: 缺少 Supabase URL 或 Anon Key。');
        }

        // --- 步骤 2: 检查并提取用户认证 Token ---
        const authHeader = event.headers.authorization;
        console.log('[DEBUG] Authorization Header:', authHeader ? 'Present' : 'MISSING!');
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ message: '请求中缺少 Authorization Header' }) };
        }
        const token = authHeader.split(' ')[1];
        console.log('[DEBUG] Extracted Token:', token ? 'Token exists.' : 'Token is MISSING!');

        // --- 步骤 3: 创建 Supabase 客户端 ---
        console.log('[DEBUG] Creating Supabase client instance...');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` }
            }
        });
        console.log('[DEBUG] Supabase client created.');

        // --- 步骤 4: 从 Token 获取用户信息 ---
        console.log('[DEBUG] Attempting to fetch user with supabase.auth.getUser()...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('[ERROR] Error fetching user from Supabase:', userError);
            throw userError;
        }
        if (!user) {
            console.error('[ERROR] Token is invalid or expired, user object is null.');
            throw new Error('无效的 Token，无法获取用户信息。');
        }
        console.log('[DEBUG] Successfully fetched user:', user.email);
        const userId = user.id;

        // --- 步骤 5: 执行数据库查询 ---
        const queryFilter = `user_id.eq.${userId},is_public.eq.true`;
        console.log('[DEBUG] Executing database query with filter:', queryFilter);
        
        const { data, error: dbError } = await supabase
            .from('knowledge_graphs')
            .select('id, name, is_public, user_id')
            .or(queryFilter);

        if (dbError) {
            console.error('[ERROR] Database query failed:', dbError);
            throw dbError;
        }
        console.log('[DEBUG] Database query successful. Number of graphs fetched:', data.length);

        // ================================================================
        // ===== 日志终点：成功返回 =====
        console.log('--- [get-my-graphs] Function execution successful. ---');
        // ================================================================
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        // ================================================================
        // ===== 日志终点：捕获到致命错误 =====
        console.error('--- [get-my-graphs] CRITICAL ERROR caught in catch block: ---');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        // ================================================================
        return {
            // 返回纯文本错误，以便我们在浏览器看到具体信息
            statusCode: 500,
            body: `Error: ${error.message}`
        };
    }
};