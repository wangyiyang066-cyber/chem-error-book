// 不改了
// 文件路径: netlify/functions/get-comprehensive-exam.js

const { createClient } = require('@supabase/supabase-js');

// 直接读取 Netlify 环境变量（部署后自动获取，本地 netlify dev 读取 .env）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  // 1. 只允许 GET 请求
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const userId = event.queryStringParameters.userId; // 获取前端传来的用户ID
    const EXAM_SIZE = 20; // 固定抽取 20 题

    console.log(`正在为用户 ${userId || '匿名'} 生成综合试卷...`);

    // 2. 数据库查询：查出所有【综合题】
    // 同时关联查询：知识点(用于判断单元)、答题记录(用于判断是否做过)
    let query = supabase
        .from('questions')
        .select(`
            *,
            question_knowledge_point_link!inner (
                knowledge_nodes!inner (full_code)
            ),
            answers(id)
        `)
        .eq('zongheti', true); // 🔥 只选综合题库

    // 如果有用户ID，只查该用户的答题记录
    if (userId) {
        query = query.eq('answers.user_id', userId);
    }

    const { data: allQuestions, error } = await query;
    if (error) throw error;

    if (!allQuestions || allQuestions.length === 0) {
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 3. 数据预处理：给题目打上“单元”和“已做”的标签
    const processedList = allQuestions.map(q => {
        // 判断是否做过
        const isDone = userId && q.answers && q.answers.length > 0;
        
        // 提取单元号：比如 "1.2.3" -> "1"，"3.1" -> "3"
        // 如果没有知识点，归为 "unknown"
        let unit = 'unknown';
        if (q.question_knowledge_point_link?.[0]?.knowledge_nodes?.full_code) {
            const code = q.question_knowledge_point_link[0].knowledge_nodes.full_code;
            unit = code.split('.')[0]; 
        }

        // 清理不需要的字段，减小体积
        const { answers, question_knowledge_point_link, ...rest } = q;
        return { ...rest, is_done: isDone, _unit: unit };
    });

    // 4. 分池策略：优先从未做的题目里选
    const notDonePool = processedList.filter(q => !q.is_done);
    const donePool = processedList.filter(q => q.is_done);

    // --- 核心算法：按单元均匀轮询抽取 (Round Robin) ---
    function smartSelect(pool, count) {
        if (count <= 0 || pool.length === 0) return [];
        
        // A. 把题目按单元扔进不同的桶里
        const buckets = {};
        pool.forEach(q => {
            if (!buckets[q._unit]) buckets[q._unit] = [];
            buckets[q._unit].push(q);
        });

        // B. 打乱每个桶里的题目顺序
        Object.keys(buckets).forEach(k => {
            buckets[k].sort(() => 0.5 - Math.random());
        });

        const selected = [];
        const unitKeys = Object.keys(buckets);
        
        // C. 轮流从每个单元桶里拿题目，直到拿够数量
        while (selected.length < count && unitKeys.length > 0) {
            // 打乱单元顺序（防止每次都从第1单元开始拿，稍微随机一点）
            unitKeys.sort(() => 0.5 - Math.random()); 

            for (let i = 0; i < unitKeys.length; i++) {
                if (selected.length >= count) break;
                
                const unit = unitKeys[i];
                const q = buckets[unit].pop(); // 拿出一个
                
                if (q) {
                    selected.push(q);
                } else {
                    // 这个单元桶空了，从轮询名单里踢掉
                    unitKeys.splice(i, 1);
                    i--;
                }
            }
        }
        return selected;
    }

    // 5. 执行选题
    // 先全力从未做题池里选 20 个
    let finalQuestions = smartSelect(notDonePool, EXAM_SIZE);

    // 如果不够 20 个（比如只剩下 5 道新题），就用已做过的题补齐
    if (finalQuestions.length < EXAM_SIZE) {
        const needMore = EXAM_SIZE - finalQuestions.length;
        const supplementary = smartSelect(donePool, needMore);
        finalQuestions = [...finalQuestions, ...supplementary];
    }

    // 6. 最后再次把整套卷子打乱，防止同一个单元的题挨在一起
    finalQuestions.sort(() => 0.5 - Math.random());

    console.log(`组卷完成：共${finalQuestions.length}题`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalQuestions),
    };

  } catch (error) {
    console.error("综合组卷失败:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "组卷失败，请稍后重试" }),
    };
  }
};