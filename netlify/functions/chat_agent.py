import os
import json
import asyncio

# 导入 AgentScope 组件
from agentscope.agent import ReActAgent
from agentscope.model import DashScopeChatModel
from agentscope.formatter import DashScopeChatFormatter
from agentscope.memory import InMemoryMemory
# 导入 Message，用于处理可能的对话历史
from agentscope.message import Msg

# ----------------------------------------------------------------------
# ▼▼▼ 我们从你的 get-ai-analysis.js 文件中“借”来了这个提示词 ▼▼▼
# ----------------------------------------------------------------------
SYSTEM_PROMPT = (
    "你是一名资深的初三化学老师，擅长用清晰、易懂、循循善诱的方式解释复杂"
    "的化学问题。你的任务是为学生答错的题目生成高质量的解析和后续问答。"
    "请始终保持专业、耐心、友好的老师身份。"
)
# ----------------------------------------------------------------------

# --- 在 handler 外部初始化智能体 (这样可以复用，速度更快) ---
try:
    API_KEY = os.environ["DASHSCOPE_API_KEY"]
    
    model = DashScopeChatModel(
        model_name="qwen-max",
        api_key=API_KEY,
        stream=False, # Serverless 函数用非流式 (stream=False) 更简单
    )

    agent = ReActAgent(
        name="ChemistryAgent",
        sys_prompt=SYSTEM_PROMPT, # <-- 看这里，我们用了你的提示词
        model=model,
        memory=InMemoryMemory(), # 每个智能体都有自己的短期记忆
        formatter=DashScopeChatFormatter(),
    )
except KeyError:
    # 如果启动时没有在环境中找到 API Key，agent 会是 None
    agent = None


# --- Netlify Function 的入口函数 ---
# 它必须是异步的 (async def) 才能运行 AgentScope
async def handler(event, context):
    
    # 检查智能体是否因 API Key 缺失而初始化失败
    if agent is None:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'DASHSCOPE_API_KEY is not set in environment variables.'})
        }
        
    try:
        # 只处理 POST 请求
        if event['httpMethod'] != 'POST':
            return {'statusCode': 405, 'body': 'Method Not Allowed'}

        # 1. 从前端获取用户消息
        # 我们模仿 get-ai-analysis.js，也接收一个 "messages" 数组
        body = json.loads(event.body)
        messages_history = body.get('messages', [])

        if not messages_history:
            return {
                'statusCode': 400, 
                'body': json.dumps({'error': '请求体中必须包含 messages 数组。'})
            }

        # 2. 找到最后一条用户消息
        last_user_message = ""
        for msg in reversed(messages_history):
            if msg.get("role") == "user":
                last_user_message = msg.get("content", "")
                break
        
        if not last_user_message:
            return {
                'statusCode': 400, 
                'body': json.dumps({'error': 'messages 数组中没有找到 user 消息。'})
            }

        # 3. 运行 AgentScope 智能体 (异步调用)
        # AgentScope 的智能体会自动处理它自己的记忆
        # 我们只需要把最后一条用户消息发给它
        response_msg = await agent(last_user_message)
        
        # 4. 提取智能体的回复内容
        agent_reply = response_msg.get_text_content()

        # 5. 将回复作为 JSON 返回给前端
        # 我们模仿 DeepSeek 的返回格式，方便你前端处理
        response_body = {
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': agent_reply
                }
            }]
        }
        
        return {
            'statusCode': 200,
            'headers': { 'Content-Type': 'application/json' },
            'body': json.dumps(response_body)
        }
        
    except Exception as e:
        # 处理其他运行时错误
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }