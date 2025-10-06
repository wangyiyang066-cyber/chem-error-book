// 文件路径: js/quiz.js (最终版 - 集成 AI 对话流)

document.addEventListener('userReady', () => {
    if (!user) { return; }

    let questionSet = [];
    let currentQuestionIndex = 0;
    let conversationHistory = [];

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
    const aiChatContainer = document.getElementById('ai-chat-container');
    const aiChatLog = document.getElementById('ai-chat-log');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiChatSendBtn = document.getElementById('ai-chat-send-btn');
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');

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
    
    async function startQuizSession() { /* ... 和之前一样 ... */ }
    function displayQuestion() { /* ... 和之前一样，但要重置聊天状态 ... */ }

    function addMessageToLog(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', `${role}-message`);
        const avatar = role === 'user' ? '🧑' : '🤖';
        messageDiv.innerHTML = `<div class="avatar">${avatar}</div><div class="message-content"></div>`;
        const contentEl = messageDiv.querySelector('.message-content');
        contentEl.textContent = content; // 先用 textContent 避免 XSS
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

    getAiAnalysisBtn.addEventListener('click', () => {
        aiChatContainer.style.display = 'block';
        getAiAnalysisBtn.style.display = 'none';
        
        aiChatLog.innerHTML = ''; // 清空旧的聊天记录
        const question = questionSet[currentQuestionIndex];
        const keypoints = question.question_knowledge_point_link?.map(link => link.knowledge_points.name) || [];

        conversationHistory = [
            { "role": "system", "content": "你是一名资深的初三化学老师，擅长用清晰、易懂的方式解释复杂的化学问题。你的任务是为学生答错的题目生成一段高质量的解析。" },
            { "role": "user", "content": `请根据以下信息，为我生成一段题目解析。解析需要包含：知识点回顾、解题思路、易错点分析，请你注意，关注学生的错误选项，思考为什么学生会在这里出错，并据此给出完整解析。\n---\n题目信息：\n- 核心知识点: ${keypoints.join(', ')}\n- 题目内容: ${question.full_question}\n- 正确答案: ${question.correct_answer}\n---\n请开始你的解析：` }
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
    
    // 补全其他函数
    startQuizSession();
    function displayQuestion(){ /* ... */ }
    submitBtn.addEventListener('click', async () => { /* ... */ });
    nextQuestionBtn.addEventListener('click', () => { /* ... */ });
});