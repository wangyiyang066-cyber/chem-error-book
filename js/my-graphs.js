// js/my-graphs.js (最终修复版 - 使用标准 Fetch + Authorization Header)

document.addEventListener('userReady', async () => {
    if (!user || !supabaseClient) { return; }

    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');
    const createBtn = document.getElementById('create-graph-btn');
    const newGraphNameInput = document.getElementById('new-graph-name');

    // ▼▼▼ 核心改动：创建一个带用户认证的 fetch 辅助函数 ▼▼▼
    async function fetchWithAuth(url, options = {}) {
        // 1. 从 Supabase 获取当前用户的 session
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error || !session) {
            throw new Error('无法获取用户认证信息，请重新登录。');
        }

        // 2. 准备 headers，并加入 Authorization
        const headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}` // 这就是“身份通行证”
        };

        // 3. 发出带认证信息的 fetch 请求
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '请求失败');
        }
        
        return response.json(); // 成功则返回 JSON 数据
    }
    // ▲▲▲ 改动结束 ▲▲▲

    async function loadGraphs() {
        privateList.innerHTML = '<p>加载中...</p>';
        publicList.innerHTML = '<p>加载中...</p>';
        
        try {
            // ▼▼▼ 核心改动：使用新的 fetchWithAuth 函数 ▼▼▼
            const graphs = await fetchWithAuth('/.netlify/functions/get-my-graphs', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });
            // ▲▲▲ 改动结束 ▲▲▲

            privateList.innerHTML = '';
            publicList.innerHTML = '';
            
            // ... 后续渲染列表的逻辑和之前完全一样，无需改动 ...
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

                if (graph.user_id === user.id) {
                    const togglePublicBtn = document.createElement('button');
                    togglePublicBtn.className = 'toggle-public-btn';
                    togglePublicBtn.dataset.graphId = graph.id;
                    togglePublicBtn.dataset.isPublic = graph.is_public;
                    togglePublicBtn.textContent = graph.is_public ? '设为私密' : '设为公开';
                    togglePublicBtn.style.marginLeft = '15px';

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '删除';
                    deleteBtn.className = 'delete-graph-btn';
                    deleteBtn.dataset.graphId = graph.id;
                    deleteBtn.style.marginLeft = '15px';
                    
                    actionsContainer.appendChild(togglePublicBtn);
                    actionsContainer.appendChild(deleteBtn);
                    privateList.appendChild(graphItemContainer);
                    hasPrivate = true;

                } else if (graph.is_public) {
                    const ownerInfo = document.createElement('span');
                    ownerInfo.textContent = '(公共图谱)';
                    ownerInfo.style.color = '#777';
                    actionsContainer.appendChild(ownerInfo);
                    publicList.appendChild(graphItemContainer);
                    hasPublic = true;
                }
            });

            if (!hasPrivate) { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (!hasPublic) { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) {
            privateList.innerHTML = `<p style="color: red;">加载图谱列表失败: ${error.message}</p>`;
            publicList.innerHTML = '';
        }
    }

    document.body.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.classList.contains('toggle-public-btn')) {
            const graphId = target.dataset.graphId;
            target.textContent = '处理中...';
            try {
                await fetchWithAuth('/.netlify/functions/toggle-graph-public', {
                    method: 'POST',
                    body: JSON.stringify({ graphId })
                });
                loadGraphs();
            } catch (error) {
                alert(`操作失败: ${error.message}`);
                loadGraphs();
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
                body: JSON.stringify({ userId: user.id, graphName: graphName })
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