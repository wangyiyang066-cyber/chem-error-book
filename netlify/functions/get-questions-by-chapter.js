// js/quiz.js (最终融合版：全功能 + 新特性)

document.addEventListener('userReady', () => {
    if (!user) {
        console.error("用户未登录，无法加载题目。");
        alert("请先登录！");
        window.location.href = 'index.html';
        return;
    }

    // --- 变量初始化 ---
    let questionSet = [];
    let currentQuestionIndex = 0;
    
    // --- DOM 元素获取 ---
    const quizContainer = document.getElementById('quiz-container');
    const quizCompleteContainer = document.getElementById('quiz-complete-container');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const difficultyStarsEl = document.getElementById('difficulty-stars'); // 新增
    const questionImagesContainer = document.getElementById('question-images-container'); // 新增
    const userAnswerInput = document.getElementById('user-answer-input');
    const submitBtn = document.getElementById('submit-answer-btn');
    
    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackWrongEl = document.getElementById('feedback-wrong');
    const feedbackCorrectEl = document.getElementById('feedback-correct');
    const correctAnswerTextEl = document.getElementById('correct-answer-text');
    const relatedKeypointEl = document.getElementById('related-keypoint');
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');
    
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const getAiAnalysisBtn = document.getElementById('get-ai-analysis-btn');
    const aiChatContainer = document.getElementById('ai-chat-container');
    const aiChatLog = document.getElementById('ai-chat-log');

    // --- 1. 启动答题会话 (处理多种模式) ---
    async function startQuizSession() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode'); // 'chapter', 'comprehensive', 'review' or null (default chapter by id)
        const chapterId = urlParams.get('id');

        try {
            questionTextEl.textContent = '正在从云端拉取题目...';
            
            let apiUrl = '';
            
            // 模式判断逻辑
            if (mode === 'review') {
                document.querySelector('h1').textContent = '错题巩固模式';
                const qId = urlParams.get('questionId'); // 复习单题
                if(qId) apiUrl = `/.netlify/functions/get-question-by-id?id=${qId}`;
                // 如果是复习所有错题，你需要另一个API，这里暂略
            } else if (mode === 'comprehensive') {
                document.querySelector('h1').textContent = '综合模拟考试';
                apiUrl = `/.netlify/functions/get-comprehensive-exam`;
            } else {
                // 默认：章节练习
                if (!chapterId) {
                    alert("未指定章节ID"); return;
                }
                apiUrl = `/.netlify/functions/get-questions-by-chapter?id=${chapterId}`;
            }

            const questions = await fetchWithAuth(apiUrl);
            
            if (!questions || (Array.isArray(questions) && questions.length === 0)) {
                questionTextEl.textContent = '本单元暂无题目，请联系管理员录入。';
                submitBtn.style.display = 'none';
                return;
            }

            // 如果返回的是单题对象（复习模式），转为数组
            questionSet = Array.isArray(questions) ? questions : [questions];
            
            // 随机打乱顺序 (可选)
            // questionSet.sort(() => Math.random() - 0.5);

            currentQuestionIndex = 0;
            displayQuestion();

        } catch (error) {
            console.error(error);
            questionTextEl.textContent = `加载失败: ${error.message}`;
        }
    }

    // --- 2. 渲染题目 (含新功能：图片 & 星星) ---
    function displayQuestion() {
        const q = questionSet[currentQuestionIndex];

        // 重置 UI
        feedbackContainer.style.display = 'none';
        feedbackWrongEl.style.display = 'none';
        feedbackCorrectEl.style.display = 'none';
        aiChatContainer.style.display = 'none';
        aiChatLog.innerHTML = '';
        getAiAnalysisBtn.style.display = 'inline-block'; // 重置AI按钮
        
        userAnswerInput.value = '';
        userAnswerInput.disabled = false;
        submitBtn.style.display = 'block';
        submitBtn.disabled = false;

        // 设置文本
        questionNumberEl.textContent = `${currentQuestionIndex + 1} / ${questionSet.length}`;
        // 清理一下题目文本可能带有的前缀
        questionTextEl.textContent = q.full_question.replace(/^\[question\]\d+(\.\d+)*\s*/, '');

        // 🔥 新增：难度星星渲染
        const diffVal = parseFloat(q.difficulty || 0.5);
        let starCount = 3;
        if (diffVal <= 0.2) starCount = 1;
        else if (diffVal <= 0.4) starCount = 2;
        else if (diffVal <= 0.6) starCount = 3;
        else if (diffVal <= 0.8) starCount = 4;
        else starCount = 5;
        difficultyStarsEl.innerHTML = `难度: ${'<i class="fas fa-star"></i>'.repeat(starCount)}${'<i class="far fa-star"></i>'.repeat(5-starCount)}`;

        // 🔥 新增：图片渲染
        questionImagesContainer.innerHTML = '';
        if (q.image_urls && q.image_urls.length > 0) {
            q.image_urls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.style.maxHeight = '150px';
                img.style.border = '1px solid #ddd';
                img.style.borderRadius = '8px';
                img.style.cursor = 'zoom-in';
                img.onclick = () => window.open(url, '_blank');
                questionImagesContainer.appendChild(img);
            });
        }
    }

    // --- 3. 提交答案 (含数据库保存) ---
    submitBtn.addEventListener('click', async () => {
        const userAnswer = userAnswerInput.value.trim();
        if (!userAnswer) {
            alert("请填写答案！");
            return;
        }

        submitBtn.disabled = true;
        const q = questionSet[currentQuestionIndex];
        const isCorrect = (userAnswer === q.correct_answer.trim()); // 严格匹配，后续可改为AI判分

        // 🔥 保存做题记录到数据库
        try {
            await fetchWithAuth('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({ 
                    questionId: q.id, 
                    isCorrect: isCorrect, 
                    userAnswer: userAnswer,
                    userId: user.id 
                })
            });
        } catch (error) {
            console.error("保存记录失败:", error); // 不阻断流程
        }

        // UI 反馈
        userAnswerInput.disabled = true;
        submitBtn.style.display = 'none';
        feedbackContainer.style.display = 'block';

        if (isCorrect) {
            feedbackCorrectEl.style.display = 'block';
        } else {
            feedbackWrongEl.style.display = 'block';
            correctAnswerTextEl.textContent = q.correct_answer;
            
            // 显示知识点
            let kpText = "综合";
            if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
                kpText = q.question_knowledge_point_link.map(k => k.knowledge_nodes.title).join(", ");
            }
            relatedKeypointEl.textContent = kpText;

            // 显示易错提示
            if (q.error_analysis) {
                recommendationContainer.style.display = 'block';
                recommendationText.textContent = q.error_analysis;
            } else {
                recommendationContainer.style.display = 'none';
            }
        }
    });

    // --- 4. 切换下一题 ---
    nextQuestionBtn.addEventListener('click', () => {
        // 如果是复习模式，可能只有一个题，做完就返回
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'review') {
            window.location.href = 'my-errors.html'; // 返回错题本
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

    // --- 5. AI 老师 (适配 DeepSeek 新逻辑) ---
    getAiAnalysisBtn.addEventListener('click', async () => {
        getAiAnalysisBtn.style.display = 'none';
        aiChatContainer.style.display = 'block';
        
        const loadingId = 'loading-' + Date.now();
        addMessageToLog('ai', '正在分析你的思路...', loadingId);

        const q = questionSet[currentQuestionIndex];
        const userAnswer = userAnswerInput.value;

        try {
            // 构建 Prompt
            const prompt = `
你是一位初中化学老师。学生做错了这道题。
【题目】${q.full_question}
【标准答案】${q.correct_answer}
【解析】${q.analysis}
【学生回答】${userAnswer}

请用苏格拉底教学法引导学生发现错误，不要直接给答案。语气要鼓励。
            `;

            const res = await fetch('/.netlify/functions/get-ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!res.ok) throw new Error("AI Error");

            // 🔥 解析后端返回的特殊拼接字符串
            const rawText = await res.text();
            let content = "";
            const regex = /"content":"(.*?)"/g;
            let match;
            while ((match = regex.exec(rawText)) !== null) {
                content += match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
            if (!content) {
                // 备用解析
                try { content = JSON.parse(rawText).choices[0].message.content; } catch(e){}
            }

            // 移除 Loading
            const loadingDiv = document.getElementById(loadingId);
            if(loadingDiv) aiChatLog.removeChild(loadingDiv);

            // 打字机显示
            typeWriterEffect(content || "解析生成完毕，请参考标准答案。");

        } catch (err) {
            console.error(err);
            const loadingDiv = document.getElementById(loadingId);
            if(loadingDiv) aiChatLog.removeChild(loadingDiv);
            addMessageToLog('ai', 'AI 老师暂时离线，请稍后再试。');
        }
    });

    // --- 辅助工具 ---
    
    // 带 Auth 的 Fetch
    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error("未登录");
        
        const headers = { 
            ...options.headers, 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${session.access_token}` 
        };
        const res = await fetch(url, { ...options, headers });
        if (!res.ok) throw new Error(`请求失败: ${res.statusText}`);
        return await res.json();
    }

    function addMessageToLog(role, text, id) {
        const div = document.createElement('div');
        div.className = `chat-message ${role === 'user' ? 'user-message' : 'ai-message'}`;
        if(id) div.id = id;
        div.innerHTML = `<div class="avatar">${role==='user'?'🧑':'🤖'}</div><div class="message-content">${text}</div>`;
        aiChatLog.appendChild(div);
        aiChatLog.scrollTop = aiChatLog.scrollHeight;
    }

    function typeWriterEffect(text) {
        const div = document.createElement('div');
        div.className = 'chat-message ai-message';
        div.innerHTML = `<div class="avatar">🤖</div><div class="message-content"></div>`;
        aiChatLog.appendChild(div);
        const contentBox = div.querySelector('.message-content');
        
        let i = 0;
        function type() {
            if (i < text.length) {
                contentBox.textContent += text.charAt(i);
                i++;
                aiChatLog.scrollTop = aiChatLog.scrollHeight;
                setTimeout(type, 20);
            }
        }
        type();
    }

    // 启动！
    startQuizSession();
});