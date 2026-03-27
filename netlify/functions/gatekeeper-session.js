const { createClient } = require('@supabase/supabase-js');
// 注意：如果本地报错找不到 node-fetch，可能需要 npm install node-fetch@2
const fetch = require('node-fetch'); 

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

exports.handler = async (event) => {
    console.log("\n========================================");
    console.log("🚀 [STEP 0] 收到前端请求，函数被触发");
    
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    console.log("🔑 [STEP 1] 检查环境变量...");
    if (!DEEPSEEK_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("❌ 严重错误：环境变量未完全加载！");
        return { statusCode: 500, body: JSON.stringify({ error: "服务器环境变量缺失" }) };
    }

    console.log("🛡️ [STEP 2] 检查 Authorization Header...");
    const authHeader = event.headers.authorization;
    if (!authHeader) {
        console.error("❌ 错误：前端没有传 Token 过来");
        return { statusCode: 401, body: "Unauthorized" };
    }
    const token = authHeader.split(' ')[1];

    try {
        console.log("📦 [STEP 3] 解析前端传来的 Body 数据...");
        const body = JSON.parse(event.body);
        const { chat_history, is_initial, user_input } = body;
        console.log(`   - is_initial: ${is_initial}`);
        console.log(`   - user_input: ${user_input || '无'}`);
        console.log(`   - chat_history 长度: ${chat_history ? chat_history.length : 0}`);

        console.log("🔌 [STEP 4] 初始化 Supabase...");
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        console.log("👤 [STEP 5] 验证用户身份...");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            console.error("❌ 用户验证失败:", authError);
            throw new Error("Token 可能已过期或无效，请重新登录");
        }
        console.log(`   ✅ 验证成功！User ID: ${user.id}`);

        let studentContext = "";

        if (is_initial) {
            console.log("🗄️ [STEP 6] 首次启动，正在精准查询 answers 关联表...");
            
            // 🌟 完美复刻你的多表联查逻辑
            const { data: errors, error: dbError } = await supabase
                .from('answers')
                .select(`
                    id,
                    user_answer,
                    questions (
                        full_question,
                        question_knowledge_point_link (
                            knowledge_nodes ( title )
                        )
                    )
                `)
                .eq('user_id', user.id)
                .eq('is_correct', false);

            if (dbError) {
                console.error("❌ 数据库查询报错:", dbError);
                throw new Error(`数据库查询失败: ${dbError.message}`);
            }

            console.log(`   ✅ 查到 ${errors ? errors.length : 0} 条真实错题记录`);

            // 🧠 智能提取高频薄弱知识点 (提取 knowledge_nodes.title)
            const kpList = [];
            if (errors) {
                errors.forEach(err => {
                    // 剥洋葱：解析出你嵌套的 title
                    const links = err.questions?.question_knowledge_point_link;
                    if (links && Array.isArray(links)) {
                        links.forEach(link => {
                            if (link.knowledge_nodes?.title) {
                                kpList.push(link.knowledge_nodes.title);
                            }
                        });
                    }
                });
            }

            // 统计哪些知识点错得最多（频次 >= 2 算顽固）
            const kpCounts = {};
            kpList.forEach(kp => kpCounts[kp] = (kpCounts[kp] || 0) + 1);
            const stubbornKPs = Object.keys(kpCounts).filter(kp => kpCounts[kp] >= 2);

            studentContext = `
            【学生当前真实错题现状】
            - 待复习错题总数：${errors ? errors.length : 0} 道
            - 高频薄弱知识点（反复做错的节点）：${stubbornKPs.length > 0 ? stubbornKPs.join('、') : (kpList[0] || '暂无')}
            `;
            
            console.log("   ✅ 学生 Context 组装完毕:\n", studentContext);
        } else {
            console.log("⏩ [STEP 6] 非首次启动，跳过数据库查询");
        }

        // ==========================================
        // 🧠 [STEP 7] 终极融合版：宏观体系 + 微观认知 提示词
        // ==========================================
        console.log("🧠 [STEP 7] 组装 DeepSeek Prompt...");
        const systemPrompt = {
            role: "system",
            content: `你是一位拥有16年一线教学经验、深谙认知心理学（“检索练习”与“自适应间隔重复”）的资深错题管理导师。
            你的任务是通过**苏格拉底提问法**，以一道具体的错题为切入点，引导学生完成错因复盘，并借此建立这类错题的专属管理规则。

            请严格按照以下【微观溯源与宏观建构 5 阶段】推进，必须根据学生的当前回答匹配对应阶段，单次只聚焦当前阶段：

            **[STAGE_1] 错因溯源 (Retrieval Practice)**
            - **动作**：开场直接向学生展示【今日靶向目标】中的题目、他的错答和正确答案。
            - **提问**：“今天我们要攻克这道题。你当时的答案是 X，正确答案是 Y。现在回想一下，当时是卡在哪一步了？是概念记混了，计算失误，还是没看懂题目？”（引导学生自主说出具体错因）

            **[STAGE_2] 错题分类与防坑策略**
            - **动作**：根据学生上一轮反思的错因。
            - **提问**：“总结得很好。既然是因为[学生说的错因]导致做错，如果在错题本里给它打个标签，你会把它归类为什么类型的错题？针对这类错题，你觉得下次复习时，重点是重做一遍，还是把核心考点默写出来？”

            **[STAGE_3] 场景匹配与完成标准（宏观体系建构）**
            - **动作**：触发前提是学生已明确分类和防坑动作。
            - **提问**：“那我们把这个防坑动作落到实处。你觉得以后处理这类错题，对应到你日常学习的哪个具体场景执行最合适？（比如作业订正后、考前周末）对应这个场景，我们要设定什么样的**可量化、可核对的完成标准**，才能明确知道自己有没有做到位？”

            **[STAGE_4] AI 动态间隔推演 (Adaptive Spacing)**
            - **动作**：评估学生对该题的认知负荷（Cognitive Load）。
            - **提问**：“太棒了，场景和标准都有了。最后，刚才反思这道题的时候，你觉得把逻辑理顺‘非常吃力’、‘稍微有点绕’还是‘一点就通’？我们要根据你的大脑对这道题的‘陌生程度’，来定制下一次复习的最佳时间。”

            **[STAGE_5] 方案成型与锁定**
            - **动作**：基于学生第四阶段反馈的“吃力程度”，你作为 AI 结合认知模型给出最终建议（吃力->1天后复习；稍微绕->3天后；一点就通->7天后）。
            - **输出要求**：帮学生把前面的【错题分类】+【执行场景】+【完成标准】+【下次复习时间】整合梳理出来，给出一句简短真诚的鼓励，并明确告知复习计划已锁定。

            【核心回复要求】
            1. **语气**：亲切、耐心、循循善诱，像面对面和学生聊天。
            2. **核心禁令**：严禁直接给出现成模板、固定错因分类或完整方案！严禁替学生做决定！遇到学生安排脱离实际，用提问引导其自主优化。
            3. **格式**：分段清晰，核心词汇加粗。
            4. **字数与节奏**：单次引导控制在 200 字以内，每次最多抛出 1-2 个问题。绝不提前透露后续阶段内容。
            5. **阶段标记**：在每次回复的最末尾，必须隐蔽地打上当前的阶段标记，例如 [STAGE_1], [STAGE_2] 等（这极其重要，关乎前端UI流转）。
            `
        };

        const messages = [
            systemPrompt,
            { role: "user", content: studentContext + (is_initial ? "请开始第一阶段引导。" : `这是我的回答：${user_input}。请继续引导。`) },
            ...(chat_history || [])
        ];

        console.log("📡 [STEP 8] 正在向 DeepSeek 发送请求...");
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}` 
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ DeepSeek 接口报错！状态码: ${response.status}`);
            console.error(`   详细错误信息: ${errorText}`);
            throw new Error(`DeepSeek API 请求失败: ${response.status} - ${errorText}`);
        }

        console.log("✅ [STEP 9] DeepSeek 成功响应，正在解析...");
        const data = await response.json();
        const aiMessage = data.choices[0].message.content;

        console.log("🎉 [STEP 10] 流程全部走完，准备返回给前端！");
        console.log("========================================\n");
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: aiMessage })
        };

    } catch (error) {
        console.error("\n🚨🚨🚨 [FATAL ERROR] 捕获到致命错误 🚨🚨🚨");
        console.error(error);
        console.error("========================================\n");
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message, stack: error.stack }) 
        };
    }
};