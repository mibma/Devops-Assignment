from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db import get_connection
from gemini_client import ask_gemini

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

@app.get("/get-all")
def get_all_prompts():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, symptom_name FROM health_prompts")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@app.get("/get/{prompt_id}")
def run_prompt(prompt_id: int):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT prompt_text FROM health_prompts WHERE id = %s", (prompt_id,))
    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Prompt ID not found.")

    # Prepare controlled short medical-friendly prompt
    final_prompt = f"""
    You are a medical assistant AI. 
    Return a short, clear, helpful answer including one paragraph descriptionalong with possible diseases of the symptom and cure.
    Avoid unnecessary details. Use simple language suitable for normal patients.
    Topic: {row['prompt_text']}
    """

    llm_response = ask_gemini(final_prompt)

    return {
        "prompt_id": prompt_id,
        "prompt": row["prompt_text"],
        "output": llm_response
    }