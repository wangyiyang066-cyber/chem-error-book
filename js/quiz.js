// js/quiz.js (最终修正版 - 修复拼写错误)

document.addEventListener('userReady', () => {
    if (!user) {
        console.error("用户未登录，quiz.js 无法执行。");
        return;
    }

    // --- 1. 初始化所有变量和 DOM 元素 ---
    let questionSet = [];
    let currentQuestionIndex = 0;
    let conversationHistory = [];

    const quizContainer = document.getElementById('quiz-container');
    const quizCompleteContainer = document.getElementById('quiz-complete-container');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const userAnswerInput = document.getElementById('user-answer-input');
    
    // ▼▼▼ 核心修正：修复了这里的 ID 拼写错误 ▼▼▼
    const submitBtn = document.getElementById('submit-answer-btn');
    // ▲▲▲ 核心修正结束 ▲▲▲
    
    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackWrongEl = document.getElementById('feedback-wrong');
    const feedbackCorrectEl = document.getElementById('feedback-correct');
    const correctAnswerTextEl = document.getElementById('correct-answer-text');
    const relatedKeypointEl = document.getElementById('related-keypoint');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const getAiAnalysisBtn = document.getElementById('get-ai-analysis-btn');
    const aiChatContainer = document.getElementById('ai-chat-container');
    const aiChatLog = document.getElementById('ai-chat-log');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiChatSendBtn = document.getElementById('ai-chat-send-btn');
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');

    // 安全检查，如果关键按钮不存在，则提前报错并退出
    if (!submitBtn) {
        console.error("关键元素 'submit-answer-btn' 未在 HTML 中找到！");
        return;
    }

    // ... 后续所有代码和之前一样 ...
    async function fetchWithAuth(url, options = {}) { /* ... */ }
    async function startQuizSession() { /* ... */ }
    function displayQuestion() { /* ... */ }
    function addMessageToLog(role, content) { /* ... */ }
    async function streamAIResponse() { /* ... */ }
    submitBtn.addEventListener('click', async () => { /* ... */ });
    nextQuestionBtn.addEventListener('click', () => { /* ... */ });
    getAiAnalysisBtn.addEventListener('click', () => { /* ... */ });
    aiChatSendBtn.addEventListener('click', () => { /* ... */ });
    startQuizSession();

    // 为了方便，这里还是提供完整的代码
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
                if(submitBtn) submitBtn.style.display = 'none';
                return;
            }
            questionSet.sort(() => Math.random() - 0.5);
            currentQuestionIndex = 0;
            displayQuestion();
        } catch (error) {
            questionTextEl.textContent = `加载题目失败: ${error.message}`;
        }
    }
    function displayQuestion() {
        feedbackContainer.style.display = 'none';
        feedbackCorrectEl.style.display = 'none';
        feedbackWrongEl.style.display = 'none';
        if (aiChatContainer) aiChatContainer.style.display = 'none';
        if(getAiAnalysisBtn) getAiAnalysisBtn.style.display = 'inline-block';
        if (recommendationContainer) recommendationContainer.style.display = 'none';
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
    function addMessageToLog(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', `${role}-message`);
        const avatar = role === 'user' ? '🧑' : '🤖';
        messageDiv.innerHTML = `<div class="avatar">${avatar}</div><div class="message-content"></div>`;
        const contentEl = messageDiv.querySelector('.message-content');
        contentEl.textContent = content;
        aiChatLog.appendChild(messageDiv);
        aiChatLog.scrollTop = aiChatLog.scrollHeight;
        return contentEl;
    }
    async function streamAIResponse() {
        try {
            const response = await fetch('/.netlify/functions/get-ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: conversationHistory })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseContent = '';
            const aiMessageElement = addMessageToLog('assistant', '...');
            aiMessageElement.textContent = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonData = line.substring(6);
                        if (jsonData.trim() === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(jsonData);
                            if (parsed.choices && parsed.choices[0].delta.content) {
                                aiResponseContent += parsed.choices[0].delta.content;
                                aiMessageElement.textContent = aiResponseContent;
                                aiChatLog.scrollTop = aiChatLog.scrollHeight;
                            }
                        } catch (e) { }
                    }
                }
            }
            conversationHistory.push({ role: 'assistant', content: aiResponseContent });
        } catch (error) {
            addMessageToLog('assistant', `抱歉，出现错误: ${error.message}`);
        } finally {
            aiChatSendBtn.disabled = false;
            aiChatInput.disabled = false;
            aiChatInput.focus();
        }
    }
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        const question = questionSet[currentQuestionIndex];
        const userAnswer = userAnswerInput.value.trim();
        const isCorrect = (userAnswer === question.correct_answer);
        try {
            await fetchWithAuth('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({ questionId: question.id, isCorrect, userAnswer, userId: user.id })
            });
        } catch (error) { console.error("保存答题记录失败:", error); }
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
    getAiAnalysisBtn.addEventListener('click', () => {
        aiChatContainer.style.display = 'block';
        getAiAnalysisBtn.style.display = 'none';
        aiChatLog.innerHTML = '';
        const question = questionSet[currentQuestionIndex];
        const keypoints = question.question_knowledge_point_link?.map(link => link.knowledge_points.name) || [];
        conversationHistory = [
            { "role": "system", "content": "你是一名资深的初三化学老师..." },
            { "role": "user", "content": `请根据以下信息，为我生成一段题目解析...\n---\n题目信息：\n- 核心知识点: ${keypoints.join(', ')}\n- 题目内容: ${question.full_question}\n- 正确答案: ${question.correct_answer}\n---\n请开始你的解析：` }
        ];
        streamAIResponse();
    });
    aiChatSendBtn.addEventListener('click', () => {
        const userQuery = aiChatInput.value.trim();
        if (!userQuery) return;
        addMessageToLog('user', userQuery);
        conversationHistory.push({ role: 'user', content: userQuery });
        aiChatInput.value = '';
        aiChatInput.disabled = true;
        aiChatSendBtn.disabled = true;
        streamAIResponse();
    });

    startQuizSession();
});
quiz.js