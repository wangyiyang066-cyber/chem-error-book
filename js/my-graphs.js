// js/my-graphs.js

document.addEventListener('userReady', async () => {
    if (!user) { return; }

    const privateList = document.getElementById('private-graphs-list');
    const publicList = document.getElementById('public-graphs-list');

    async function loadGraphs() {
        privateList.innerHTML = '<p>加载中...</p>';
        publicList.innerHTML = '<p>加载中...</p>';

        const response = await fetch('/.netlify/functions/get-my-graphs', {
            method: 'POST',
            body: JSON.stringify({ userId: user.id })
        });
        const graphs = await response.json();

        privateList.innerHTML = '';
        publicList.innerHTML = '';

        graphs.forEach(graph => {
            const graphLink = document.createElement('a');
            graphLink.href = `knowledge-graph.html?id=${graph.id}`;
            graphLink.textContent = graph.name || `未命名图谱 (ID: ${graph.id})`;
            graphLink.style.display = 'block';

            if (graph.is_public) {
                publicList.appendChild(graphLink);
            } else if (graph.user_id === user.id) {
                privateList.appendChild(graphLink);
            }
        });

        if (privateList.innerHTML === '') { privateList.innerHTML = '<p>你还没有创建任何私人图谱。</p>'; }
        if (publicList.innerHTML === '') { publicList.innerHTML = '<p>目前没有公共图谱。</p>'; }
    }

    // 创建新图谱的逻辑
    document.getElementById('create-graph-btn').addEventListener('click', async () => {
        // (我们将在下一步实现这个云函数)
        alert('创建新图谱的功能将在下一步实现！');
    });

    loadGraphs();
});