// js/knowledge-graph.js (V3.0 最终实时协作版)

document.addEventListener('DOMContentLoaded', function() {
    // --- 1. 配置 Supabase 客户端 ---
    const SUPABASE_URL = '你自己的 Supabase Project URL'; // <<< 填入你的信息
    const SUPABASE_ANON_KEY = '你自己的 Supabase anon public 密钥'; // <<< 填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- 2. 初始化画板 ---
    const id = document.getElementById("drawflow");
    const editor = new Drawflow(id);
    editor.start();
    
    // --- 3. 拖拽功能 ---
    window.allowDrop = function(ev) { ev.preventDefault(); }
    window.drag = function(ev) { ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type')); }
    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");
        let nodeName = '';
        let nodeHTML = `<div><textarea df-text placeholder="输入内容..."></textarea></div>`;
        if (nodeType === 'concept') nodeName = '核心概念';
        else if (nodeType === 'example') nodeName = '具体实例';
        if (nodeName) editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, {}, nodeHTML);
    }

    // --- 4. 升级的保存和加载功能 ---
    
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        console.log("自动保存中...");
        try {
            // 我们之前创建的 `save-graph.js` 云函数在这里发挥作用
            await fetch('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify(graphData.drawflow)
            });
            console.log("保存成功！");
        } catch (error) {
            console.error("自动保存失败:", error);
        }
    }, 1000); // 用户停止操作 1 秒后自动保存

    async function loadGraph() {
        try {
            // 我们之前创建的 `get-graph.js` 云函数在这里发挥作用
            const response = await fetch('/.netlify/functions/get-graph');
            const graphData = await response.json();
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) {
            console.error("加载图谱失败:", error);
        }
    }

    // --- 5. 注入魔法：开启实时“天线”！ ---
    
    console.log("正在开启实时天线，监听协作...");
    const channel = supabaseClient.channel('knowledge_graph_updates');

    channel
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', // 我们只关心更新事件
          schema: 'public',
          table: 'knowledge_graphs',
          filter: 'id=eq.1' // 我们暂时只监听全班共享的那张图 (ID=1)
        },
        (payload) => {
          // 当收到更新广播时，重新加载画板！
          console.log('收到远程更新，正在同步画板...');
          editor.import({ "drawflow": payload.new.graph_data });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ 实时天线已连接！');
        }
      });

    // --- 6. 绑定自动保存事件 ---
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    editor.on('nodeDataChanged', saveGraph);

    // 页面首次加载时，先加载一次图谱
    loadGraph();
});