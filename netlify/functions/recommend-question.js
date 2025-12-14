// netlify/functions/recommend-question.js (IRT 自适应版)

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  // 从 context 获取用户信息 (确保已登录)
  // 本地测试时可能需要从 body 传 userId，这里假设已鉴权
  const { wrongQuestionId, userId } = JSON.parse(event.body); 

  try {
    // 1. 获取错题的知识点 ID
    const { data: wrongQ } = await supabase
      .from('questions')
      .select(`
        id, 
        question_knowledge_point_link(knowledge_point_id)
      `)
      .eq('id', wrongQuestionId)
      .single();
      
    const kpId = wrongQ?.question_knowledge_point_link?.[0]?.knowledge_point_id;
    
    if (!kpId) {
        return { statusCode: 200, body: JSON.stringify(null) }; // 没关联知识点，推不了
    }

    // 2. 获取学生当前的能力值 (IRT Theta)
    const { data: userStat } = await supabase
        .from('user_stats')
        .select('ability_score')
        .eq('user_id', userId)
        .single();
        
    // 如果是新用户，默认能力 0.5
    const userAbility = userStat ? userStat.ability_score : 0.5;

    console.log(`用户能力: ${userAbility}, 正在从知识点 ${kpId} 寻找题目...`);

    // 3. 核心推荐算法
    // 逻辑：在【同一个知识点】下，寻找难度最接近【用户能力 + 0.1】的题目
    // (Zone of Proximal Development, 最近发展区理论)
    
    const targetDifficulty = Math.min(0.95, userAbility + 0.05); // 稍微难一点点

    const { data: candidates } = await supabase
        .from('questions')
        .select(`
            *,
            question_knowledge_point_link!inner(knowledge_point_id)
        `)
        .eq('question_knowledge_point_link.knowledge_point_id', kpId)
        .neq('id', wrongQuestionId) // 不要推刚做错的原题
        .limit(20); // 先拿一批出来挑

    if (!candidates || candidates.length === 0) {
         return { statusCode: 200, body: JSON.stringify(null) };
    }

    // 4. 寻找难度最匹配的那一道
    // 按 |题目难度 - 目标难度| 排序
    candidates.sort((a, b) => {
        const diffA = Math.abs(parseFloat(a.difficulty) - targetDifficulty);
        const diffB = Math.abs(parseFloat(b.difficulty) - targetDifficulty);
        return diffA - diffB;
    });

    // 选出最佳匹配
    const bestMatch = candidates[0];

    return {
      statusCode: 200,
      body: JSON.stringify(bestMatch),
    };

  } catch (error) {
    console.error('自适应推荐失败:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};