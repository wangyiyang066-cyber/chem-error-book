// 文件路径: netlify/functions/update-answer.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 从前端获取要修改的答案记录的 ID
    const { answerId } = JSON.parse(event.body);
    if (!answerId) {
      return { statusCode: 400, body: "Answer ID is required." };
    }

    // 在 answers 表中，找到对应 ID 的记录，
    // 并将 is_correct 字段更新为 true
    const { data, error } = await supabase
      .from('answers')
      .update({ is_correct: true })
      .eq('id', answerId);

    if (error) {
      throw error;
    }

    // 返回成功的消息
    return {
      statusCode: 200,
      body: JSON.stringify({ message: '错题记录已更新！' }),
    };

  } catch (error) {
    console.error("更新答案时发生错误:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "更新答案失败。" }),
    };
  }
};