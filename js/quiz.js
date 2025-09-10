// js/quiz.js (最终正确版)

document.addEventListener('DOMContentLoaded', function() {
    if (typeof errorData === 'undefined' || errorData.length === 0) {
        console.error("错误：题目数据 (errorData) 未加载或为空。");
        document.getElementById('question-text').textContent = '错误：无法加载题目数据，请检查 data.js 文件。';
        return;
    }
    const questions = errorData;
    let currentQuestionIndex = 0;

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

    function loadQuestion() {
        if (currentQuestionIndex < questions.length) {
            const currentQuestion = questions[currentQuestionIndex];
            questionNumberEl.textContent = `( ${currentQuestionIndex + 1} / ${questions.length} )`;
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
        const correctAnswer = questions[currentQuestionIndex].correctAnswer.trim();
        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';

        if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
            feedbackCorrectEl.style.display = 'block';
            feedbackWrongEl.style.display = 'none';
        } else {
            feedbackWrongEl.style.display = 'block';
            feedbackCorrectEl.style.display = 'none';
            correctAnswerTextEl.innerHTML = correctAnswer;
            relatedKeypointEl.innerHTML = questions[currentQuestionIndex].detailedKeyPoint;
            aiAnalysisContainer.style.display = 'none';
            getAIAnalysisBtn.disabled = false;
        }
    }
    
    async function getAIAnalysis() {
        aiAnalysisContainer.style.display = 'block';
        aiAnalysisTextEl.innerHTML = '正在连接AI大脑，请稍候... <i class="fas fa-spinner fa-spin"></i>';
        getAIAnalysisBtn.disabled = true;

        const currentQuestion = questions[currentQuestionIndex];

        try {
            const response = await fetch('/.netlify/functions/get-ai-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: currentQuestion.fullQuestion,
                    correctAnswer: currentQuestion.correctAnswer,
                    keyPoint: currentQuestion.detailedKeyPoint,
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

    submitBtn.addEventListener('click', checkAnswer);
    nextQuestionBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        loadQuestion();
    });
    getAIAnalysisBtn.addEventListener('click', getAIAnalysis);

    loadQuestion();
});