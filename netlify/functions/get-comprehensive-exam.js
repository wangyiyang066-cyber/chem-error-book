// 文件路径: netlify/functions/get-comprehensive-exam.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 一个辅助函数，用于打乱数组并从中抽取指定数量的元素
function shuffleAndPick(array, count) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 定义模拟试卷的结构
    const examConfig = {
      easy: 10,
      medium: 6,
      hard: 4,
    };

    // 并行从数据库中获取所有难度的题目
    const [easyResponse, mediumResponse, hardResponse] = await Promise.all([
      supabase.from('questions').select(`*, question_knowledge_point_link(knowledge_points(*))`).eq('difficulty', 'easy'),
      supabase.from('questions').select(`*, question_knowledge_point_link(knowledge_points(*))`).eq('difficulty', 'medium'),
      supabase.from('questions').select(`*, question_knowledge_point_link(knowledge_points(*))`).eq('difficulty', 'hard'),
    ]);

    if (easyResponse.error || mediumResponse.error || hardResponse.error) {
        // 如果任何一个查询出错，就抛出错误
        throw easyResponse.error || mediumResponse.error || hardResponse.error;
    }

    // 从获取到的各类题目中，按配置随机抽取
    const easyQuestions = shuffleAndPick(easyResponse.data, examConfig.easy);
    const mediumQuestions = shuffleAndPick(mediumResponse.data, examConfig.medium);
    const hardQuestions = shuffleAndPick(hardResponse.data, examConfig.hard);

    // 将所有抽取的题目合并成一套完整的试卷
    let examQuestions = [...easyQuestions, ...mediumQuestions, ...hardQuestions];
    
    // 再次打乱最终的试卷顺序，避免简单题总是在前面
    examQuestions = examQuestions.sort(() => 0.5 - Math.random());
    
    return {
      statusCode: 200,
      body: JSON.stringify(examQuestions),
    };

  } catch (error) {
    console.error("生成综合试卷时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "生成综合试卷失败。" }),
    };
  }
};