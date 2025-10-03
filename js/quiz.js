// js/quiz.js (V5.1版 - 增加发送用户答案和ID)

document.addEventListener('DOMContentLoaded', async function() {
    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0,
        answeredIds: [0]
    };

    // --- 核心改动：在页面加载时，就初始化 Supabase 客户端并获取当前用户 ---
    const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // <<< 再次填入你的信息
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go'; // <<< 再次填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user } } = await supabaseClient.auth.getUser();
    // --- 核心改动结束 ---
    
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
        if (!user) {
            console.log("用户未登录，不保存答题记录。");
            return;
        }
        try {
            await fetch('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({
                    questionId: questionId,
                    isCorrect: isCorrect,
                    userAnswer: userAnswer, // <<< 核心改动：把用户答案发给后端
                    userId: user.id          // <<< 核心改动：把真实用户ID发给后端
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
        
        // 调用保存记录的函数，并传入用户答案
        saveAnswerRecord(currentQuestion.id, isCorrect, userAnswer);
        
        // (本地计分逻辑保持不变)
        saveProgress(isCorrect); 

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            relatedKeypointEl.innerHTML = currentQuestion.knowledge_points.name;
            aiAnalysisContainer.style.display = 'none';
            getAIAnalysisBtn.disabled = false;
        }
    }

    // --- 为了简洁，下面省略了其他未改动的函数 ---
    // --- 请确保你的文件中保留了 loadQuestion, calculateLevel, saveProgress, getAIAnalysis 等函数 ---
    async function loadQuestion() {
        questionTextEl.innerHTML = '正在从云端图书馆获取新题目...';
        try {
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
                questionNumberEl.innerHTML = `<small>当前能力分: ${userProfile.abilityScore}</small>`;
                questionTextEl.innerHTML = currentQuestion.full_question;
                if (currentQuestion.image_url) {
                    const imageHTML = `<br><img src="${currentQuestion.image_url}" alt="题目图片" style="max-width: 100%; border-radius: 8px; margin-top: 15px;">`;
                    questionTextEl.innerHTML += imageHTML;
                }
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
    
    function calculateLevel() { /* ...内容不变... */ return 'medium' }
    function saveProgress(isCorrect) { /* ...内容不变... */ }
    async function getAIAnalysis() { /* ...内容不变... */ }

    submitBtn.addEventListener('click', checkAnswer);
    nextQuestionBtn.addEventListener('click', loadQuestion);
    getAIAnalysisBtn.addEventListener('click', getAIAnalysis);

    loadQuestion();
});