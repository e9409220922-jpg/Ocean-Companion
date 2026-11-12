import os
import streamlit as st
from sqlalchemy import create_engine
import plotly.express as px
import pandas as pd

# 網頁設定 (要在最前面)
st.set_page_config(page_title="Ocean Companion - 數據可視化",
                   page_icon="🌊",
                   layout="wide",
                   initial_sidebar_state="collapsed") # 強制收合

st.title("🌊 伴海 Ocean Companion - 汙染數據可視化")

#-----------------------------------------------------------

# 建立 SQLAlchemy 引擎
# 讀取連線字串 (使用 Streamlit secrets)
db_url = st.secrets["DATABASE_URL"]

# 進行連線
engine = create_engine(db_url)

# 載入資料 (改為撈取海洋汙染資料表)
sql = "SELECT * FROM ocean_data;"
try:
    df = pd.read_sql_query(sql, engine)
except Exception as e:
    st.error(f"資料庫連線或查詢失敗: {e}")
    st.stop()

#-------------------------------------------------------

cols = df.columns.tolist() # 欄位清單
# 移除不需要用於繪圖的 id 欄位
if "id" in cols:
    cols.remove("id")

# 篩選出數值型欄位供 XYZ 軸選擇 (排除文字欄位如 ocean_region, data_type)
num_cols = df.select_dtypes(include=['float64', 'int64']).columns.tolist()
if "id" in num_cols: num_cols.remove("id")

# 控制面板
st.sidebar.header("⚙️ 控制面板")

# 選擇圖表類型
chart_type = st.sidebar.selectbox(
    "選擇圖表類型",
    ["趨勢折線圖 (Line)", "長條圖 (Box/Bar)", "2D 散佈圖", "3D 散佈圖"]
)

st.sidebar.markdown("---")

# 選擇座標軸
st.sidebar.header("設定座標軸")
# 預設 X 軸為年份，Y 軸為微塑膠濃度
x_axis = st.sidebar.selectbox("選擇 X 軸欄位", cols, index=cols.index("record_year") if "record_year" in cols else 0)
y_axis = st.sidebar.selectbox("選擇 Y 軸欄位", num_cols, index=num_cols.index("microplastic_level") if "microplastic_level" in num_cols else 0)

# 3D 散佈圖要多一個 Z 軸 (預設為溫度)
if chart_type == "3D 散佈圖":
    z_axis = st.sidebar.selectbox("選擇 Z 軸欄位", num_cols, index=num_cols.index("avg_temperature") if "avg_temperature" in num_cols else 1)

# 選擇圖形分類
cat_cols = df.select_dtypes(include=['object']).columns.tolist()
cs = st.sidebar.selectbox("選擇圖形分類 (Color)", cat_cols, index=cat_cols.index("ocean_region") if "ocean_region" in cat_cols else 0)

# 主畫面 ------------------------------------------------------------------------------

# 原始資料
with st.expander("📊 檢視原始觀測資料"): # st.expander 預設隱藏
    st.dataframe(df)

st.subheader(f"圖表：{chart_type}")

# 定義自訂的海洋色系
ocean_colors = ["#4fc3f7", "#ff8800", "#01C38D", "#132D46", "#8b8b8b"]

# 生成圖表
if chart_type == "趨勢折線圖 (Line)":
    # 為了畫折線圖，可能需要先依 X 軸排序或聚合
    df_sorted = df.sort_values(by=[x_axis])
    fig = px.line(
        df_sorted, x=x_axis, y=y_axis, 
        color=cs, 
        markers=True,
        line_dash="data_type" if "data_type" in df.columns and cs != "data_type" else None,
        title=f"{x_axis} 趨勢變化 ({y_axis})",
        template="plotly_dark",
        color_discrete_sequence=ocean_colors
    )

elif chart_type == "2D 散佈圖":
    fig = px.scatter(
        df, x=x_axis, y=y_axis, 
        color=cs, 
        symbol="data_type" if "data_type" in df.columns and cs != "data_type" else None,
        title=f"{x_axis} VS {y_axis}",
        template="plotly_dark",
        color_discrete_sequence=ocean_colors
    )

elif chart_type == "3D 散佈圖":
    fig = px.scatter_3d(
        df, x=x_axis, y=y_axis, z=z_axis,
        color=cs,
        size="microplastic_level" if "microplastic_level" in df.columns else None,
        opacity=0.8, # 透明度
        title=f"3D 空間分佈: {x_axis} VS {y_axis} VS {z_axis}",
        template="plotly_dark",
        color_discrete_sequence=ocean_colors
    )

elif chart_type == "長條圖 (Box/Bar)":
    fig = px.box(
        df, x=x_axis, y=y_axis,
        color=cs,
        notched=True, # 增加缺口效果
        title=f"{x_axis} 分組的 {y_axis} 分佈",
        template="plotly_dark",
        color_discrete_sequence=ocean_colors
    )

# 設定 Hover 樣式與整體字體
fig.update_layout(font=dict(size=14))

# 顯示圖表
st.plotly_chart(fig, use_container_width=True) # 自動適應螢幕寬度
