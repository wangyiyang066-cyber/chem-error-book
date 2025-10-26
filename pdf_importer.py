import os
import io
import re
import pdfplumber
import pandas as pd
from aip import AipOcr
import time

# --- 1. 配置您的百度AI密钥 ---
APP_ID = "这个不是必须的，可以留空"
API_KEY = "2PwM4fwgKxy54GOq8SYeo1gg"
SECRET_KEY = "tFe8RN5AdL9ZEgrObeBT3xBvTzK0qhFC"
# ---------------------------------

# --- 2. 其他配置 ---
QUESTION_PDF_PATH = '2026《初中必刷题•化学》9上.pdf'
START_PAGE = 7
END_PAGE = 119
IMAGE_RESOLUTION = 200 # 定义图片分辨率
IMAGE_OUTPUT_DIR = "question_images"
EXCEL_OUTPUT_PATH = f'output_hybrid_pages.xlsx'

# --- 3. 核心功能：文本解析与边界框计算函数 ---
def parse_column_to_questions(column_items, page_num, scale_factor):
    questions = []
    current_knowledge_point = "未知"
    current_question_lines = []

    kp_pattern = re.compile(r"知识点\d+\s*(.*)")
    question_start_pattern = re.compile(r"^\d+\s*(\[.+?\])?")

    def save_current_question():
        if not current_question_lines:
            return

        full_text = "\n".join([item['words'] for item in current_question_lines])
        
        # --- 核心改动：在计算边界框后，进行坐标转换 ---
        # 1. 先用像素坐标计算边界
        min_x0_px = min(item['location']['left'] for item in current_question_lines)
        min_y0_px = min(item['location']['top'] for item in current_question_lines)
        max_x1_px = max(item['location']['left'] + item['location']['width'] for item in current_question_lines)
        max_y1_px = max(item['location']['top'] + item['location']['height'] for item in current_question_lines)
        
        # 2. 将像素坐标转换回PDF的点坐标
        min_x0_pt = min_x0_px / scale_factor
        min_y0_pt = min_y0_px / scale_factor
        max_x1_pt = max_x1_px / scale_factor
        max_y1_pt = max_y1_px / scale_factor

        padding = 5 
        bbox = (min_x0_pt - padding, min_y0_pt - padding, max_x1_pt + padding, max_y1_pt + padding)

        questions.append({
            "Page": page_num,
            "Knowledge_Point": current_knowledge_point,
            "Question_Text": full_text.strip(),
            "Bounding_Box": bbox
        })

    column_items.sort(key=lambda item: item[0])

    for y_coord, item in column_items:
        line = item['words'].strip()
        if not line:
            continue

        kp_match = kp_pattern.match(line)
        if kp_match:
            save_current_question()
            current_question_lines = []
            current_knowledge_point = kp_match.group(1).strip()
            continue

        if question_start_pattern.match(line):
            save_current_question()
            current_question_lines = [item]
        else:
            if current_question_lines:
                 current_question_lines.append(item)

    save_current_question()
    
    return questions

# --- 4. 程序主体 ---
try:
    client = AipOcr(APP_ID, API_KEY, SECRET_KEY)
    client.setConnectionTimeoutInMillis(180000)
    client.setSocketTimeoutInMillis(180000)
    print("百度AI客户端初始化成功！")

    os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)
    print(f"截图将保存到 '{IMAGE_OUTPUT_DIR}' 文件夹中。")

    all_questions_from_book = []

    for page_num in range(START_PAGE, END_PAGE + 1):
        print(f"\n{'='*20} 正在处理第 {page_num} 页 {'='*20}")
        with pdfplumber.open(QUESTION_PDF_PATH) as pdf:
            if page_num > len(pdf.pages):
                break
            
            page = pdf.pages[page_num - 1]
            img = page.to_image(resolution=IMAGE_RESOLUTION).original
            
            # --- 核心改动：计算缩放比例 ---
            scale = img.width / page.width

            image_bytes_stream = io.BytesIO()
            img.save(image_bytes_stream, format='PNG')
            image_bytes = image_bytes_stream.getvalue()

            print(f"正在为第 {page_num} 页调用百度云API...")
            response = client.accurate(image_bytes)
            
            if "error_code" in response:
                print(f"❌ 第 {page_num} 页API返回错误: {response['error_msg']}")
                continue 
            
            print(f"第 {page_num} 页识别成功！正在进行分栏和解析...")
            
            left_column_items, right_column_items = [], []
            center_x_px = img.width / 2 # 分栏时也使用像素坐标
            if "words_result" in response:
                for item in response["words_result"]:
                    if item['location']['left'] < center_x_px:
                        left_column_items.append((item['location']['top'], item))
                    else:
                        right_column_items.append((item['location']['top'], item))
                
                # --- 核心改动：将缩放比例传入解析函数 ---
                page_questions = parse_column_to_questions(left_column_items, page_num, scale) + \
                                 parse_column_to_questions(right_column_items, page_num, scale)
                
                print(f"第 {page_num} 页解析完成！共找到 {len(page_questions)} 道题目。")

                print("正在为本页题目进行截图...")
                for i, q_data in enumerate(page_questions):
                    bbox = q_data['Bounding_Box']
                    question_crop = page.crop(bbox)
                    question_img = question_crop.to_image(resolution=300)
                    image_path = os.path.join(IMAGE_OUTPUT_DIR, f"page_{page_num}_q_{i+1}.png")
                    question_img.save(image_path)
                    q_data['Image_Path'] = image_path
                
                all_questions_from_book.extend(page_questions)
        
        time.sleep(0.5)

    if all_questions_from_book:
        print(f"\n✅ 批量处理完成！")
        df = pd.DataFrame(all_questions_from_book)
        df_to_save = df.drop(columns=['Bounding_Box'])
        df_to_save.to_excel(EXCEL_OUTPUT_PATH, index=False)
        print(f"✅ 成功！所有解析出的题目及截图路径已保存到文件: {EXCEL_OUTPUT_PATH}")
    else:
        print("\n警告：在指定页面范围内未能解析出任何题目。")

except Exception as e:
    print(f"❌ 发生未知错误: {e}")