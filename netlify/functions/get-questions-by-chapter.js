const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    // 1. 鉴权 (Security Check)
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: "Unauthorized" };
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return { statusCode: 401, body: "Invalid Token" };
    const authenticatedUserId = user.id;

    // 2. 获取章节 ID
    const chapterId = event.queryStringParameters.id; 
    if (chapterId === undefined || chapterId === null) {
      return { statusCode: 400, body: "Chapter ID is required." };
    }

    console.log(`[调试] 开始查询第 ${chapterId} 单元，用户: ${authenticatedUserId}`);

    // ==========================================
    // 第一步：找知识点 (Knowledge Nodes)
    // ==========================================
    // 目标：找出所有 full_code 是 "1.%" 或 "01.%" 的知识点 ID
    // 这一步不需要 join，直接查单表，最稳。
    const { data: nodeData, error: nodeError } = await supabase
        .from('knowledge_nodes')
        .select('id') // 我们只需要 ID
        .or(`full_code.like.${chapterId}.%,full_code.like.0${chapterId}.%`);

    if (nodeError) throw nodeError;

    if (!nodeData || nodeData.length === 0) {
        console.log("[调试] Step 1: 未找到对应章节的知识点，返回空数组。");
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 提取 ID 列表，例如 [101, 102, 103]
    const nodeIds = nodeData.map(n => n.id);
    console.log(`[调试] Step 1: 找到 ${nodeIds.length} 个知识点`);


    // ==========================================
    // 第二步：找关联关系 (Link Table)
    // ==========================================
    // 目标：在 link 表里，找到 knowledge_point_id 在上面列表里的记录
    // 🔥 使用你提供的列名: knowledge_point_id
    const { data: linkData, error: linkError } = await supabase
        .from('question_knowledge_point_link')
        .select('question_id') // 🔥 使用你提供的列名: question_id
        .in('knowledge_point_id', nodeIds); // 🔥 使用你提供的列名: knowledge_point_id

    if (linkError) throw linkError;

    if (!linkData || linkData.length === 0) {
        console.log("[调试] Step 2: 这些知识点下没有关联任何题目。");
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 提取题目 ID 并去重
    const questionIds = [...new Set(linkData.map(l => l.question_id))];
    console.log(`[调试] Step 2: 关联到 ${questionIds.length} 道题目`);


    // ==========================================
    // 第三步：查题目详情 (Questions)
    // ==========================================
    const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);

    if (qError) throw qError;


    // ==========================================
    // 第四步：查用户做题记录 (Answers)
    // ==========================================
    // 单独查 answers，防止 Left Join 过滤掉没做过的题
    const { data: myAnswers, error: aError } = await supabase
        .from('answers')
        .select('question_id, is_correct')
        .eq('user_id', authenticatedUserId)
        .in('question_id', questionIds);

    if (aError) throw aError;


    // ==========================================
    // 第五步：合并数据
    // ==========================================
    const processedQuestions = questions.map(q => {
        const answerRecord = myAnswers.find(a => a.question_id === q.id);
        return {
            ...q,
            is_done: !!answerRecord, // 有记录就是做过
            is_correct_history: answerRecord ? answerRecord.is_correct : null
        };
    });

    console.log(`[调试] Step 3: 最终返回 ${processedQuestions.length} 道完整题目`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processedQuestions),
    };

  } catch (error) {
    console.error("API Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};