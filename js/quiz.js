// js/quiz.js (V5.2版 - 统一用户身份验证逻辑)

// 我们将所有代码都包裹在这个事件监听器里
// 它会耐心等待 main.js 发出“用户已就绪”的信号后，再开始执行
document.addEventListener('userReady', async () => {
    // user 变量现在由 main.js 提供，我们直接使用即可
    if (!user) {
        // 如果出于某种原因没有用户信息，就停止执行
        console.error("Quiz page loaded without a user. This shouldn't happen.");
        return;
    }

    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0,
        answeredIds: [0]
    };
    
    // 获取所有页面元素
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const userAnswerInputEl = document.getElementById('user-answer-input');
    const submitBtn = document.getElementById('submit-answer-btn');
    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackWrongEl = document.getElementById('feedback-wrong');
    const feedbackCorrectEl = document.getElementById('feedback-correct');
    const correctAnswerTextEl = document.getElementById('correct-answer-text');
    const relatedKeypointEl = document.getElementById('related-keypoint');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const quizCompleteContainer = document.getElementById('quiz-complete-container');
    const getAIAnalysisBtn = document.getElementById('get-ai-analysis-btn');
    const aiAnalysisContainer = document.getElementById('ai-analysis-container');
    const aiAnalysisTextEl = document.getElementById('ai-analysis-text');
    let currentQuestion;

    async function saveAnswerRecord(questionId, isCorrect, userAnswer) {
        // 这里的 'user' 变量现在是 main.js 提供的，确保是最新状态
        try {
            await fetch('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({
                    questionId: questionId,
                    isCorrect: isCorrect,
                    userAnswer: userAnswer,
                    userId: user.id 
                }),
            });
            console.log(`记录已保存: 题目 ${questionId}, 是否正确: ${isCorrect}`);
        } catch (error) {
            console.error('保存答题记录失败:', error);
        }
    }

    function checkAnswer() {
        const userAnswer = userAnswerInputEl.value.trim();
        const correctAnswer = currentQuestion.correct_answer.trim();
        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';
        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        
        saveAnswerRecord(currentQuestion.id, isCorrect, userAnswer);
        saveProgress(isCorrect); 

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            
            let kpName = "暂无关联知识点";
            if (currentQuestion.question_knowledge_point_link && currentQuestion.question_knowledge_point_link.length > 0) {
                kpName = currentQuestion.question_knowledge_point_link.map(link => link.knowledge_points.name).join('; ');
            }
            relatedKeypointEl.innerHTML = kpName;
            aiAnalysisContainer.style.display = 'none';
            getAIAnalysisBtn.disabled = false;
        }
    }

    // --- 省略了其他未改动的函数，以保持简洁 ---
    // 你的文件中应该继续保留 loadQuestion, calculateLevel, saveProgress, getAIAnalysis 等函数
    async function loadQuestion() {
        questionTextEl.innerHTML = '正在从云端图书馆获取新题目...';
        try {
            const response = await fetch('/.netlify/functions/get-question', {
                method: 'POST', body: JSON.stringify({ userLevel: calculateLevel(), answeredIds: userProfile.answeredIds }),
            });
            if (!response.ok) throw new Error('获取题目失败');
            currentQuestion = await response.json();
            if (currentQuestion) {
                questionNumberEl.innerHTML = `<small>当前能力分: ${userProfile.abilityScore}</small>`;
                questionTextEl.innerHTML = currentQuestion.full_question;
                if (currentQuestion.image_url) {
                    const imageHTML = `<br><img src="${currentQuestion.image_url}" alt="题目图片" style="max-width: 100%; border-radius: 8px; margin-top: 15px;">`;
                    questionTextEl.innerHTML += imageHTML;
                }
                userAnswerInputEl.value = ''; userAnswerInputEl.disabled = false; submitBtn.style.display = 'block'; feedbackContainer.style.display = 'none';
            } else {
                document.getElementById('quiz-container').style.display = 'none';
                quizCompleteContainer.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            questionTextEl.textContent = '获取题目失败，请刷新页面重试。';
        }
    }
    function calculateLevel() {
        const score = userProfile.abilityScore;
        if (userProfile.answeredIds.length <= 5) return 'medium';
        if (score >= 10) return 'good';
        if (score <= -5) return 'poor';
        return 'medium';
    }
    function saveProgress(isCorrect) {
        const difficulty = currentQuestion.difficulty;
        let scoreChange = 0;
        if (isCorrect) {
            if (difficulty === 'easy') scoreChange = 1; else if (difficulty === 'medium') scoreChange = 2; else if (difficulty === 'hard') scoreChange = 3;
        } else {
            if (difficulty === 'easy') scoreChange = -3; else if (difficulty === 'medium') scoreChange = -2; else if (difficulty === 'hard') scoreChange = -1;
        }
        userProfile.abilityScore += scoreChange;
        userProfile.answeredIds.push(currentQuestion.id);
        localStorage.setItem('chemUserProfile', JSON.stringify(userProfile));
    }
    async function getAIAnalysis() { /* ...内容不变... */ }


    submitBtn.addEventListener('click', checkAnswer);
    nextQuestionBtn.addEventListener('click', loadQuestion);
    getAIAnalysisBtn.addEventListener('click', getAIAnalysis);

    // 初始加载题目
    loadQuestion();
});