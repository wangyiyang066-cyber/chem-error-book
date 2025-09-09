# excel_to_js.py (V5版：智能格式化化学式与文本)

import pandas as pd
import os
import json
import re

# --- 配置 ---
EXCEL_FILE_PATH = '/Users/yiyangwang/Desktop/learning_others/some_projects/some_projects_learning/2025小创(立项省级）/知识-题目对应.xlsx'
SHEET1_NAME = 0
SHEET2_NAME = 1
OUTPUT_JS_PATH = os.path.join('js', 'data.js')


# ==============================================================================
# --- 新增的智能格式化模块 ---
# ==============================================================================

def format_chemical_text(text):
    """美化包含化学式的文本"""
    if not isinstance(text, str):
        return text

    # 1. 替换常用化学符号
    text = text.replace("==", "⇌").replace("->", "→")
    
    # 2. 使用正则表达式为化学式添加下标
    # 这个模式会查找紧跟在字母或右括号')'后面的数字，并给它们加上 <sub> 标签
    # 例如: H2O -> H<sub>2</sub>O, Ca(OH)2 -> Ca(OH)<sub>2</sub>
    text = re.sub(r'([A-Za-z\)])(\d+)', r'\1<sub>\2</sub>', text)
    
    return text

def format_line_breaks(text):
    """为文本智能添加换行符"""
    if not isinstance(text, str):
        return text
        
    # 在中文句号、问号、感叹号后添加 <br>
    text = re.sub(r'([。？！])', r'\1<br>', text)
    
    # 为了防止段首有空格，我们再处理一下
    text = text.replace('<br> ', '<br>')
    return text

# ==============================================================================

def convert_excel_to_js():
    # ... (读取 Excel 的部分和之前一样，这里省略以保持简洁) ...
    # 为了确保代码完整，请从下方完整复制代码块

    try:
        print(f"正在读取 Excel 文件: {EXCEL_FILE_PATH}...")
        df_summary = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET1_NAME, header=0).rename(columns={
            '知识点编号': 'id', '知识点摘要': 'keyPoint', '题目摘要': 'questionTitle'
        })[['id', 'keyPoint', 'questionTitle']]
        df_detail = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET2_NAME, header=0).rename(columns={
            '知识点编号': 'id', '知识点': 'detailedKeyPoint', '题目': 'fullQuestion'
        })[['id', 'detailedKeyPoint', 'fullQuestion']]
        print("文件读取成功！")
    except Exception as e:
        print(f"读取 Excel 文件时发生错误: {e}")
        return

    df_summary['id'] = df_summary['id'].astype(str).str.zfill(3)
    df_detail['id'] = df_detail['id'].astype(str).str.zfill(3)
    df_detail['fullQuestion'] = df_detail['fullQuestion'].astype(str)
    df_detail['detailedKeyPoint'] = df_detail['detailedKeyPoint'].astype(str)

    df_merged = pd.merge(df_summary, df_detail, on='id', how='left')
    df_merged.fillna({'fullQuestion': '', 'keyPoint': '', 'detailedKeyPoint': ''}, inplace=True)

    answer_pattern = re.compile(r'\s*(?:a\s*n\s*s|答\s*案)\s*[:：]\s*', re.IGNORECASE)

    js_objects = []
    print("正在对文本进行智能格式化处理...")
    for index, row in df_merged.iterrows():
        full_question_text = row['fullQuestion']
        parts = answer_pattern.split(full_question_text, 1)
        if len(parts) > 1:
            question_part = parts[0].strip()
            answer_part = parts[1].strip()
        else:
            question_part = full_question_text.strip()
            answer_part = "（待补充正确答案）"

        # --- 对所有文本字段应用我们的格式化函数 ---
        js_obj = {
            "id": row['id'],
            "keyPoint": format_line_breaks(format_chemical_text(row['keyPoint'])),
            "detailedKeyPoint": format_line_breaks(format_chemical_text(row['detailedKeyPoint'])),
            "questionTitle": format_line_breaks(format_chemical_text(row['questionTitle'])),
            "fullQuestion": format_line_breaks(format_chemical_text(question_part)),
            "userAnswer": "（待补充你的答案）",
            "correctAnswer": format_line_breaks(format_chemical_text(answer_part)),
            "analysis": "（待补充题目解析）"
        }
        js_objects.append(js_obj)

    js_content = "const errorData = " + json.dumps(js_objects, ensure_ascii=False, indent=2) + ";"

    try:
        os.makedirs(os.path.dirname(OUTPUT_JS_PATH), exist_ok=True)
        with open(OUTPUT_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        print("-" * 30)
        print(f"🎉 成功！格式化后的数据已写入 {OUTPUT_JS_PATH}")
        print("下一步：请务必更新你的 JavaScript 文件！")
        print("-" * 30)
    except Exception as e:
        print(f"写入文件时发生错误: {e}")

if __name__ == "__main__":
    convert_excel_to_js()