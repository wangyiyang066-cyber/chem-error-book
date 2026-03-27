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

# 你的知识点文件夹路径
TARGET_FOLDER = '/Users/yiyangwang/Desktop/knowledge/'

# ================= 初始化 =================
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Supabase 连接失败: {e}")
    exit()

# ================= 🛠 辅助工具函数 =================

def clear_database():
    """💥 核弹级功能：清空所有题目数据"""
    print("\nWARNING: 正在准备清空数据库...")
    print("3秒后开始执行，按 Ctrl+C 可取消...")
    time.sleep(3)
    
    try:
        print("🧹 1. 正在解除题目与知识点的关联...")
        supabase.table("question_knowledge_point_link").delete().neq("id", 0).execute()
        
        print("🧹 2. 正在删除所有题目...")
        supabase.table("questions").delete().neq("id", 0).execute()
        
        print("✅ 数据库已清空，准备重新注入灵魂！\n")
    except Exception as e:
        print(f"❌ 清空失败 (可能是表已经空了): {e}")

def get_unit_from_filename(filename):
    """从文件名猜测这是第几单元，用于给 AI 提供背景"""
    # 匹配 "第1单元", "第2单元", "第一单元", "第八单元"
    match = re.search(r"第([0-9一二三四五六七八九十]+)单元", filename)
    if match:
        unit_num = match.group(1)
        return f"初三化学第{unit_num}单元"
    return "初三化学综合"

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
        storage_path = f"{datetime.now().strftime('%Y%m%d')}/{filename}"
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

# ================= 🧠 AI 核心大脑 =================

