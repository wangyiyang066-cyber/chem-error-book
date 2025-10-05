
document.addEventListener('userReady', async () => {
    if (!user) { return; }

    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');
    const createBtn = document.getElementById('create-graph-btn');
    const newGraphNameInput = document.getElementById('new-graph-name');

    async function loadGraphs() {
        privateList.innerHTML = '<p>加载中...</p>';
        publicList.innerHTML = '<p>加载中...</p>';
        
        try {
            const response = await fetch('/.netlify/functions/get-my-graphs', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });
            if (!response.ok) throw new Error('获取列表失败');
            
            const graphs = await response.json();
            privateList.innerHTML = '';
            publicList.innerHTML = '';

            graphs.forEach(graph => {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginBottom = '10px';

                const graphLink = document.createElement('a');
                graphLink.href = `knowledge-graph.html?id=${graph.id}`;
                graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
                
                container.appendChild(graphLink);

                if (graph.is_public) {
                    publicList.appendChild(container);
                } else if (graph.user_id === user.id) {
                    // --- ↓↓↓ 核心改动：只为用户自己的私人图谱添加删除按钮 ↓↓↓ ---
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '删除';
                    deleteBtn.classList.add('delete-graph-btn');
                    deleteBtn.dataset.graphId = graph.id; // 将图谱ID存放在按钮上
                    deleteBtn.style.marginLeft = '15px';
                    deleteBtn.style.padding = '2px 8px';
                    deleteBtn.style.fontSize = '0.8em';
                    deleteBtn.style.backgroundColor = '#e74c3c';
                    deleteBtn.style.color = 'white';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.borderRadius = '4px';
                    deleteBtn.style.cursor = 'pointer';
                    container.appendChild(deleteBtn);
                    // --- ↑↑↑ 核心改动结束 ↑↑↑ ---
                    privateList.appendChild(container);
                }
            });

            if (privateList.innerHTML === '') { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (publicList.innerHTML === '') { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) { /* ... */ }
    }

    // --- ↓↓↓ 核心改动：为删除按钮添加事件处理 ---
    document.body.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-graph-btn')) {
            const graphId = event.target.dataset.graphId;
            
            // 弹出确认框，防止误删
            const isConfirmed = window.confirm(`你确定要删除这个图谱吗？此操作无法撤销！`);

            if (isConfirmed) {
                try {
                    await fetch('/.netlify/functions/delete-graph', {
                        method: 'POST',
                        body: JSON.stringify({ graphId: graphId, userId: user.id })
                    });
                    // 删除成功后，重新加载列表
                    loadGraphs();
                } catch (error) {
                    alert('删除失败，请稍后再试。');
                    console.error(error);
                }
            }
        }
    });
    // --- ↑↑↑ 核心改动结束 ↑↑↑ ---

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


    loadGraphs();
});


