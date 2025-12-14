const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const questionId = event.queryStringParameters.id;

    if (!questionId) {
      return { statusCode: 400, body: "Question ID is required." };
    }

    // 🔥 核心修复点：将 knowledge_points 改为 knowledge_nodes
    let { data: question, error } = await supabase
      .from('questions')
      .select(`
        *,
        question_knowledge_point_link (
          knowledge_nodes (
            id,
            title,
            full_code
          )
        )
      `)
      .eq('id', questionId)
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(question),
    };

  } catch (error) {
    console.error("获取单个题目时出错:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "获取题目详情失败" }),
    };
  }
};