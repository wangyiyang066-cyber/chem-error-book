// 文件路径: netlify/functions/update-review-status.js
// important, 论文里面的代码流程就是跟着这个写的
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

exports.handler = async function (event, context) {
  const { user } = context.clientContext;
  if (!user) { return { statusCode: 401, body: JSON.stringify({ message: '未授权' }) }; }

  try {
    const { reviewId, isCorrect } = JSON.parse(event.body);
    if (!reviewId) { return { statusCode: 400, body: 'Review ID is required.' }; }

    // 1. 获取当前复习项的状态
    const { data: currentReview, error: fetchError } = await supabaseAdmin
      .from('review_queue')
      .select('current_interval_days, repetitions')
      .eq('id', reviewId)
      .single();
    if (fetchError) throw new Error('找不到该复习记录');

    let newIntervalDays, newRepetitions;
    
    if (isCorrect) {
      // 2a. 如果答对，计算下一次的间隔
      // 简单版艾宾浩斯：间隔时间大约翻倍
      newRepetitions = currentReview.repetitions + 1;
      newIntervalDays = Math.round(currentReview.current_interval_days * (1.6 + (newRepetitions * 0.1)));
    } else {
      // 2b. 如果答错，重置复习计划
      newRepetitions = 0;
      newIntervalDays = 1; // 间隔重置为1天
    }

    // 3. 计算新的到期日
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + newIntervalDays);

    // 4. 更新数据库
    const { error: updateError } = await supabaseAdmin
      .from('review_queue')
      .update({
        due_date: newDueDate.toISOString(),
        current_interval_days: newIntervalDays,
        repetitions: newRepetitions,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);
      
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ message: '复习状态已更新' }) };
  } catch (error) {
    console.error('更新复习状态时出错:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};