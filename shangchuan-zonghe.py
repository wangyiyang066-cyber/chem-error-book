import os
import re
import json
import docx
import dashscope
import time
from docx.oxml.ns import qn
from supabase import create_client, Client
from http import HTTPStatus
from datetime import datetime
from difflib import get_close_matches

# ================= 🔧 配置区域 =================
dashscope.api_key = "sk-6ffcc5b750dd4b95b29e40fa22106b85" 

SUPABASE_URL = "https://ghuyiwhqdellucjxqiwj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go"

# 🔴 你的综合题文件夹路径 (请确保里面是 .docx 文件)
TARGET_FOLDER = '/Users/yiyangwang/Desktop/knowledge/综合体'

# ================= 初始化 =================
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Supabase 连接失败: {e}")
    exit()

# ================= 🛠 辅助工具函数 =================

def get_unit_from_filename(filename):
    # 针对综合卷，直接提取地名和年份作为背景，帮助AI判断
    # 例如：2023年湖南省常德市中考化学试卷 -> 背景：2023常德中考
    return f"综合测试卷：{filename.replace('.docx', '')}"

def fetch_latest_knowledge_map():
    """同步知识点菜单"""
    print("📡 正在同步知识星空地图...")
    try:
        response = supabase.table("knowledge_nodes")\
            .select("id, full_code, title")\
            .order("full_code")\
            .execute()
        
        kp_map = {}
        kp_names_list = []
        for item in response.data:
            clean_code = item['full_code'] if item['full_code'] else ""
            key_name = f"{clean_code} {item['title']}".strip()
            kp_map[key_name] = item['id']
            kp_names_list.append(key_name)
            
        print(f"✅ 地图加载完毕！包含 {len(kp_map)} 个坐标。")
        return kp_map, kp_names_list
    except Exception as e:
        print(f"❌ 获取知识点失败: {e}")
        return {}, []

def upload_image_to_supabase(image_data, filename):
    bucket_name = "question-images"
    try:
        storage_path = f"comprehensive/{datetime.now().strftime('%Y%m%d')}/{filename}"
        supabase.storage.from_(bucket_name).upload(
            path=storage_path, file=image_data, file_options={"content-type": "image/png"}
        )
        return supabase.storage.from_(bucket_name).get_public_url(storage_path)
    except Exception: return None

def extract_images_from_paragraph(paragraph, doc_part):
    images_data = []
    blips = paragraph._element.findall('.//' + qn('a:blip'))
    for blip in blips:
        embed_id = blip.get(qn('r:embed'))
        if embed_id:
            try:
                image_part = doc_part.related_parts[embed_id]
                images_data.append(image_part.blob)
            except KeyError: continue
    return images_data

# ================= 🧠 AI 核心大脑 (升级版：清洗+分析) =================

