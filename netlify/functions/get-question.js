// 文件路径: netlify/functions/get-question.js (已修正查询版本)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { userLevel, answeredIds } = JSON.parse(event.body);
    let difficultyToPick;

    if (userLevel === 'good') {
      difficultyToPick = 'hard';
    } else if (userLevel === 'poor') {
      difficultyToPick = 'easy';
    } else {
      difficultyToPick = 'medium';
    }

    // --- ↓↓↓ 核心改动：修正查询指令，让它通过“连接表”来获取知识点信息 ↓↓↓ ---
    let { data: questions, error } = await supabase
      .from('questions')
      .select(`
        *,
        question_knowledge_point_link (
          knowledge_points ( * )
        )
      `)
      .eq('difficulty', difficultyToPick)
      .not('id', 'in', `(${answeredIds.join(',')})`);
    // --- ↑↑↑ 核心改动结束 ↑↑↑ ---

    if (error) throw error;

    if (!questions || questions.length === 0) {
      let { data: fallbackQuestions, error: fallbackError } = await supabase
        .from('questions')
        .select(`*, question_knowledge_point_link(knowledge_points(*))`)
        .not('id', 'in', `(${answeredIds.join(',')})`);
      if (fallbackError) throw fallbackError;
      questions = fallbackQuestions;
    }
    
    if (!questions || questions.length === 0) {
      return { statusCode: 200, body: JSON.stringify(null) };
    }

    const randomIndex = Math.floor(Math.random() * questions.length);
    const selectedQuestion = questions[randomIndex];

    return {
      statusCode: 200,
      body: JSON.stringify(selectedQuestion),
    };

  } catch (error) {
    console.error("获取题目时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取题目失败。" }),
    };
  }
};