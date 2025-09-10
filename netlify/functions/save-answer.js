// 文件路径: netlify/functions/save-answer.js

// 从“工具包”里引入创建客户端的工具
const { createClient } = require('@supabase/supabase-js');

// 从 Netlify 的“保险箱”（环境变量）里取出我们的两把钥匙
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// 使用钥匙，创建一个可以和我们的数据库对话的客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// “数据记录员”的工作手册
exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取答题记录
    const { questionId, isCorrect } = JSON.parse(event.body);
    
    // 为了未来做准备，我们先用一个固定的ID作为用户ID
    // 当我们有了真正的用户系统后，这里会换成真实的用户ID
    const placeholderUserId = '11111111-1111-1111-1111-111111111111';

    // 使用 Supabase 客户端，向 'answers' 表中插入一条新记录
    const { data, error } = await supabase
      .from('answers')
      .insert([
        { 
          question_id: questionId, 
          is_correct: isCorrect,
          user_id: placeholderUserId 
        },
      ]);

    // 如果插入过程中发生错误，就抛出错误
    if (error) {
      throw error;
    }

    // 如果成功，返回一个成功的消息
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