from supabase import create_client, Client

# 使用你已有的配置
SUPABASE_URL = "https://ghuyiwhqdellucjxqiwj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go"
# 建议用 service_role 权限更高
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def reset_all_shifouzuoguo():
    print("🚀 正在重置所有题目的做题状态...")
    try:
        # 使用 neq("id", -1) 确保覆盖所有行
        response = supabase.table("questions")\
            .update({"shifouzuoguo": False})\
            .neq("id", -1)\
            .execute()
        
        updated_count = len(response.data)
        print(f"✅ 处理完成！已将 {updated_count} 道题目的 'shifouzuoguo' 标记为 False。")
    except Exception as e:
        print(f"❌ 重置过程中发生错误: {e}")

if __name__ == "__main__":
    reset_all_shifouzuoguo()