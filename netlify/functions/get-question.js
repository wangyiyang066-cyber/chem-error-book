// 文件路径: netlify/functions/get-question.js

const { createClient } = require('@supabase/supabase-js');

// 从环境变量中获取 Supabase 的连接信息
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取学生当前的水平和已经回答过的问题ID列表
    const { userLevel, answeredIds } = JSON.parse(event.body);
    let difficultyToPick;

    // 根据学生水平决定要挑选的题目难度
    if (userLevel === 'good') {
      difficultyToPick = 'hard';
    } else if (userLevel === 'poor') {
      difficultyToPick = 'easy';
    } else {
      difficultyToPick = 'medium';
    }

    // 在数据库中查询符合难度且用户没答过的题目
    let { data: questions, error } = await supabase
      .from('questions')
      .select(`
        *,
        knowledge_points ( * )
      `) // 使用 '*' 获取所有列，并带上关联的知识点信息
      .eq('difficulty', difficultyToPick) // 筛选难度
      .not('id', 'in', `(${answeredIds.join(',')})`); // 排除已答过的题目

    if (error) throw error;

    // 如果该难度的题都答完了，就从所有未答过的题目里选
    if (!questions || questions.length === 0) {
      let { data: fallbackQuestions, error: fallbackError } = await supabase
        .from('questions')
        .select(`
          *,
          knowledge_points ( * )
        `)
        .not('id', 'in', `(${answeredIds.join(',')})`);
      
      if (fallbackError) throw fallbackError;
      questions = fallbackQuestions;
    }
    
    // 如果真的所有题都答完了
    if (!questions || questions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify(null), // 返回 null 表示没有更多题目
      };
    }

    // 从可选题目中随机抽一道
    const randomIndex = Math.floor(Math.random() * questions.length);
    const selectedQuestion = questions[randomIndex];

    // 将选中的题目返回给前端
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