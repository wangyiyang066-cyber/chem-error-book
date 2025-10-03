// js/quiz.js (V5.0 最终云端动态版)

document.addEventListener('DOMContentLoaded', function() {
    // 用户档案现在只在本地记录，用来发送给后端
    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0,
        answeredIds: [0] // 初始化一个虚拟ID，防止SQL查询 in () 语法错误
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
    
    async function loadQuestion() {
        // 显示正在加载
        questionTextEl.innerHTML = '正在从云端图书馆获取新题目...';
        
        try {
            // 呼叫我们的“图书管理员”
            const response = await fetch('/.netlify/functions/get-question', {
                method: 'POST',
                body: JSON.stringify({
                    userLevel: calculateLevel(),
                    answeredIds: userProfile.answeredIds,
                }),
            });
            if (!response.ok) throw new Error('获取题目失败');

            currentQuestion = await response.json();

            if (currentQuestion) {
                // 更新页面显示
                questionNumberEl.innerHTML = `<small>当前能力分: ${userProfile.abilityScore}</small>`;
                questionTextEl.innerHTML = currentQuestion.full_question;
                
                userAnswerInputEl.value = '';
                userAnswerInputEl.disabled = false;
                submitBtn.style.display = 'block';
                feedbackContainer.style.display = 'none';
            } else {
                document.getElementById('quiz-container').style.display = 'none';
                quizCompleteContainer.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            questionTextEl.textContent = '获取题目失败，请刷新页面重试。';
        }
    }
    
    function checkAnswer() {
        const userAnswer = userAnswerInputEl.value.trim();
        const correctAnswer = currentQuestion.correct_answer.trim();
        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';

        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        saveProgress(isCorrect);

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            // 注意：因为我们关联查询了知识点，所以这里的结构变了
            relatedKeypointEl.innerHTML = currentQuestion.knowledge_points.name; 
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