from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db import get_connection
from gemini_client import ask_gemini
from pydantic import BaseModel

class PromptRequest(BaseModel):
    prompt: str

# --------------------------------------------------
# Demo data helpers – used when the MySQL server is unavailable
# --------------------------------------------------

def demo_prompts():
    """Return a static list of symptom IDs and names for demo purposes."""
    return [
        {"id": 1, "symptom_name": "Headache"},
        {"id": 2, "symptom_name": "Fever"},
    ]

def demo_prompt_detail(prompt_id: int):
    """Return a static prompt_text for a given id, or None if not found."""
    mapping = {
        1: {"prompt_text": "I have a throbbing headache for two days."},
        2: {"prompt_text": "My temperature is 38.5°C with chills."},
    }
    return mapping.get(prompt_id)


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
    """Return all symptom entries. If the DB cannot be reached, fall back to demo data."""
    conn = get_connection()
    if not conn:
        # No DB – return static demo list
        return demo_prompts()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, symptom_name FROM health_prompts")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@app.post("/ask")
def ask_ai(request: PromptRequest):
    final_prompt =f"""
    You are a medical assistant AI. 
    Return a short, clear, helpful answer including one paragraph descriptionalong with possible diseases of the symptom and cure.
    Avoid unnecessary details. Use simple language suitable for normal patients.
    Topic: {request.prompt}
    """

    llm_response = ask_gemini(final_prompt)

    return {
        "prompt": request.prompt,
        "output": llm_response
    }

@app.get("/get/{prompt_id}")
def run_prompt(prompt_id: int):
    """Return the AI response for a specific prompt ID.
    If the DB is unavailable, uses static demo data.
    """
    conn = get_connection()
    if not conn:
        row = demo_prompt_detail(prompt_id)
        if not row:
            raise HTTPException(status_code=404, detail="Prompt ID not found.")
    else:
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