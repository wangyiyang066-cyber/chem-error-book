// 文件路径: netlify/functions/get-daily-quiz.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "只允许 POST" }) };

    // ==========================================
    // 🛡️ 1. 安全鉴权
    // ==========================================
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: "未授权访问" }) };
    const token = authHeader.split(' ')[1];

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error("身份验证失败");

        const userId = user.id;
        const body = JSON.parse(event.body);
        
        // 获取前端传来的任务参数
        const targetKp = body.kp || "综合";
        const targetDiff = parseFloat(body.diff) || 0.5;
        const totalNeeded = body.count || 5; 

        console.log(`🎯 [日常任务] 考点: ${targetKp}, 难度: ${targetDiff}, 需要题量: ${totalNeeded}`);

        let finalQuestions = [];

        // ==========================================
        // 🗄️ 2. 第一层漏斗：去错题本里捞人
        // ==========================================
        try {
            console.log("🔍 正在检索该考点的历史错题...");
            // 注意：这里假设你的错题存在 user_answers 表且 is_correct 为 false
            // 如果表名不对，这里的 catch 会自动拦截并转交给 AI，绝不崩溃！
            const { data: errorRecords, error: dbErr } = await supabase
                .from('user_answers') 
                .select(`
                    id,
                    user_answer,
                    is_correct,
                    questions!inner (
                        id,
                        full_question,
                        correct_answer,
                        analysis,
                        difficulty
                    )
                `)
                .eq('user_id', userId)
                .eq('is_correct', false)
                .limit(2); // 最多只抽2道错题重练

            if (!dbErr && errorRecords && errorRecords.length > 0) {
                const formattedErrors = errorRecords.map(record => ({
                    id: record.questions.id,
                    text: `(错题重练) ${record.questions.full_question}`, // 加上提示字眼
                    options: ["A", "B", "C", "D"], // 默认选项格式
                    answer: record.questions.correct_answer,
                    difficulty_val: record.questions.difficulty || targetDiff.toString(),
                    knowledge_point: targetKp,
                    analysis: record.questions.analysis,
                    is_review: true // 标记为复习题
                }));
                finalQuestions.push(...formattedErrors);
                console.log(`✅ 成功从错题库捞出 ${formattedErrors.length} 道题`);
            }
        } catch (err) {
            console.log("⚠️ 错题库检索跳过 (准备直接使用 AI 命题):", err.message);
        }

        // ==========================================
        // 🤖 3. 第二层漏斗：AI 兜底实时锻造补齐
        // ==========================================
        const remainNeeded = totalNeeded - finalQuestions.length;
        
        if (remainNeeded > 0) {
            console.log(`🤖 还差 ${remainNeeded} 题，正在呼叫 DeepSeek 现场命题...`);
            
            const systemPrompt = {
                role: "system",
                content: "你是一个搭载了IRT自适应算法的中考化学名师。必须严格输出一个 JSON 数组，包含多道单选题。不要Markdown，不要任何解释文字。"
            };
            
            const userPrompt = {
                role: "user",
                content: `请为我生成 ${remainNeeded} 道初中化学单选题。
要求：
1. 核心考点必须紧紧围绕：【${targetKp}】
2. 难度系数 (Theta) 控制在：${targetDiff.toFixed(2)} 左右。

严格返回 JSON 数组格式 (直接以 [ 开始，] 结束)：
[
  {
    "id": 1001,
    "text": "题目具体内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": "A",
    "difficulty_val": "${targetDiff.toFixed(2)}",
    "knowledge_point": "${targetKp}",
    "analysis": "这道题的详细解析..."
  }
]`
            };

            try {
                // 🌟 1. 准备大模型请求
                const fetchPromise = fetch("https://api.deepseek.com/chat/completions", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                    body: JSON.stringify({ 
                        model: "deepseek-chat", 
                        messages: [systemPrompt, userPrompt], 
                        stream: false, 
                        temperature: 0.6, 
                        max_tokens: 300 // 限制字数
                    })
                });

                // 🌟 2. 准备一个 8.5 秒的私人死亡倒计时
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("AI_TIMEOUT")), 8500)
                );

                // 🌟 3. 让他们两个去赛跑 (谁先完成就听谁的)
                const response = await Promise.race([fetchPromise, timeoutPromise]);

                if (!response.ok) throw new Error(`DeepSeek API 报错: ${response.status}`);
                const data = await response.json();
                
                let aiContent = data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                const aiQuestions = JSON.parse(aiContent);
                
                const formattedAiQs = aiQuestions.map((q, idx) => ({
                    ...q,
                    id: Date.now() + idx,
                    is_review: false
                }));

                finalQuestions.push(...formattedAiQs);
                console.log(`✅ AI 成功在 8.5 秒内补齐 ${formattedAiQs.length} 道新题`);

            } catch (aiErr) {
                // 🌟 4. 如果超时了，或者 AI 挂了，触发【优雅降级】！
                if (aiErr.message === "AI_TIMEOUT") {
                    console.warn("⚠️ AI 思考超过了 8.5 秒！触发紧急预案，派发备用题...");
                } else {
                    console.error("❌ AI 生成题目失败:", aiErr.message);
                }

                // 不让前端崩溃，直接硬塞一道“本地兜底题”
                finalQuestions.push({
                    id: Date.now(),
                    text: `(网络拥堵兜底题) 关于【${targetKp}】，下列说法最合理的是？`,
                    options: ["这是正确的描述", "这是个干扰项A", "这是个干扰项B", "这是个干扰项C"],
                    answer: "A",
                    difficulty_val: targetDiff.toFixed(2),
                    knowledge_point: targetKp,
                    analysis: "由于网络拥堵触发了本地备用题库，请直接选A体验流程。",
                    is_review: false
                });
                console.log("✅ 成功派发本地兜底备用题");
            }
        }

        // ==========================================
        // 📦 4. 打包发货给前端
        // ==========================================
        return { 
            statusCode: 200, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(finalQuestions) 
        };

    } catch (error) {
        console.error("💥 调度中心崩溃:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};