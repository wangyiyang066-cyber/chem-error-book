// 文件路径: netlify/functions/plan-mentor-chat.js
const { createClient } = require('@supabase/supabase-js');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "只允许 POST 请求" };

    // 1. 安全鉴权
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "未授权" }) };

    try {
        const body = JSON.parse(event.body);
        const { messages } = body; // 接收前端发来的整段聊天历史

        if (!messages || messages.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: "消息为空" }) };
        }

        // 2. 呼叫 DeepSeek 进行导师对话
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "deepseek-chat", 
                messages: messages, 
                stream: false, 
                temperature: 0.7, // 保持一点创造力和温度
                max_tokens: 500   // 导师单次回复不宜过长
            })
        });

        if (!response.ok) throw new Error(`API 报错: ${response.status}`);
        
        const data = await response.json();
        const aiReply = data.choices[0].message.content;

        // 3. 将导师的回复传回前端
        return { 
            statusCode: 200, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ reply: aiReply }) 
        };

    } catch (error) {
        console.error("导师 API 崩溃:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};