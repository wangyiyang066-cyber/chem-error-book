// js/error-list.js (V2.1 - 修正作用域问题)

document.addEventListener('userReady', async () => {
    if (!user) {
        document.getElementById('error-list-container').innerHTML = '<p>请先登录再查看错题。</p>';
        return;
    }

    const container = document.getElementById('error-list-container');
    const subtitle = document.getElementById('subtitle');
    
    // --- ↓↓↓ 核心改动：在这里提前声明变量，让它在外面也可见 ↓↓↓ ---
    let wrongAnswers = []; 
    // --- ↑↑↑ 核心改动结束 ↑↑↑ ---
    
    try {
        const response = await fetch('/.netlify/functions/get-user-errors', {
            method: 'POST',
            body: JSON.stringify({ userId: user.id }),
        });
        if (!response.ok) throw new Error('获取错题数据失败');

        // --- 核心改动：这里不再用 const 声明，而是给外面的变量赋值 ---
        wrongAnswers = await response.json();
        
        container.innerHTML = ''; 
        
        if (wrongAnswers.length === 0) {
            subtitle.textContent = '太棒了！你目前没有需要订正的错题。';
            return;
        }

        subtitle.textContent = `你目前有 ${wrongAnswers.length} 道错题需要订正。`;

        wrongAnswers.forEach((answer, index) => {
            const errorCard = document.createElement('div');
            errorCard.classList.add('detail-card');
            errorCard.dataset.answerId = answer.id; 

            const kpNames = answer.questions.question_knowledge_point_link.map(link => link.knowledge_points.name).join('; ');
            const answeredDate = new Date(answer.answered_at).toLocaleString('zh-CN');

            errorCard.innerHTML = `
                <h3>${index + 1}. 题目内容：</h3>
                <p>${answer.questions.full_question}</p>
                ${answer.questions.image_url ? `<img src="${answer.questions.image_url}" alt="题目图片" style="max-width: 100%;">` : ''}
                
                <div class="detail-card answer-wrong" style="margin-top:15px;">
                    <p><b>你当时的错误答案:</b> ${answer.user_answer}</p>
                </div>

                <div class="correct-answer-container" style="display:none; margin-top:15px;">
                    <div class="detail-card answer-correct">
                        <p><b>正确答案:</b> ${answer.questions.correct_answer}</p>
                    </div>
                </div>
                <button class="btn-toggle-answer" style="margin-top:10px;">显示/隐藏正确答案</button>

                <div class="reattempt-container" style="margin-top:20px;">
                    <textarea class="reattempt-input" placeholder="在这里重新作答..."></textarea>
                    <button class="btn-submit-reattempt">提交订正</button>
                    <p class="reattempt-feedback" style="display:none; margin-top:10px;"></p>
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

    // --- 事件处理中心 ---
    // 现在，这里的代码就可以正常访问在外面声明的 wrongAnswers 变量了
    container.addEventListener('click', async (event) => {
        const target = event.target;
        const parentCard = target.closest('.detail-card[data-answer-id]');
        if (!parentCard) return;

        // 处理“显示/隐藏答案”按钮
        if (target.classList.contains('btn-toggle-answer')) {
            const answerContainer = parentCard.querySelector('.correct-answer-container');
            answerContainer.style.display = answerContainer.style.display === 'none' ? 'block' : 'none';
        }

        // 处理“提交订正”按钮
        if (target.classList.contains('btn-submit-reattempt')) {
            const answerId = parentCard.dataset.answerId;
            const reattemptInput = parentCard.querySelector('.reattempt-input');
            const feedbackEl = parentCard.querySelector('.reattempt-feedback');
            const newAnswer = reattemptInput.value.trim();
            
            const originalRecord = wrongAnswers.find(a => a.id == answerId);
            if (!originalRecord) return; // 安全检查
            const correctAnswer = originalRecord.questions.correct_answer.trim();

            if (newAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
                feedbackEl.textContent = '回答正确！正在从错题本中移除...';
                feedbackEl.style.color = 'green';
                feedbackEl.style.display = 'block';

                try {
                    await fetch('/.netlify/functions/update-answer', {
                        method: 'POST',
                        body: JSON.stringify({ answerId: answerId })
                    });
                    
                    parentCard.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    parentCard.style.opacity = '0';
                    parentCard.style.transform = 'scale(0.95)';
                    setTimeout(() => { 
                        parentCard.remove();
                        const remainingCards = container.querySelectorAll('.detail-card').length;
                        subtitle.textContent = `你目前有 ${remainingCards} 道错题需要订正。`;
                        if (remainingCards === 0) {
                             subtitle.textContent = '太棒了！你已经订正了所有错题。';
                        }
                    }, 500);

                } catch (e) {
                    feedbackEl.textContent = '更新记录失败，请稍后再试。';
                }

            } else {
                feedbackEl.textContent = '回答错误，请再试一次！';
                feedbackEl.style.color = 'red';
                feedbackEl.style.display = 'block';
            }
        }
    });
});