def ai_process_raw_block(raw_text, all_kp_names, context_info):
    """
    🔥 核心升级：
    输入：一段包含题目、答案、解析的混合文本（raw_text）
    输出：清洗后的结构化数据
    """
    
    # 提示词：要求 AI 扮演数据清洗专家 + 化学老师
    prompt = f"""
    你是一个极其严谨的化学试题数据处理专家。
    我将提供一段从Word文档中提取的“原始文本块”。
    
    【原始文本块】
    {raw_text[:1500]} 
    (以上文本可能包含：题干、选项、答案、解析，但也可能混在一起，格式混乱)

    【任务】
    1. **分离与清洗**：请智能识别并分离出“题目内容(Stem)”、“正确答案(Answer)”、“题目解析(Analysis)”。
       - 如果文本中包含【答案】【解析】等标记，请据此分离。
       - 如果没有标记，请根据语意逻辑分离（例如“故选C”前面通常是解析）。
       - 如果文本中完全找不到答案或解析，请在对应字段填“暂无”。
    2. **难度评估**：0.1(简单) - 0.9(难)。
    3. **考点匹配**：从下方【标准考点库】中选择1-3个最匹配的考点。必须使用库里的原词。
    
    【标准考点库】
    (请在数千个考点中智能匹配，只返回最核心的)
    {", ".join(all_kp_names[:50])} ... (此处省略，请基于你的化学知识匹配)

    【必须输出 JSON 格式】
    {{
        "clean_question": "清洗后的纯净题目文本（不含答案和解析，但保留选项）",
        "correct_answer": "清洗出来的答案（如：C）",
        "clean_analysis": "清洗出来的解析（去除乱码，语言通顺）",
        "error_analysis": "一句话易错点拨（不超过30字）",
        "difficulty": 0.6,
        "knowledge_points": ["完整考点名称1", "完整考点名称2"]
    }}
    """
    
    try:
        response = dashscope.Generation.call(
            model='qwen-plus',  # 使用 Plus 模型，逻辑更强
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        if response.status_code == HTTPStatus.OK:
            content = response.output.choices[0].message.content
            content = re.sub(r"```json|```", "", content).strip()
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match: return json.loads(match.group())
    except Exception as e:
        print(f"  ⚠️ AI 处理超时或错误: {e}")
    
    # 兜底返回
    return {
        "clean_question": raw_text, # 如果失败，就用原文本
        "correct_answer": "需人工核对",
        "clean_analysis": "解析提取失败",
        "error_analysis": "",
        "difficulty": 0.5,
        "knowledge_points": []
    }

# ================= 📂 文件处理逻辑 =================

def process_one_file(filepath, kp_map, all_kp_names):
    filename = os.path.basename(filepath)
    if filename.startswith("~$"): return 
    
    context_info = get_unit_from_filename(filename)
    print(f"\n==========================================")
    print(f"📄 处理综合卷: {filename}")
    print(f"==========================================")
    
    doc = docx.Document(filepath)
    
    # 📦 原始数据块列表
    # 我们不再在 Python 里细分答案，而是按题号把一块内容存下来
    raw_blocks = [] 
    current_block = None
    
    # 正则：匹配题号开头，如 "1." "1、" "13."
    q_start_pattern = re.compile(r'^\s*\d+[．\.\、]') 

    for para in doc.paragraphs:
        text = para.text.strip()
        imgs = extract_images_from_paragraph(para, doc.part)
        
        # 遇到新题号，说明上一题结束了
        if q_start_pattern.match(text):
            if current_block: raw_blocks.append(current_block)
            current_block = {
                "raw_text": text, # 题干开始
                "images": list(imgs) # 复制图片列表
            }
        else:
            # 不是新题号，统统追加到当前块里
            if current_block:
                if text: current_block['raw_text'] += "\n" + text
                if imgs: current_block['images'].extend(imgs)

    # 别忘了最后一题
    if current_block: raw_blocks.append(current_block)
    
    print(f"✅ 提取出 {len(raw_blocks)} 个原始题块，开始 AI 清洗与入库...")

    # --- 循环处理每个块 ---
    success_count = 0
    
    for idx, block in enumerate(raw_blocks):
        print(f"   [{idx+1}/{len(raw_blocks)}] ", end="", flush=True)
        
        # 1. 上传图片
        img_urls = []
        if block['images']:
            print(f"图({len(block['images'])}) ", end="")
            for i, img_data in enumerate(block['images']):
                fname = f"comp_{filename[:5]}_{idx}_{i}.png"
                url = upload_image_to_supabase(img_data, fname)
                if url: img_urls.append(url)
        
        # 2. 🔥 AI 深度清洗与分析
        ai_res = ai_process_raw_block(block['raw_text'], all_kp_names, context_info)
        
        # 3. 写入数据库 (注意 zongheti: True)
        try:
            res = supabase.table("questions").insert({
                "full_question": ai_res.get('clean_question', block['raw_text']), # 使用清洗后的题目
                "correct_answer": ai_res.get('correct_answer', ''),
                "analysis": ai_res.get('clean_analysis', ''),
                "error_analysis": ai_res.get('error_analysis', ''),
                "difficulty": str(ai_res.get('difficulty', 0.5)),
                "image_urls": img_urls,
                "zongheti": True  # 🟢 核心标记：这是综合题
            }).execute()
            
            if res.data:
                q_id = res.data[0]['id']
                
                # 4. 关联知识点
                link_data = []
                # AI 返回的知识点名称，去 Map 里找 ID
                for kp_name in ai_res.get('knowledge_points', []):
                    # 优先精确匹配
                    if kp_name in kp_map:
                        link_data.append({"question_id": q_id, "knowledge_point_id": kp_map[kp_name]})
                    else:
                        # 模糊匹配
                        matches = get_close_matches(kp_name, all_kp_names, n=1, cutoff=0.5)
                        if matches:
                            link_data.append({"question_id": q_id, "knowledge_point_id": kp_map[matches[0]]})
                
                if link_data:
                    supabase.table("question_knowledge_point_link").insert(link_data).execute()
                    print("🔗", end="")
                else:
                    print("⚪", end="")
                print(" OK")
                success_count += 1
                
        except Exception as e:
            print(f"❌ {e}")

    print(f"🎉 文件处理完成: {filename}")

# ================= 🚀 主程序入口 =================

if __name__ == "__main__":
    # 1. 获取知识点
    kp_map, all_kp_names = fetch_latest_knowledge_map()
    
    if not kp_map:
        print("❌ 无法获取知识点，程序退出")
        exit()

    # 2. 扫描目录
    print(f"\n📂 扫描目录: {TARGET_FOLDER}")
    
    # 过滤 .docx 文件 (请务必先将 .doc 转为 .docx)
    docx_files = [f for f in os.listdir(TARGET_FOLDER) if f.endswith('.docx') and not f.startswith('~$')]
    docx_files.sort()
    
    print(f"🧐 发现 {len(docx_files)} 个 .docx 文件。")
    if len(docx_files) == 0:
        print("⚠️ 警告：没有发现 .docx 文件！请先将 .doc 文件另存为 .docx 格式！")
    
    for filename in docx_files:
        full_path = os.path.join(TARGET_FOLDER, filename)
        try:
            process_one_file(full_path, kp_map, all_kp_names)
        except Exception as e:
            print(f"❌ 严重错误: {e}")

    print("\n🎉🎉🎉 所有综合题上传任务结束！ 🎉🎉🎉")