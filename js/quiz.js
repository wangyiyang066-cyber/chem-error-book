// 文件路径: js/quiz.js (最终版 - 集成所有功能和修复)

document.addEventListener('userReady', () => {
    if (!user) {
        // 如果没有用户信息，提前退出，防止后续代码出错
        console.error("用户未登录，quiz.js 无法执行。");
        return;
    }

    // --- 1. 初始化所有变量和 DOM 元素 ---
    let questionSet = [];
    let currentQuestionIndex = 0;

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
    
    const getAiAnalysisBtn = document.getElementById('get-ai-analysis-btn');
    const aiAnalysisContainer = document.getElementById('ai-analysis-container');
    const aiAnalysisText = document.getElementById('ai-analysis-text');

    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');

    // --- 2. 核心功能函数 ---

    // 带用户认证的 fetch 辅助函数
    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert('用户会话已过期，请重新登录。');
            window.location.href = 'index.html';
            throw new Error('用户未认证');
        }
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // 根据 URL 参数启动不同模式的答题会话
    async function startQuizSession() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        try {
            questionTextEl.textContent = '正在为您准备题目，请稍候...';

            if (mode === 'chapter') {
                const chapterName = urlParams.get('name');
                const chapterId = urlParams.get('id');
                const response = await fetch(`/.netlify/functions/get-questions-by-chapter?id=${chapterId}`);
                if (!response.ok) throw new Error('获取章节题目失败');
                questionSet = await response.json();
                document.querySelector('h1').textContent = `在线答题 - ${decodeURIComponent(chapterName)}`;
            } else if (mode === 'comprehensive') {
                document.querySelector('h1').textContent = '在线答题 - 综合模拟';
                const response = await fetch(`/.netlify/functions/get-comprehensive-exam`);
                if (!response.ok) throw new Error('获取综合题目失败');
                questionSet = await response.json();
            } else if (mode === 'review') {
                const questionId = urlParams.get('questionId');
                document.querySelector('h1').textContent = '错题巩固';
                const response = await fetch(`/.netlify/functions/get-question-by-id?id=${questionId}`);
                if (!response.ok) throw new Error('获取复习题目失败');
                const singleQuestion = await response.json();
                questionSet = singleQuestion ? [singleQuestion] : [];
            } else {
                questionTextEl.textContent = '未知的答题模式。';
                return;
            }

            if (!questionSet || questionSet.length === 0) {
                questionTextEl.textContent = '抱歉，暂时没有找到合适的题目。';
                submitBtn.style.display = 'none';
                return;
            }

            // 打乱题目顺序 (如果是复习模式，只有一道题，打乱无影响)
            questionSet.sort(() => Math.random() - 0.5);
            currentQuestionIndex = 0;
            displayQuestion();

        } catch (error) {
            questionTextEl.textContent = `加载题目失败: ${error.message}`;
        }
    }

    // 将一道题的数据渲染到页面上
    function displayQuestion() {
        // 重置所有反馈区的显示状态
        feedbackContainer.style.display = 'none';
        feedbackCorrectEl.style.display = 'none';
        feedbackWrongEl.style.display = 'none';
        if (aiAnalysisContainer) aiAnalysisContainer.style.display = 'none';
        if (recommendationContainer) recommendationContainer.style.display = 'none';

        // 恢复答题区
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

    // --- 3. 核心事件监听器 ---

    // 点击“提交答案”按钮
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        const question = questionSet[currentQuestionIndex];
        const userAnswer = userAnswerInput.value.trim();
        const isCorrect = (userAnswer === question.correct_answer);

        // 保存答题记录
        try {
            await fetchWithAuth('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({ questionId: question.id, isCorrect, userAnswer, userId: user.id })
            });
        } catch (error) { console.error("保存答题记录失败:", error); }

        // 如果是复习模式，更新复习状态
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'review') {
            const reviewId = urlParams.get('reviewId');
            try {
                await fetchWithAuth('/.netlify/functions/update-review-status', {
                    method: 'POST',
                    body: JSON.stringify({ reviewId: reviewId, isCorrect: isCorrect })
                });
            } catch (err) { console.error('更新复习状态失败:', err); }
        }

        // 显示反馈
        feedbackContainer.style.display = 'block';
        userAnswerInput.disabled = true;
        submitBtn.style.display = 'none';

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            
            correctAnswerTextEl.textContent = question.correct_answer;
            const keypoints = question.question_knowledge_point_link?.map(link => link.knowledge_points.name) || [];
            relatedKeypointEl.textContent = keypoints.join(', ') || '暂无';

            // 请求智能推荐
            if (recommendationContainer) {
                recommendationContainer.style.display = 'block';
                recommendationText.textContent = '正在为你寻找巩固题...';
                try {
                    const recommendedQuestion = await fetchWithAuth('/.netlify/functions/recommend-question', {
                        method: 'POST',
                        body: JSON.stringify({ wrongQuestionId: question.id })
                    });
                    if (recommendedQuestion) {
                        const recText = recommendedQuestion.full_question.replace(/\[question\]\d+(\.\d+)*\s*/, '');
                        recommendationText.innerHTML = `<p><strong>推荐题目：</strong></p><p>${recText}</p><p><strong>答案：</strong>${recommendedQuestion.correct_answer}</p>`;
                    } else {
                        recommendationText.textContent = '暂时没有找到合适的推荐题目。';
                    }
                } catch (error) {
                    console.error('获取推荐题目失败:', error);
                    recommendationText.textContent = '推荐服务暂时不可用。';
                }
            }
        }
    });

    // 点击“下一题”或“返回列表”按钮
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
    
    // 点击“请求 AI 解析”按钮
    if (getAiAnalysisBtn) {
        getAiAnalysisBtn.addEventListener('click', async () => {
            aiAnalysisContainer.style.display = 'block';
            aiAnalysisText.textContent = 'AI 老师正在思考中，请稍候...';
            const question = questionSet[currentQuestionIndex];
            const keypoints = question.question_knowledge_point_link?.map(link => link.knowledge_points.name) || [];
            
            try {
                const response = await fetch('/.netlify/functions/get-ai-analysis', {
                    method: 'POST',
                    body: JSON.stringify({
                        question: question.full_question,
                        correctAnswer: question.correct_answer,
                        keyPoint: keypoints.join(', ')
                    })
                });
                const data = await response.json();
                if(data.error) throw new Error(data.error);
                aiAnalysisText.textContent = data.analysis;
            } catch (error) {
                aiAnalysisText.textContent = `AI 解析失败: ${error.message}`;
            }
        });
    }

    // --- 4. 页面加载后立即启动答题会话 ---
    startQuizSession();
});