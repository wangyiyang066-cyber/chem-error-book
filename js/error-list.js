// js/error-list.js

// 等待 main.js 加载完毕并获取到用户信息
document.addEventListener('userReady', async () => {
    // user 对象由 main.js 提供
    if (!user) {
        // 如果没有用户信息，理论上 main.js 会处理跳转，这里是双重保险
        document.getElementById('error-list-container').innerHTML = '<p>请先登录再查看错题。</p>';
        return;
    }

    const container = document.getElementById('error-list-container');
    
    try {
        // 呼叫我们的“档案管理员”云函数，并把当前用户ID发给他
        const response = await fetch('/.netlify/functions/get-user-errors', {
            method: 'POST',
            body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
            throw new Error('获取错题数据失败');
        }

        const wrongAnswers = await response.json();
        
        // 清空“正在加载”的提示
        container.innerHTML = ''; 
        
        if (wrongAnswers.length === 0) {
            container.innerHTML = '<p>太棒了！你目前没有错题记录。</p>';
            return;
        }

        // 遍历每一条错题记录，并把它们转换成 HTML 显示出来
        wrongAnswers.forEach(answer => {
            const errorCard = document.createElement('div');
            errorCard.classList.add('detail-card');
            
            // 提取知识点名称
            const kpNames = answer.questions.question_knowledge_point_link
                .map(link => link.knowledge_points.name)
                .join('; ');

            // 格式化日期
            const answeredDate = new Date(answer.answered_at).toLocaleString('zh-CN');

            errorCard.innerHTML = `
                <h4>题目内容：</h4>
                <p>${answer.questions.full_question}</p>
                ${answer.questions.image_url ? `<img src="${answer.questions.image_url}" alt="题目图片" style="max-width: 100%; border-radius: 8px;">` : ''}
                
                <div class="detail-card answer-wrong" style="margin-top:15px;">
                    <p><b>你的错误答案:</b> ${answer.user_answer}</p>
                </div>
                <div class="detail-card answer-correct" style="margin-top:15px;">
                    <p><b>正确答案:</b> ${answer.questions.correct_answer}</p>
                </div>
                
                <p style="margin-top:15px; font-size: 0.9em; color: #7f8c8d;">
                    <b>关联知识点:</b> ${kpNames}<br>
                    <b>答错时间:</b> ${answeredDate}
                </p>
            `;
            container.appendChild(errorCard);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p>加载错题记录时出错，请稍后再试。</p>';
    }
});