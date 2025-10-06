// 文件路径: netlify/functions/recommend-question.js (最终修复版)
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  const { user } = context.clientContext;
  if (!user) { return { statusCode: 401, body: JSON.stringify({ message: '未授权' }) }; }

  try {
    const { wrongQuestionId } = JSON.parse(event.body);
    if (!wrongQuestionId) {
      return { statusCode: 400, body: 'Wrong Question ID is required.' };
    }

    const { data: recommendedQuestion, error } = await supabaseAdmin
        .rpc('recommend_question', {
            wrong_question_id: wrongQuestionId,
            requesting_user_id: user.sub
        });

    // ▼▼▼ 核心改动：优雅地处理“找不到题目”的情况 ▼▼▼
    if (error) {
        // 如果错误代码是 PGRST116 (意味着返回了0行)，这不是一个真正的“错误”，
        // 我们只需要返回 null 即可。
        if (error.code === 'PGRST116') {
            return {
                statusCode: 200,
                body: JSON.stringify(null), // 明确告诉前端，没有找到题目
            };
        }
        // 如果是其他类型的错误，则正常抛出
        throw error;
    }
    // ▲▲▲ 核心改动结束 ▲▲▲

    return {
      // 如果找到了题目(data不是空数组)，则返回第一项
      statusCode: 200,
      body: JSON.stringify(recommendedQuestion[0] || null), 
    };

  } catch (error) {
    console.error('推荐题目时出错:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};