// 文件路径: js/my-errors.js

document.addEventListener('userReady', () => {
    if (!user) return;

    // --- 1. 获取 DOM 元素 ---
    const tabControls = document.querySelector('.tab-controls');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const reviewQueueList = document.getElementById('review-queue-list');
    const allErrorsList = document.getElementById('all-errors-list');

    let allErrorsLoaded = false; // 一个旗帜，避免重复加载“所有错题”

    // --- 2. 标签页切换逻辑 ---
    tabControls.addEventListener('click', (event) => {
        const target = event.target;
        if (!target.classList.contains('tab-btn')) return;

        const tabId = target.dataset.tab;

        // 移除所有 active 状态
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // 添加 active 状态到被点击的标签和对应内容区
        target.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // 如果点击的是“所有错题”标签，并且是第一次点击，就加载数据
        if (tabId === 'all-errors' && !allErrorsLoaded) {
            loadAllErrors();
        }
    });

    // --- 3. 数据加载与渲染函数 ---

    // 加载“需要巩固的错题” (复习队列)
    async function loadReviewQueue() {
        try {
            const response = await fetch('/.netlify/functions/get-review-questions', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });
            const reviewItems = await response.json();

            reviewQueueList.innerHTML = ''; // 清空加载提示

            if (reviewItems && reviewItems.length > 0) {
                reviewItems.forEach(item => {
                    const question = item.questions;
                    const reviewLink = document.createElement('a');
                    // 关键：创建一个特殊的链接，包含 review 模式和题目ID、复习ID
                    reviewLink.href = `quiz.html?mode=review&questionId=${question.id}&reviewId=${item.id}`;
                    reviewLink.className = 'error-item';
                    
                    // 根据连续答对次数，设置不同的 data-repetitions 值，CSS会自动应用不同颜色
                    reviewLink.dataset.repetitions = Math.min(item.repetitions, 3); // 最多显示到第3种颜色

                    const questionText = question.full_question.replace(/\[question\]\d+(\.\d+)*\s*/, '');
                    reviewLink.innerHTML = `<p>${questionText}</p>`;
                    
                    reviewQueueList.appendChild(reviewLink);
                });
            } else {
                reviewQueueList.innerHTML = '<p>太棒了！目前没有需要巩固的错题。</p>';
            }
        } catch (error) {
            reviewQueueList.innerHTML = '<p>加载复习队列失败，请稍后再试。</p>';
        }
    }

    // 加载“所有错题” (历史记录)
    async function loadAllErrors() {
        allErrorsLoaded = true; // 升起旗帜，表示已加载
        try {
            // 这个云函数您之前已经提供给我了
            const response = await fetch('/.netlify/functions/get-user-errors', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });
            const wrongAnswers = await response.json();

            allErrorsList.innerHTML = ''; // 清空加载提示

            if (wrongAnswers && wrongAnswers.length > 0) {
                wrongAnswers.forEach(answer => {
                    const errorItem = document.createElement('div');
                    errorItem.className = 'error-item'; // 使用同样的样式，但它不是链接
                    
                    const questionText = answer.questions.full_question.replace(/\[question\]\d+(\.\d+)*\s*/, '');
                    const userAnswer = answer.user_answer;
                    const correctAnswer = answer.questions.correct_answer;

                    errorItem.innerHTML = `
                        <p><strong>题目：</strong>${questionText}</p>
                        <p><strong>你的答案：</strong><span style="color: #e74c3c;">${userAnswer}</span></p>
                        <p><strong>正确答案：</strong><span style="color: #2ecc71;">${correctAnswer}</span></p>
                    `;
                    allErrorsList.appendChild(errorItem);
                });
            } else {
                allErrorsList.innerHTML = '<p>你还没有错过任何题目，继续保持！</p>';
            }
        } catch (error) {
            allErrorsList.innerHTML = '<p>加载所有错题记录失败，请稍后再试。</p>';
        }
    }

    // --- 4. 页面初始化 ---
    // 页面加载后，默认加载“需要巩固的错题”
    loadReviewQueue();
});