def ai_analyze_question(question_text, analysis_text, all_kp_names, context_info, chapter_hint):
    """
    搭载了【优化版提示词】的 AI 分析函数
    """
    # 考点初筛：只传当前单元相关的考点，防止 Token 溢出
    # 例如：如果是“第2单元”，我们优先传 2.x.x 的考点
    # 如果找不到对应单元的考点，就传全部
    
    # 简单的筛选逻辑
    relevant_kps = all_kp_names
    # 尝试从 context_info (如 "初三化学第2单元") 提取数字
    unit_match = re.search(r"第(\d+)", context_info)
    if unit_match:
        u_num = unit_match.group(1)
        relevant_kps = [k for k in all_kp_names if k.startswith(f"{u_num}.")]
        if len(relevant_kps) < 5: relevant_kps = all_kp_names # 如果太少，回退到全部
    
    kp_str = "\n".join(relevant_kps)
    
    # 🔥🔥🔥 优化后的提示词 🔥🔥🔥
    prompt = f"""
    你是拥有20年经验的初中化学高级教师。请基于以下严格标准对题目进行分析。
    
    【背景】{context_info}
    【章节线索】{chapter_hint}
    
    【任务一：难度精准评估 (Difficulty)】
    请参考以下标准，给出 0.1 ~ 0.9 的难度系数：
    - 0.1 ~ 0.2 (基础送分题): 仅考察定义记忆、仪器识别或直接观察。
    - 0.3 ~ 0.4 (简单应用题): 单一知识点理解，逻辑直接，无陷阱。
    - 0.5 ~ 0.6 (中等综合题): 涉及 2 个及以上考点，或简单推理。
    - 0.7 ~ 0.8 (拔高难题): 涉及实验探究原理、多步逻辑推理、复杂计算。
    - 0.9 (压轴挑战题): 创新实验或跨单元深度综合。

    【任务二：易错陷阱点拨 (Error Analysis)】
    用简练的一句话（不超过30字），精准点出学生最容易做错的原因、混淆的概念或忽略的细节。

    【任务三：核心考点匹配 (Knowledge Points)】
    从下方的【标准考点库】中，挑选 1-3 个最匹配的考点。
    ⚠️ 严禁指令：必须直接复制库里的完整字符串（包含编号），绝对禁止自己编造考点名称！
    
    【标准考点库】
    {kp_str}
    
    【题目内容】
    {question_text[:1000]}
    
    【解析内容】
    {analysis_text[:500]}
    
    【必须输出 JSON 格式】
    {{
        "difficulty": 0.3,
        "error_analysis": "易混淆‘光’与‘烟’的区别，误将烟当做气体。",
        "knowledge_points": ["1.2.1 蜡烛及其燃烧的探究"]
    }}
    """
    
    try:
        response = dashscope.Generation.call(
            model='qwen-plus', 
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        if response.status_code == HTTPStatus.OK:
            content = response.output.choices[0].message.content
            content = re.sub(r"```json|```", "", content).strip()
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match: return json.loads(match.group())
    except Exception as e:
        print(f"  ⚠️ AI 思考超时: {e}")
    
    return {"difficulty": 0.5, "error_analysis": "", "knowledge_points": []}

# ================= 📂 文件处理逻辑 =================

def process_one_file(filepath, kp_map, all_kp_names):
    filename = os.path.basename(filepath)
    if filename.startswith("~$"): return # 跳过临时文件
    
    unit_context = get_unit_from_filename(filename)
    print(f"\n==========================================")
    print(f"📄 正在处理: {filename}")
    print(f"🌍 设定背景: {unit_context}")
    print(f"==========================================")
    
    doc = docx.Document(filepath)
    questions = []
    current_q = None
    current_chapter = "综合练习"
    
    q_start_pattern = re.compile(r'^\s*\d+[．\.\、]') 
    section_pattern = re.compile(r'^\s*[一二三四五六七八九十]+[．\.\、]')

    # --- 解析文档 ---
    for para in doc.paragraphs:
        text = para.text.strip()
        imgs = extract_images_from_paragraph(para, doc.part)
        
        if section_pattern.match(text) and "选择题" not in text:
            current_chapter = text
            continue

        if text.startswith("【答案】"):
            if current_q: current_q['correct_answer'] = text.replace("【答案】", "").strip()
            continue
        if any(text.startswith(x) for x in ["【解答】", "【解析】", "【分析】"]):
            clean = re.sub(r"^【.*?】", "", text).strip()
            if current_q: current_q['analysis'] = clean
            continue

        if q_start_pattern.match(text):
            if current_q: questions.append(current_q)
            current_q = {
                "full_question": text, "correct_answer": "", "analysis": "",
                "chapter_hint": current_chapter, "images": []
            }
            if imgs: current_q['images'].extend(imgs)
        else:
            if current_q:
                if text: current_q['full_question'] += "\n" + text
                if imgs: current_q['images'].extend(imgs)

    if current_q: questions.append(current_q)
    print(f"✅ 解析出 {len(questions)} 道题目，开始入库...")

    # --- 入库循环 ---
    for idx, q in enumerate(questions):
        print(f"   [{idx+1}/{len(questions)}] ", end="", flush=True)
        
        # 1. 上传图片
        img_urls = []
        if q['images']:
            print(f"图({len(q['images'])}) ", end="")
            for i, img_data in enumerate(q['images']):
                fname = f"{unit_context}_{int(datetime.now().timestamp())}_{idx}_{i}.png"
                url = upload_image_to_supabase(img_data, fname)
                if url: img_urls.append(url)
        
        # 2. AI 分析
        ai_res = ai_analyze_question(q['full_question'], q['analysis'], all_kp_names, unit_context, q['chapter_hint'])
        
        # 3. 写入数据库
        try:
            res = supabase.table("questions").insert({
                "full_question": q['full_question'],
                "correct_answer": q['correct_answer'],
                "analysis": q['analysis'],
                "error_analysis": ai_res.get('error_analysis', ''),
                "difficulty": str(ai_res.get('difficulty', 0.5)),
                "image_urls": img_urls
            }).execute()
            
            if res.data:
                q_id = res.data[0]['id']
                
                # 4. 关联知识点
                link_data = []
                for kp_name in ai_res.get('knowledge_points', []):
                    # 精确 + 模糊匹配
                    if kp_name in kp_map:
                        link_data.append({"question_id": q_id, "knowledge_point_id": kp_map[kp_name]})
                    else:
                        matches = get_close_matches(kp_name, all_kp_names, n=1, cutoff=0.6)
                        if matches:
                            link_data.append({"question_id": q_id, "knowledge_point_id": kp_map[matches[0]]})
                
                if link_data:
                    supabase.table("question_knowledge_point_link").insert(link_data).execute()
                    print("🔗", end="")
                else:
                    print("⚪", end="") # 没关联到
                print(" OK")
                
        except Exception as e:
            print(f"❌ {e}")

# ================= 🚀 主程序入口 =================

if __name__ == "__main__":
    # 1. 危险操作：清空旧数据
    clear_database()
    
    # 2. 获取知识点
    kp_map, all_kp_names = fetch_latest_knowledge_map()
    
    if not kp_map:
        print("❌ 无法获取知识点，程序退出")
        exit()

    # 3. 扫描文件夹并循环处理
    print(f"\n📂 扫描目录: {TARGET_FOLDER}")
    
    # 获取所有 .docx 文件
    docx_files = [f for f in os.listdir(TARGET_FOLDER) if f.endswith('.docx') and not f.startswith('~$')]
    docx_files.sort() # 按文件名排序，保证顺序
    
    print(f"🧐 发现 {len(docx_files)} 个题库文件。")
    
    for filename in docx_files:
        full_path = os.path.join(TARGET_FOLDER, filename)
        try:
            process_one_file(full_path, kp_map, all_kp_names)
        except Exception as e:
            print(f"❌ 处理文件 {filename} 时发生严重错误: {e}")
            continue # 跳过报错的文件，继续下一个

    print("\n🎉🎉🎉 所有任务执行完毕！你的题库已重建！ 🎉🎉🎉")