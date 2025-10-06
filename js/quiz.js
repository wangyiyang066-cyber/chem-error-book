// 文件路径: js/quiz.js (最终版 - 集成所有功能)

document.addEventListener('userReady', () => {
    if (!user) return;

    let questionSet = [];
    let currentQuestionIndex = 0;

    // --- 1. 获取所有 DOM 元素，包括新增的推荐模块 ---
    const quizContainer = document.getElementById('quiz-container');
    const quizCompleteContainer = document.getElementById('quiz-complete-container');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const userAnswerInput = document.getElementById('user-answer-input');
    const submitBtn = document.getElementById('submit-answer-btn');
    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackWrongEl = document.getElementById('feedback-wrong');
    const feedbackCorrectEl = document.getElementById('feedback-correct');
    const correctAnswerTextEl = document.getElementById('correct-answer-text');
    const relatedKeypointEl = document.getElementById('related-keypoint');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');
    
    // 创建一个带认证的 fetch 辅助函数
    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { throw new Error('用户未认证'); }
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // --- 2. 核心启动函数 (和之前一样) ---
    async function startQuizSession() { /* ... 和之前一样，无需改动 ... */ }

    // --- 3. 题目显示与交互逻辑 ---
    function displayQuestion() {
        // ... (和之前一样) ...
        // 确保每次开始新题时，推荐模块是隐藏的
        recommendationContainer.style.display = 'none';
    }

    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        const question = questionSet[currentQuestionIndex];
        const userAnswer = userAnswerInput.value.trim();
        const isCorrect = userAnswer === question.correct_answer;

        // ... (保存答案、更新复习状态的逻辑和之前一样) ...

        feedbackContainer.style.display = 'block';
        userAnswerInput.disabled = true;
        submitBtn.style.display = 'none';

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
        } else {
            feedbackWrongEl.style.display = 'block';
            correctAnswerTextEl.textContent = question.correct_answer;
            const keypoints = question.question_knowledge_point_link?.map(link => link.knowledge_points.name) || [];
            relatedKeypointEl.textContent = keypoints.join(', ') || '暂无';

            // ▼▼▼ 核心改动：如果答错了，立即请求智能推荐 ▼▼▼
            recommendationContainer.style.display = 'block';
            recommendationText.textContent = '正在为你寻找巩固题...';
            
            try {
                const recommendedQuestion = await fetchWithAuth('/.netlify/functions/recommend-question', {
                    method: 'POST',
                    body: JSON.stringify({ wrongQuestionId: question.id })
                });

                if (recommendedQuestion) {
                    const recText = recommendedQuestion.full_question.replace(/\[question\]\d+(\.\d+)*\s*/, '');
                    recommendationText.innerHTML = `
                        <p><strong>推荐题目：</strong></p>
                        <p>${recText}</p>
                        <p><strong>答案：</strong>${recommendedQuestion.correct_answer}</p>
                    `;
                } else {
                    recommendationText.textContent = '暂时没有找到合适的推荐题目。';
                }
            } catch (error) {
                console.error('获取推荐题目失败:', error);
                recommendationText.textContent = '推荐服务暂时不可用。';
            }
            // ▲▲▲ 核心改动结束 ▲▲▲
        }
    });

    nextQuestionBtn.addEventListener('click', () => { /* ... 和之前一样 ... */ });
    
    // --- 4. 页面加载后立即启动答题会话 ---
    startQuizSession();

    // 为了方便您，这里是函数的完整代码
    function displayQuestion() {
        feedbackContainer.style.display = 'none';
        feedbackCorrectEl.style.display = 'none';
        feedbackWrongEl.style.display = 'none';
        recommendationContainer.style.display = 'none';
        userAnswerInput.value = '';
        userAnswerInput.disabled = false;
        submitBtn.style.display = 'block';
        submitBtn.disabled = false;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'review') {
            nextQuestionBtn.textContent = '返回错题列表';
        } else {
            nextQuestionBtn.textContent = '下一题';
        }
        const question = questionSet[currentQuestionIndex];
        questionNumberEl.textContent = `${currentQuestionIndex + 1} / ${questionSet.length}`;
        questionTextEl.textContent = question.full_question.replace(/\[question\]\d+(\.\d+)*\s*/, '');
    }
    
    nextQuestionBtn.addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'review') {
            window.location.href = 'my-errors.html';
            return;
        }
        currentQuestionIndex++;
        if (currentQuestionIndex < questionSet.length) {
            displayQuestion();
        } else {
            quizContainer.style.display = 'none';
            quizCompleteContainer.style.display = 'block';
        }
    });
});