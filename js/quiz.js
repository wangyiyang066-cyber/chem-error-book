// js/quiz.js (V5.0 数据库记录版)

document.addEventListener('DOMContentLoaded', function() {
    // ... (顶部的变量定义和元素获取部分保持不变) ...
    let allQuestions = errorData;
    let userProfile = JSON.parse(localStorage.getItem('chemUserProfile')) || {
        abilityScore: 0,
        answeredIds: []
    };
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

    // --- 新增函数：呼叫“数据记录员” ---
    async function saveAnswerRecord(questionId, isCorrect) {
        try {
            await fetch('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({
                    questionId: questionId,
                    isCorrect: isCorrect,
                }),
            });
            console.log(`记录已保存: 题目 ${questionId}, 是否正确: ${isCorrect}`);
        } catch (error) {
            console.error('保存答题记录失败:', error);
        }
    }

    // --- 修改 checkAnswer 函数，让它在判断后调用保存函数 ---
    function checkAnswer() {
        const userAnswer = userAnswerInputEl.value.trim();
        const correctAnswer = currentQuestion.correctAnswer.trim();

        userAnswerInputEl.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';

        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        
        // **核心改动**：无论对错，都调用保存记录的函数
        saveAnswerRecord(currentQuestion.id, isCorrect);
        // (IRT相关的本地计分逻辑我们暂时保留)
        saveProgress(isCorrect); 

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
    
    // ... (其他所有函数: loadQuestion, calculateLevel, saveProgress, pickNextQuestion, getAIAnalysis 都不变) ...
    // ... (为了代码简洁，这里省略，请使用你已有的版本)

    // ... (事件监听部分不变)
});

// 注意：为简洁起见，我只展示了有改动的函数和新增的函数。
// 请在你现有的 quiz.js 文件中，新增 saveAnswerRecord 函数，并修改 checkAnswer 函数。
// 或者，如果你不确定，我可以提供一份完整的 quiz.js 新代码。