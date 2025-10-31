// 文件路径: netlify/functions/debug-env.js

exports.handler = async function(event, context) {
    
    // 这个函数是安全的，它不会在日志或响应中泄露你的完整密钥

    const urlVar = process.env.SUPABASE_URL;
    const keyVar = process.env.SUPABASE_ANON_KEY;

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "开始检查环境变量...",
            
            // 检查 URL
            SUPABASE_URL_IS_SET: !!urlVar,
            SUPABASE_URL_Type: typeof urlVar,
            SUPABASE_URL_PARTIAL: urlVar ? urlVar.substring(0, 10) + "..." : "NOT SET",
            
            // 检查 Key
            SUPABASE_ANON_KEY_IS_SET: !!keyVar,
            SUPABASE_ANON_KEY_Type: typeof keyVar,
            SUPABASE_ANON_KEY_PARTIAL: keyVar ? keyVar.substring(0, 6) + "..." : "NOT SET"
        })
    };
};