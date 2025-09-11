// js/quiz.js (V4.0 IRT启发式智能版)

document.addEventListener('DOMContentLoaded', function() {
    // 确保题目数据已加载
    if (typeof errorData === 'undefined' || errorData.length === 0) {
        console.error("错误：题目数据 (errorData) 未加载或为空。");
        document.getElementById('question-text').textContent = '错误：无法加载题目数据，请检查 data.js 文件。';
        return;
    }
    const allQuestions = errorData;
    
    // 从浏览器的“小本子”(localStorage)中读取或初始化用户档案
    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0, // 初始能力分为 0
        answeredIds: []  // 记录答过的题目ID
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

    // 1. 根据“能力分”判断用户水平
    function calculateLevel() {
        const score = userProfile.abilityScore;
        if (userProfile.answeredIds.length < 5) return 'medium'; // 答题少于5道，先给中等题
        if (score >= 10) return 'good'; // 能力分达到10为优秀
        if (score <= -5) return 'poor'; // 能力分低于-5为较差
        return 'medium';
    }

    // 2. 更新能力分并保存进度
    function saveProgress(isCorrect) {
        const difficulty = currentQuestion.difficulty;
        let scoreChange = 0;

        if (isCorrect) {
            if (difficulty === 'easy') scoreChange = 1;
            else if (difficulty === 'medium') scoreChange = 2;
            else if (difficulty === 'hard') scoreChange = 3;
        } else {
            if (difficulty === 'easy') scoreChange = -3;
            else if (difficulty === 'medium') scoreChange = -2;
            else if (difficulty === 'hard') scoreChange = -1;
        }
        
        userProfile.abilityScore += scoreChange;
        userProfile.answeredIds.push(currentQuestion.id);
        localStorage.setItem('chemUserProfile', JSON.stringify(userProfile));
    }
    
    // 3. 智能挑选下一道题
    function pickNextQuestion() {
        const userLevel = calculateLevel();
        let difficultyToPick;

        if (userLevel === 'good') {
            difficultyToPick = 'hard';
        } else if (userLevel === 'poor') {
            difficultyToPick = 'easy';
        } else {
            difficultyToPick = 'medium';
        }

        // 筛选出符合难度且用户没答过的题
        let availableQuestions = allQuestions.filter(q => 
            q.difficulty === difficultyToPick && !userProfile.answeredIds.includes(q.id)
        );

        // 如果该难度的题都答完了，尝试去找别的难度的题
        if (availableQuestions.length === 0) {
            availableQuestions = allQuestions.filter(q => !userProfile.answeredIds.includes(q.id));
        }

        if (availableQuestions.length === 0) return null;

        // 从可选题目中随机抽一道
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        return availableQuestions[randomIndex];
    }
    
    function loadQuestion() {
        currentQuestion = pickNextQuestion();
        if (currentQuestion) {
            const totalQuestions = allQuestions.length;
            const answeredCount = userProfile.answeredIds.length + 1;
            // 在界面上显示当前能力分，方便我们测试
            questionNumberEl.innerHTML = `( ${answeredCount} / ${totalQuestions} ) <br> <small>当前能力分: ${userProfile.abilityScore}</small>`;
            questionTextEl.innerHTML = currentQuestion.fullQuestion;
            userAnswerInputEl.value = '';
            userAnswerInputEl.disabled = false;
            submitBtn.style.display = 'block';
            feedbackContainer.style.display = 'none';
        } else {
            document.getElementById('quiz-container').style.display = 'none';
            quizCompleteContainer.style.display = 'block';
        }
    }
    
    function checkAnswer() {
        const userAnswer = userAnswerInputEl.value.trim();
        const correctAnswer = currentQuestion.correctAnswer.trim();
        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';

        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        saveProgress(isCorrect); // 保存答题记录和分数

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            relatedKeypointEl.innerHTML = currentQuestion.detailedKeyPoint;
            aiAnalysisContainer.style.display = 'none';
            getAIAnalysisBtn.disabled = false;
        }
    }
    
    async function getAIAnalysis() {
        // ... (此函数保持不变)
    }

    submitBtn.addEventListener('click', checkAnswer);
    nextQuestionBtn.addEventListener('click', loadQuestion);
    getAIAnalysisBtn.addEventListener('click', getAIAnalysis);

    loadQuestion();
});