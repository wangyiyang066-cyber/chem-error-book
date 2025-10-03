// 文件路径: netlify/functions/save-answer.js (V2版 - 记录用户答案)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // <<< 核心改动：从前端获取更多信息：题目ID, 是否正确, 用户的答案, 以及用户ID >>>
    const { questionId, isCorrect, userAnswer, userId } = JSON.parse(event.body);
    
    // 如果没有用户ID，则不处理
    if (!userId) {
      return { statusCode: 400, body: "User ID is required." };
    }

    const { data, error } = await supabase
      .from('answers')
      .insert([
        { 
          question_id: questionId, 
          is_correct: isCorrect,
          user_id: userId,
          user_answer: userAnswer // <<< 核心改动：把用户的答案也存进去
        },
      ]);

    if (error) { throw error; }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: '答题记录已成功保存！' }),
    };
  } catch (error) {
    console.error("保存答案时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "保存答案失败。" }),
    };
  }
};