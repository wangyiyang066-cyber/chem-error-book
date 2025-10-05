// js/knowledge-graph.js (V3.0 最终实时协作版)

document.addEventListener('DOMContentLoaded', function() {
    // --- 1. 配置 Supabase 客户端 ---
    const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // <<< 填入你的信息
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go'; // <<< 填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- 2. 初始化画板 (和之前一样) ---
    const id = document.getElementById("drawflow");
    const editor = new Drawflow(id);
    editor.start();
    // ... (拖拽功能和之前一样)
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

    // --- 3. 升级保存和加载功能 ---
    
    // 这是一个“防抖”函数，能防止我们过于频繁地保存，只有在用户停止操作一小段时间后才执行
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 新的保存函数，现在它会被自动调用
    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        console.log("自动保存中...");
        try {
            await fetch('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify(graphData.drawflow)
            });
            console.log("保存成功！");
        } catch (error) {
            console.error("自动保存失败:", error);
        }
    }, 1000); // 用户停止操作 1 秒后自动保存

    // 加载函数 (保持不变)
    async function loadGraph() {
        try {
            const response = await fetch('/.netlify/functions/get-graph');
            const graphData = await response.json();
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) {
            console.error("加载图谱失败:", error);
        }
    }

    // --- 4. 注入魔法：开启实时“天线”！ ---
    
    // 创建一个唯一的频道名
    const channel = supabaseClient.channel('knowledge_graph_channel');

    // 订阅这个频道，监听数据库的变化
    channel
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', // 我们只关心更新事件
          schema: 'public',
          table: 'knowledge_graphs',
          filter: 'id=eq.1' // 只监听我们那张共享图谱的变化
        },
        (payload) => {
          // 当收到更新广播时，重新加载画板！
          console.log('收到远程更新，正在同步画板...', payload.new.graph_data);
          editor.import({ "drawflow": payload.new.graph_data });
        }
      )
      .subscribe();

    console.log("已开启实时天线，正在监听协作。");

    // --- 5. 绑定自动保存事件 ---
    // 当画板发生任何变化时，都触发自动保存
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);

    // 页面首次加载时，先加载一次图谱
    loadGraph();
});