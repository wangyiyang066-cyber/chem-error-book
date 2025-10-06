// js/my-graphs.js (最终修正版 - 修复创作者显示问题)

document.addEventListener('userReady', () => {
    if (!user) return;

    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');
    const createBtn = document.getElementById('create-graph-btn');
    const newGraphNameInput = document.getElementById('new-graph-name');

    async function fetchWithAuth(url, options = {}) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) { throw new Error('无法获取用户认证信息，请重新登录。'); }
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ message: "请求失败" })); throw new Error(errorData.message); }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
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

            if (graphs && graphs.length > 0) {
                graphs.forEach(graph => {
                    const graphItemContainer = document.createElement('div');
                    graphItemContainer.className = 'graph-item';

                    const infoContainer = document.createElement('div');
                    infoContainer.style.display = 'flex';
                    infoContainer.style.flexDirection = 'column';
                    infoContainer.style.gap = '5px'; // 为标题和创作者之间增加一点间距

                    const graphLink = document.createElement('a');
                    graphLink.href = `knowledge-graph.html?id=${graph.id}`;
                    graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
                    infoContainer.appendChild(graphLink);

                    const actionsContainer = document.createElement('div');
                    actionsContainer.className = 'graph-item-actions';
                    
                    graphItemContainer.appendChild(infoContainer);
                    graphItemContainer.appendChild(actionsContainer);

                    // ------------------- ▼▼▼ 核心逻辑修正 ▼▼▼ -------------------
                    
                    // 判定归属和显示位置
                    if (graph.user_id === user.id) {
                        // 这是我创建的图谱
                        // 无论公私，都显示管理按钮
                        const togglePublicBtn = document.createElement('button');
                        togglePublicBtn.className = 'toggle-public-btn';
                        togglePublicBtn.dataset.graphId = graph.id;
                        togglePublicBtn.textContent = graph.is_public ? '设为私密' : '设为公开';
                        actionsContainer.appendChild(togglePublicBtn);

                        const deleteBtn = document.createElement('button');
                        deleteBtn.textContent = '删除';
                        deleteBtn.className = 'delete-graph-btn';
                        deleteBtn.dataset.graphId = graph.id;
                        actionsContainer.appendChild(deleteBtn);

                        if (graph.is_public) {
                            // 我创建的公共图谱
                            publicList.appendChild(graphItemContainer);
                            hasPublic = true;
                        } else {
                            // 我创建的私人图谱
                            privateList.appendChild(graphItemContainer);
                            hasPrivate = true;
                        }
                    } else {
                        // 这是别人创建的公共图谱
                        if (graph.creator_email) {
                            const creatorInfo = document.createElement('em');
                            creatorInfo.textContent = `由 ${graph.creator_email} 创建`;
                            creatorInfo.style.fontSize = '0.8em';
                            creatorInfo.style.color = '#777';
                            infoContainer.appendChild(creatorInfo);
                        }
                        publicList.appendChild(graphItemContainer);
                        hasPublic = true;
                    }
                    
                    // ------------------- ▲▲▲ 核心逻辑修正结束 ▲▲▲ -------------------
                });
            }

            if (!hasPrivate) { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (!hasPublic) { publicList.innerHTML = '<p>目前没有公共协作图谱。</p>'; }

        } catch (error) {
            privateList.innerHTML = `<p style="color: red;">加载图谱列表失败: ${error.message}</p>`;
            publicList.innerHTML = '';
        }
    }

    // ... (事件委托和创建按钮的逻辑和之前一样) ...
    document.body.addEventListener('click', async (event) => {
        const target = event.target;
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
        if (target.classList.contains('delete-graph-btn')) {
            const graphId = target.dataset.graphId;
            if (confirm('你确定要永久删除这个图谱吗？此操作无法撤销！')) {
                try {
                    await fetchWithAuth('/.netlify/functions/delete-graph', {
                        method: 'POST',
                        body: JSON.stringify({ graphId })
                    });
                    loadGraphs();
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