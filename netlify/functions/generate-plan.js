// 文件路径: netlify/functions/generate-plan.js
const { createClient } = require('@supabase/supabase-js');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getServerWeekId() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  // 🌟 1. 从请求头拦截身份 Token 🌟
  const authHeader = event.headers.authorization;
  if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: '未提供认证信息，拒绝访问' }) };
  }
  const token = authHeader.split(' ')[1];

  try {
    const body = JSON.parse(event.body);
    const { theta, trace } = body;

    // 🌟 2. 带着 Token 初始化 Supabase 客户端 🌟
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 🌟 3. 让 Supabase 验证 Token 并返回绝对真实的 User ID 🌟
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        throw new Error("Token 无效或已过期，请重新登录");
    }
    const real_user_id = user.id; // 这就是无法伪造的真实 ID！

    // ==========================================
    // 调用 DeepSeek 生成计划 (极速版逻辑)
    // ==========================================
    let traceContext = trace.length > 0 
        ? trace.map((t, i) => `Q${i+1}:考点[${t.kp}],难度[${t.difficulty}],${t.isCorrect?'对':'错'},${t.timeSpent}s`).join(";")
        : "无";

    const systemPrompt = { role: "system", content: "你是一个极其高效的数据生成器。只输出紧凑的JSON数组，绝不换行，绝不包含任何解释或Markdown符号。语言极度精简。" };
const userPrompt = { 
            role: "user", 
            content: `
以下是学生和规划导师的完整对话记录（学生共创计划的过程）：
${JSON.stringify(chat_history || [])}

学生的诊断能力值 Theta: ${parseFloat(theta).toFixed(2)}。
基础轨迹: ${traceContext}。

【你的引导指令 - 请严格按逻辑执行】 你需要模拟一位在身边的专属规划导师，**严禁一次性输出所有阶段内容**，必须根据学生的当前回答，匹配对应阶段，单次只聚焦当前阶段的引导，循序渐进推进： 
**第一阶段：学习目标** 
判断学生是否目标模糊、不可衡量、脱离实际-
先不评判初始想法，温和询问：“我们先从制定计划的核心起点开始，你做这份学习计划，最核心的学习目标是什么？”
“可以具体说说这个目标需要多长时间、最终要达成的结果吗？
“你觉得我们用什么标准能明确判断这个目标最终有没有达成呢？” 
第二阶段：学情与资源盘点（元认知唤醒）
如果目标已清晰可衡量，引导学生全面认知自身现状与可用资源* - 
询问：“明确了核心目标后，你觉得可以利用哪些资源去实现呢？”
“为了实现目标，你目前的哪些习惯可以保持？哪些情况需要改进？”
 “除此之外，你认为达成目标还需要注意哪些问题？” 
- **分支逻辑**： - 如果学生完整盘点了学情、时间与可用资源：给予肯定，进入第三阶段。 - 如果学生盘点有遗漏/认知偏差：用提问引导他自主补充，不直接替他完善，比如“除了攻克薄弱板块，你有没有考虑过其他有助于实现学习目标的做法呀？”
 **第三阶段：目标拆解与路径搭建
现状与目标清晰，引导学生自主拆解目标、搭建执行路径，使目标落地。 - 
询问：“现在我们有了清晰的目标和明确的现状，你觉得这个大目标，可以拆解成哪些阶段性的小目标？每个小目标对应的周期、要完成的核心任务是什么？” - 
补充引导：“这些阶段性任务，对应到每周/每天，需要完成哪些具体的学习动作呢？”
 - **分支逻辑**： - 如果学生拆解合理、贴合自身时间：给予肯定，进入第四阶段。 - 如果学生拆解过满/过松/逻辑不通：用提问引导他自主发现问题，比如“你觉得这个阶段的任务量，结合你每天的计划时间，能不能保证完成呢？有没有可以调整的地方？” 
**第四阶段：计划细化与最终成型*
 触发前提：学生已完成合理的目标拆解、执行路径搭建 - 
核心规则：**严禁直接提供时段模板、任务完成标准、现成计划表**，全程通过提问引导学生自主匹配执行时段、明确完成标准，自主梳理出完整可直接执行的学习计划 - 
引导执行逻辑： 1. 初始引导（贴合指定开头示例）：“那我们现在把拆解好的任务落到实处，你觉得这些具体的学习任务，分别对应到你每周/每天的哪些时段来完成最合适呢？” 2. 跟进引导（学生完成时段匹配后）：“非常好，那对应每个时段的学习任务，你觉得要多长时间复习一次，才能明确知道自己有没有完成到位呢？”（这里我觉得可以直接用艾宾浩斯曲线去制定，或者询问学生自己的意见也可以）
 3. 收尾引导（学生明确完成标准后）：“太棒了，现在请你把这些时段安排和完成标准整合起来，自主梳理出一份你可以直接照着执行的完整学习计划吧。”（要是不成型也没关系，AI已经可以通过之前的问答制定出成型的方案了，但是这里学生如果能自己写出来就更好了）
 4. 固定要求：学生计划成型后，必须输出一句简短真诚的鼓励，示例：“这份完全贴合你自身情况的学习计划特别扎实，稳步执行一定能一步步靠近你的目标，加油！” - 
分支逻辑： - 若学生时段匹配/标准设定合理、贴合自身实际：给予正向肯定，推进到下一环节 - 若学生安排过满/标准模糊/脱离实际：用提问引导自主调整，比如“你觉得这个时段安排的任务量，结合你的日常状态，能稳定完成吗？有没有可以优化的地方？”，严禁直接替学生修改。
【回复要求】 1. **语气**：亲切、耐心、循循善诱，像面对面和学生聊天，不生硬不说教。 
**核心禁令**：严禁直接给出现成的学习计划、固定模板、完整方案！严禁替学生做目标拆解、任务安排！所有内容必须通过提问引导学生自主思考、自主产出。 
3. **格式**：分段清晰，核心词汇可以加粗。 
4. **节奏控制**：单次只聚焦当前阶段的引导，不提前透露后续内容，严格跟着学生的回答推进。 
5. **字数**：单次引导内容控制在200字以内，多提问，少说教。

任务要求：
仔细阅读上述对话记录中【学生最终自己梳理出的学习计划】。
将这份共创的计划，严格按照以下 JSON 格式提取为未来 7 天的学习路线图。要求task极简(限10字)，kp(考点)必须明确。如果没有聊满7天，请根据导师的思路自动合理推演补齐剩余天数。
[{"day":"周一","date":"今天","target_diff":"${(parseFloat(theta)+0.05).toFixed(2)}","task":"复习错题","kp":"质量守恒"}]
            ` 
        };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [systemPrompt, userPrompt], stream: false, temperature: 0.1, max_tokens: 300 })
    });

    if (!response.ok) throw new Error(`DeepSeek API 错误: ${response.status}`);
    
    const data = await response.json();
    let aiContent = data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsedPlan = JSON.parse(aiContent);

    // ==========================================
    // 🌟 4. 安全存入数据库 🌟
    // ==========================================
    const weekId = getServerWeekId();
    const { error: dbError } = await supabase
        .from('weekly_plans')
        .insert([{ 
            user_id: real_user_id, // 使用刚刚验证通过的真实 ID
            week_id: weekId,
            theta_score: theta.toFixed(3),
            plan_json: parsedPlan 
        }]);

    if (dbError) throw dbError;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedPlan) };

  } catch (error) {
    console.error("系统运行失败:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};