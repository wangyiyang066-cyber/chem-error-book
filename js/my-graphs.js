// js/my-graphs.js (最终完美版)

document.addEventListener('userReady', async () => {
    if (!user || !supabaseClient) { return; }

    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');
    const createBtn = document.getElementById('create-graph-btn');
    const newGraphNameInput = document.getElementById('new-graph-name');

    // (fetchWithAuth 辅助函数和之前一样，保持不变)
    async function fetchWithAuth(url, options = {}) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) { throw new Error('无法获取用户认证信息，请重新登录。'); }
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || '请求失败'); }
        return response.json();
    }

    async function loadGraphs() {
        privateList.innerHTML = '<p>加载中...</p>';
        publicList.innerHTML = '<p>加载中...</p>';
        
        try {
            const graphs = await fetchWithAuth('/.netlify/functions/get-my-graphs', { method: 'POST' });
            
            privateList.innerHTML = '';
            publicList.innerHTML = '';
            
            let hasPrivate = false;
            let hasPublic = false;

            graphs.forEach(graph => {
                const graphItemContainer = document.createElement('div');
                graphItemContainer.style.display = 'flex';
                graphItemContainer.style.justifyContent = 'space-between';
                graphItemContainer.style.alignItems = 'center';
                graphItemContainer.style.padding = '10px';
                graphItemContainer.style.border = '1px solid #eee';
                graphItemContainer.style.borderRadius = '8px';
                graphItemContainer.style.marginBottom = '10px';

                const graphLink = document.createElement('a');
                graphLink.href = `knowledge-graph.html?id=${graph.id}`;
                graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
                
                const actionsContainer = document.createElement('div');
                graphItemContainer.appendChild(graphLink);
                graphItemContainer.appendChild(actionsContainer);
                
                // --- ▼▼▼ 核心逻辑修正 ▼▼▼ ---

                // 只要是当前用户创建的，就给他显示“管理”按钮 (公开/私密, 删除)
                if (graph.user_id === user.id) {
                    const togglePublicBtn = document.createElement('button');
                    togglePublicBtn.className = 'toggle-public-btn';
                    togglePublicBtn.dataset.graphId = graph.id;
                    togglePublicBtn.textContent = graph.is_public ? '设为私密' : '设为公开';
                    togglePublicBtn.style.marginLeft = '15px';
                    actionsContainer.appendChild(togglePublicBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '删除';
                    deleteBtn.className = 'delete-graph-btn';
                    deleteBtn.dataset.graphId = graph.id;
                    deleteBtn.style.marginLeft = '15px';
                    actionsContainer.appendChild(deleteBtn);
                }

                // 根据 is_public 状态决定把它放到哪个列表
                if (graph.is_public) {
                    publicList.appendChild(graphItemContainer);
                    hasPublic = true;
                } else {
                    // 只有自己的私有图谱才出现在私人列表
                    if (graph.user_id === user.id) {
                        privateList.appendChild(graphItemContainer);
                        hasPrivate = true;
                    }
                }
                // --- ▲▲▲ 核心逻辑修正结束 ▲▲▲ ---
            });

            if (!hasPrivate) { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (!hasPublic) { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) {
            privateList.innerHTML = `<p style="color: red;">加载图谱列表失败: ${error.message}</p>`;
            publicList.innerHTML = '';
        }
    }

    // 事件委托 (现在也包含删除逻辑)
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        // ... (公开/私密切换逻辑不变) ...
        if (target.classList.contains('toggle-public-btn')) {
            const graphId = target.dataset.graphId;
            target.textContent = '处理中...';
            try {
                await fetchWithAuth('/.netlify/functions/toggle-graph-public', { method: 'POST', body: JSON.stringify({ graphId }) });
                loadGraphs();
            } catch (error) {
                alert(`操作失败: ${error.message}`);
                loadGraphs();
            }
        }

        // ▼▼▼ 新增的删除按钮逻辑 ▼▼▼
        if (target.classList.contains('delete-graph-btn')) {
            const graphId = target.dataset.graphId;
            if (confirm('你确定要永久删除这个图谱吗？此操作无法撤销！')) {
                try {
                    await fetchWithAuth('/.netlify/functions/delete-graph', {
                        method: 'POST',
                        body: JSON.stringify({ graphId })
                    });
                    loadGraphs(); // 成功后刷新列表
                } catch (error) {
                    alert(`删除失败: ${error.message}`);
                }
            }
        }
    });

    createBtn.addEventListener('click', async () => {
        const graphName = newGraphNameInput.value.trim();
        if (!graphName) return alert('请输入图谱名称！');
        
        createBtn.disabled = true;
        createBtn.textContent = '创建中...';
        try {
            const newGraph = await fetchWithAuth('/.netlify/functions/create-new-graph', {
                method: 'POST',
                body: JSON.stringify({ graphName: graphName })
            });
            window.location.href = `knowledge-graph.html?id=${newGraph.id}`;
        } catch(error) {
            alert(`创建失败: ${error.message}`);
            createBtn.disabled = false;
            createBtn.textContent = '创建新图谱';
        }
    });

    loadGraphs();
});