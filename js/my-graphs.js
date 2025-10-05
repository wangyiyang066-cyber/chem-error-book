// js/my-graphs.js (V2版 - 支持创建新图谱)

document.addEventListener('userReady', async () => {
    // 确保 main.js 已经获取到了用户信息
    if (!user) {
        // 如果没有用户信息，理论上 main.js 会处理跳转，这里是双重保险
        document.getElementById('private-graphs-list').innerHTML = '<p>请先登录再查看。</p>';
        document.getElementById('public-graphs-list').innerHTML = '<p>请先登录再查看。</p>';
        return;
    }

    // 获取页面上的所有元素
    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');
    const createBtn = document.getElementById('create-graph-btn');
    const newGraphNameInput = document.getElementById('new-graph-name');

    // --- 函数：加载并显示图谱列表 ---
    async function loadGraphs() {
        privateList.innerHTML = '<p>加载中...</p>';
        publicList.innerHTML = '<p>加载中...</p>';
        
        try {
            // 呼叫云函数，获取该用户能看到的所有图谱
            const response = await fetch('/.netlify/functions/get-my-graphs', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });

            if (!response.ok) throw new Error('获取列表失败');
            
            const graphs = await response.json();

            // 清空加载提示
            privateList.innerHTML = '';
            publicList.innerHTML = '';

            // 遍历返回的图谱列表，并将它们分类显示
            graphs.forEach(graph => {
                const graphLink = document.createElement('a');
                // 每个链接都指向画板页面，并通过 URL 参数把图谱的 ID 传过去
                graphLink.href = `knowledge-graph.html?id=${graph.id}`;
                graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
                graphLink.style.display = 'block';

                if (graph.is_public) {
                    publicList.appendChild(graphLink);
                } else if (graph.user_id === user.id) {
                    privateList.appendChild(graphLink);
                }
            });

            // 如果列表为空，显示提示信息
            if (privateList.innerHTML === '') { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (publicList.innerHTML === '') { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) {
            console.error(error);
            privateList.innerHTML = '<p>加载私人图谱失败。</p>';
            publicList.innerHTML = '<p>加载公共图谱失败。</p>';
        }
    }

    // --- 为“创建新图谱”按钮赋予真实功能 ---
    createBtn.addEventListener('click', async () => {
        const graphName = newGraphNameInput.value.trim();
        if (!graphName) {
            alert('请输入新图谱的名称！');
            return;
        }
        
        createBtn.textContent = '创建中...';
        createBtn.disabled = true;

        try {
            // 呼叫云函数来创建新图谱
            const response = await fetch('/.netlify/functions/create-new-graph', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id, graphName: graphName })
            });

            if (!response.ok) throw new Error('创建失败');

            const newGraph = await response.json();
            
            // 创建成功后，直接跳转到新的画板页面进行编辑
            window.location.href = `knowledge-graph.html?id=${newGraph.id}`;

        } catch (error) {
            alert('创建图谱失败，请稍后再试。');
            console.error(error);
            createBtn.textContent = '创建新图谱';
            createBtn.disabled = false;
        }
    });

    // 页面加载时，自动执行一次加载函数
    loadGraphs();
});