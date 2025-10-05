// js/my-graphs.js (最终修复版 - 防止事件重复绑定)

// ▼▼▼ 核心改动：在全局范围创建一个“旗帜”变量 ▼▼▼
let isMyGraphsInitialized = false;

document.addEventListener('userReady', async () => {
    // ▼▼▼ 核心改动：检查“旗帜”，如果已经初始化过，就直接退出，不再重复执行 ▼▼▼
    if (isMyGraphsInitialized) {
        console.log('my-graphs.js has already been initialized. Skipping...');
        return;
    }

    // 如果是第一次运行，则正常执行所有初始化代码
    console.log('Initializing my-graphs.js for the first time...');

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
        // 增加一个检查，如果返回内容为空，则返回null而不是尝试解析JSON
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

                    if (graph.is_public) {
                        publicList.appendChild(graphItemContainer);
                        hasPublic = true;
                    } else {
                        if (graph.user_id === user.id) {
                            privateList.appendChild(graphItemContainer);
                            hasPrivate = true;
                        }
                    }
                });
            }

            if (!hasPrivate) { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (!hasPublic) { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) {
            privateList.innerHTML = `<p style="color: red;">加载图谱列表失败: ${error.message}</p>`;
            publicList.innerHTML = '';
        }
    }

    // 将事件监听器移出函数，并使用事件委托模式，确保只绑定一次
    document.body.addEventListener('click', async (event) => {
        // --- 处理切换公开/私密按钮 ---
        if (event.target.classList.contains('toggle-public-btn')) {
            const target = event.target;
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

        // --- 处理删除按钮 ---
        if (event.target.classList.contains('delete-graph-btn')) {
            const target = event.target;
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

    // --- 处理创建按钮 ---
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

    // ▼▼▼ 核心改动：在所有初始化代码成功执行后，升起“旗帜” ▼▼▼
    isMyGraphsInitialized = true;
});