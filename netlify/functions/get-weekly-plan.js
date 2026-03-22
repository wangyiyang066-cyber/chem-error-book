const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getServerWeekId() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "只允许 POST 请求" };

    // 🌟 1. 学习你的做法：从请求头获取 JWT Token 🌟
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        return { statusCode: 401, body: JSON.stringify({ error: '未提供认证信息，拒绝访问' }) };
    }
    const token = authHeader.split(' ')[1];

    try {
        const body = JSON.parse(event.body || "{}");
        const week_id = body.week_id || getServerWeekId();

        // 🌟 2. 学习你的做法：创建带有身份令牌的 Supabase 客户端 🌟
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: { Authorization: `Bearer ${token}` }
            }
        });

        // 🌟 3. 现在可以直接查表了！
        // 因为 Supabase 已经知道你是谁了（前提是你的表开启了 RLS 策略）
        // 我们甚至不需要在 .eq() 里写 user_id 了，数据库会自动过滤！
        const { data, error } = await supabase
            .from('weekly_plans')
            .select('*')
            .eq('week_id', week_id) // 只需要查本周的
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { statusCode: 200, body: JSON.stringify({ hasPlan: false }) };
            }
            throw error;
        }

        return { statusCode: 200, body: JSON.stringify({ hasPlan: true, planData: data }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "服务器内部错误" }) };
    }
};