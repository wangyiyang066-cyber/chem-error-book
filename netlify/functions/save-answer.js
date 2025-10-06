// 文件路径: netlify/functions/save-answer.js (V4版 - 错题立即复习)

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { questionId, isCorrect, userAnswer, userId } = JSON.parse(event.body);
    if (!userId || !questionId) {
      return { statusCode: 400, body: "User ID and Question ID are required." };
    }

    // 步骤1：记录本次答题历史
    const { error: answerError } = await supabase
      .from('answers')
      .insert([{ question_id: questionId, is_correct: isCorrect, user_id: userId, user_answer: userAnswer }]);
    if (answerError) { throw answerError; }

    // 步骤2：如果答错了，启动智能复习计划
    if (isCorrect === false) {
      // ▼▼▼ 核心改动：把复习日期从“明天”改为“现在” ▼▼▼
      const now = new Date();
      // ▲▲▲ 核心改动结束 ▲▲▲

      const { error: reviewError } = await supabase
        .from('review_queue')
        .upsert({
            user_id: userId,
            question_id: questionId,
            due_date: now.toISOString(), // 让错题立即出现在复习队列中
            current_interval_days: 1,
            repetitions: 0
          }, {
            onConflict: 'user_id,question_id'
          });
      if (reviewError) { throw reviewError; }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: '答题记录已成功保存！' }) };
  } catch (error) {
    console.error("保存答案时发生错误:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "保存答案失败。" }) };
  }
};