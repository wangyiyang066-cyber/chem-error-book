// js/quiz.js (V5.2版 - 适配新数据结构)

document.addEventListener('DOMContentLoaded', async function() {
    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0,
        answeredIds: [0]
    };

    const SUPABASE_URL = '你自己的 Supabase Project URL'; // <<< 再次填入你的信息
    const SUPABASE_ANON_KEY = '你自己的 Supabase anon public 密钥'; // <<< 再次填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user } } = await supabaseClient.auth.getUser();
    
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

    async function loadQuestion() {
        questionTextEl.innerHTML = '正在从云端图书馆获取新题目...';
        try {
            const response = await fetch('/.netlify/functions/get-question', {
                method: 'POST',
                body: JSON.stringify({ userLevel: calculateLevel(), answeredIds: userProfile.answeredIds }),
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
    
    function checkAnswer() {
        const userAnswer = userAnswerInputEl.value.trim();
        const correctAnswer = currentQuestion.correct_answer.trim();
        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';
        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        saveProgress(isCorrect);
        
        // --- ↓↓↓ 核心改动：用新的方式读取知识点名称 ↓↓↓ ---
        // 我们假设每道题至少关联一个知识点
        let kpName = "暂无关联知识点";
        if (currentQuestion.question_knowledge_point_link && currentQuestion.question_knowledge_point_link.length > 0) {
            // 将所有关联的知识点名称都显示出来
            kpName = currentQuestion.question_knowledge_point_link.map(link => link.knowledge_points.name).join('; ');
        }
        // --- ↑↑↑ 核心改动结束 ↑↑↑ ---

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            relatedKeypointEl.innerHTML = kpName; // 使用我们刚刚获取的知识点名称
            aiAnalysisContainer.style.display = 'none';
            getAIAnalysisBtn.disabled = false;
        }
    }
    
    async function getAIAnalysis() {
        aiAnalysisContainer.style.display = 'block';
        aiAnalysisTextEl.innerHTML = '正在连接AI大脑，请稍候... <i class="fas fa-spinner fa-spin"></i>';
        getAIAnalysisBtn.disabled = true;
        try {
            // 同样，我们也把这里发送的 keyPoint 改成新的格式
            let kpName = "暂无";
            if (currentQuestion.question_knowledge_point_link && currentQuestion.question_knowledge_point_link.length > 0) {
                 kpName = currentQuestion.question_knowledge_point_link.map(link => link.knowledge_points.name).join('; ');
            }
            const response = await fetch('/.netlify/functions/get-ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: currentQuestion.full_question,
                    correctAnswer: currentQuestion.correct_answer,
                    keyPoint: kpName, // 使用新的知识点名称
                }),
            });
            if (!response.ok) { throw new Error('AI 服务响应失败'); }
            const data = await response.json();
            const formattedAnalysis = data.analysis.replace(/\n/g, '<br>');
            aiAnalysisTextEl.innerHTML = formattedAnalysis;
        } catch (error) {
            aiAnalysisTextEl.textContent = '抱歉，AI解析服务暂时出现问题，请稍后再试。';
        } finally {
            getAIAnalysisBtn.disabled = false;
        }
    }

    // --- 省略其他未改动的函数 (saveProgress, calculateLevel) 和事件监听 ---
    function saveProgress(isCorrect) { /* ...内容不变... */ }
    function calculateLevel() { /* ...内容不变... */ return 'medium' }
    submitBtn.addEventListener('click', checkAnswer);
    nextQuestionBtn.addEventListener('click', loadQuestion);
    getAIAnalysisBtn.addEventListener('click', getAIAnalysis);

    loadQuestion();
});