// 文件路径: netlify/functions/get-question-by-id.js
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  try {
    const questionId = event.queryStringParameters.id;
    if (!questionId) { return { statusCode: 400, body: "Question ID is required." }; }

    const { data: question, error } = await supabase
      .from('questions')
      .select(`*, question_knowledge_point_link(knowledge_points(*))`)
      .eq('id', questionId)
      .single(); // .single() 确保只返回一条记录

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify(question) };
  } catch (error) {
    console.error("获取单个题目时出错:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "获取题目失败。" }) };
  }
};