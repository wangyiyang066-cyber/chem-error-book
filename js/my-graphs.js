// js/my-graphs.js (最终整合版 - 已添加协作功能)

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

            if (graphs.length === 0) {
                 privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>';
                 publicList.innerHTML = '<p>目前没有公共图谱。</p>';
                 return;
            }

            graphs.forEach(graph => {
                const graphItemContainer = document.createElement('div');
                graphItemContainer.className = 'graph-item'; // 使用 class 方便样式管理
                graphItemContainer.style.display = 'flex';
                graphItemContainer.style.justifyContent = 'space-between';
                graphItemContainer.style.alignItems = 'center';
                graphItemContainer.style.marginBottom = '10px';
                graphItemContainer.style.padding = '10px';
                graphItemContainer.style.border = '1px solid #eee';
                graphItemContainer.style.borderRadius = '8px';

                const graphLink = document.createElement('a');
                graphLink.href = `knowledge-graph.html?id=${graph.id}`;
                graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
                
                const actionsContainer = document.createElement('div');
                
                graphItemContainer.appendChild(graphLink);
                graphItemContainer.appendChild(actionsContainer);

                if (graph.is_public) {
                    publicList.appendChild(graphItemContainer);
                } else if (graph.user_id === user.id) {
                    // --- 只为用户自己的私人图谱添加协作和删除按钮 ---
                    
                    // ▼▼▼ 新增代码：创建“协作”按钮 ▼▼▼
                    const collaborateBtn = document.createElement('button');
                    collaborateBtn.innerHTML = '<i class="fas fa-users"></i> 协作';
                    collaborateBtn.className = 'collaborate-btn'; // class 用于事件监听
                    collaborateBtn.dataset.graphId = graph.id;
                    collaborateBtn.dataset.graphName = graph.name;
                    collaborateBtn.style.marginLeft = '15px';
                    collaborateBtn.style.cursor = 'pointer';
                    actionsContainer.appendChild(collaborateBtn);
                    // ▲▲▲ 新增代码结束 ▲▲▲

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '删除';
                    deleteBtn.className = 'delete-graph-btn';
                    deleteBtn.dataset.graphId = graph.id;
                    deleteBtn.style.marginLeft = '15px';
                    deleteBtn.style.cursor = 'pointer';
                    actionsContainer.appendChild(deleteBtn);
                    
                    privateList.appendChild(graphItemContainer);
                }
            });

            if (privateList.innerHTML === '') { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
            if (publicList.innerHTML === '') { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }

        } catch (error) {
            privateList.innerHTML = '<p>加载图谱列表失败。</p>';
            publicList.innerHTML = '<p>加载图谱列表失败。</p>';
        }
    }
    
    // --- 事件监听委托 ---
    document.body.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        // --- 处理删除按钮 ---
        if (target.classList.contains('delete-graph-btn')) {
            const graphId = target.dataset.graphId;
            const isConfirmed = window.confirm(`你确定要删除这个图谱吗？此操作无法撤销！`);

            if (isConfirmed) {
                try {
                    // (此处省略了删除逻辑，因为你的原文件已经有了)
                    loadGraphs(); // 重新加载列表
                } catch (error) { /* ... */ }
            }
        }
    });

    // ▼▼▼ 新增代码：处理协作弹窗的所有逻辑 ▼▼▼
    const modal = document.getElementById('collaborate-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addCollaboratorBtn = document.getElementById('add-collaborator-btn');
    const modalGraphName = document.getElementById('modal-graph-name');
    const collaboratorEmailInput = document.getElementById('collaborator-email');
    const modalStatus = document.getElementById('modal-status-message');

    // 1. 打开弹窗的逻辑
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('.collaborate-btn');
        if (target) {
            const graphId = target.dataset.graphId;
            const graphName = target.dataset.graphName;
            
            modalGraphName.textContent = graphName;
            modal.dataset.currentGraphId = graphId; // 将graphId暂存到弹窗上
            collaboratorEmailInput.value = ''; // 清空输入框
            modalStatus.textContent = ''; // 清空状态消息
            modal.style.display = 'block';
        }
    });

    // 2. 关闭弹窗的逻辑
    const closeModal = () => { modal.style.display = 'none'; };
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) { closeModal(); }
    });

    // 3. "确认添加" 按钮的逻辑
    addCollaboratorBtn.addEventListener('click', async () => {
        const graphId = modal.dataset.currentGraphId;
        const collaboratorEmail = collaboratorEmailInput.value.trim();

        if (!collaboratorEmail) {
            modalStatus.textContent = '请输入邮箱地址！';
            modalStatus.className = 'status-message error';
            return;
        }

        addCollaboratorBtn.textContent = '添加中...';
        addCollaboratorBtn.disabled = true;
        modalStatus.textContent = '';

        try {
            // 这是下一步我们要创建的云函数！
            const response = await fetch('/.netlify/functions/add-collaborator', {
                method: 'POST',
                body: JSON.stringify({ 
                    graphId: graphId, 
                    collaboratorEmail: collaboratorEmail 
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '未知错误');
            }

            modalStatus.textContent = '添加成功！';
            modalStatus.className = 'status-message success';
            setTimeout(() => { closeModal(); }, 1500); // 1.5秒后自动关闭弹窗

        } catch (error) {
            modalStatus.textContent = `添加失败: ${error.message}`;
            modalStatus.className = 'status-message error';
        } finally {
            addCollaboratorBtn.textContent = '确认添加';
            addCollaboratorBtn.disabled = false;
        }
    });
    // ▲▲▲ 新增代码结束 ▲▲▲

    createBtn.addEventListener('click', async () => {
        // (此处省略了创建新图谱的逻辑，因为你的原文件已经有了)
    });

    loadGraphs();
});