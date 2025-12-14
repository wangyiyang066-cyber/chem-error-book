// netlify/functions/save-answer.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { questionId, isCorrect, userAnswer, userId } = JSON.parse(event.body);

    // 1. 保存答题记录 (Answers 表)
    const { error: saveError } = await supabase
      .from('answers')
      .insert([{ user_id: userId, question_id: questionId, is_correct: isCorrect, user_answer: userAnswer }]);
    if (saveError) throw saveError;

    // --- 🔥 核心升级：数据统计与能力估算 ---

    // 2. 获取这道题的详细信息（难度、关联知识点）
    const { data: questionData } = await supabase
      .from('questions')
      .select(`difficulty, question_knowledge_point_link(knowledge_point_id)`)
      .eq('id', questionId)
      .single();

    const difficulty = parseFloat(questionData.difficulty || 0.5);
    const kpId = questionData.question_knowledge_point_link?.[0]?.knowledge_point_id;

    // 3. 更新知识点易错统计 (Knowledge Analytics)
    if (kpId) {
       // RPC 调用或者直接 Update，这里用简单的 SQL 逻辑
       // 如果答错，error_count + 1，无论对错 total_attempts + 1
       const incrementError = isCorrect ? 0 : 1;
       await supabase.rpc('increment_knowledge_stats', { 
         row_id: kpId, 
         inc_total: 1, 
         inc_error: incrementError 
       });
       // 注意：你需要在 Supabase SQL Editor 里创建这个 rpc 函数，
       // 如果嫌麻烦，也可以用 .select().update() 两步走，但在高并发下不准。
       // 为了方便你，文末我会给你这个 RPC 的 SQL。
    }

    // 4. 更新学生能力值 (Simplified IRT / ELO Rating)
    // 先获取当前能力
    let { data: userStat } = await supabase.from('user_stats').select('ability_score').eq('user_id', userId).single();
    
    let currentAbility = userStat ? userStat.ability_score : 0.5; // 默认 0.5
    
    // === 算法核心 ===
    // 学习率 K: 控制能力值变化的幅度
    const K = 0.1; 
    // 预期得分 Probability: 能力越高，做对概率越大
    const expectedScore = 1 / (1 + Math.pow(10, (difficulty - currentAbility)));
    // 实际得分: 对=1, 错=0
    const actualScore = isCorrect ? 1 : 0;
    
    // 新能力值 = 旧能力 + K * (实际 - 预期)
    let newAbility = currentAbility + K * (actualScore - expectedScore);
    
    // 限制范围 0.1 ~ 0.99
    newAbility = Math.max(0.1, Math.min(0.99, newAbility));

    // 存回数据库
    await supabase.from('user_stats').upsert({ 
        user_id: userId, 
        ability_score: newAbility,
        // 这里简单处理，实际上应该 atomic increment
        updated_at: new Date()
    });

    return { statusCode: 200, body: JSON.stringify({ message: "Saved & Stats Updated" }) };

  } catch (error) {
    console.error("保存失败:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};