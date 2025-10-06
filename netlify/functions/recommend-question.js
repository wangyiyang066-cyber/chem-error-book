// 文件路径: netlify/functions/recommend-question.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // 需要用 Service Key 来调用安全函数
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  const { user } = context.clientContext;
  if (!user) { return { statusCode: 401, body: JSON.stringify({ message: '未授权' }) }; }

  try {
    const { wrongQuestionId } = JSON.parse(event.body);
    if (!wrongQuestionId) {
      return { statusCode: 400, body: 'Wrong Question ID is required.' };
    }

    // 调用我们在数据库中创建的 `recommend_question` 函数
    const { data: recommendedQuestion, error } = await supabaseAdmin
        .rpc('recommend_question', {
            wrong_question_id: wrongQuestionId,
            requesting_user_id: user.sub
        })
        .single(); // 我们期望只返回一道题或null

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify(recommendedQuestion), // 返回找到的题目，如果没找到则为 null
    };

  } catch (error) {
    console.error('推荐题目时出错:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};