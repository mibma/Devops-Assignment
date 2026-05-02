import os
import boto3
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from db import get_connection
from gemini_client import ask_gemini
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

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

# --------------------------------------------------
# S3 client setup
# --------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")

if S3_BUCKET:
    s3_client = boto3.client("s3", region_name=AWS_REGION)
else:
    s3_client = None
    print("[S3] WARNING: S3_BUCKET_NAME not set. S3 upload/download endpoints will not work.")


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# ==================================================
# Existing endpoints (unchanged)
# ==================================================

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

# ==================================================
# NEW S3 endpoints – Upload prompt file & fetch results
# ==================================================

@app.post("/upload-prompt")
async def upload_prompt(file: UploadFile = File(...)):
    """
    Upload a .txt file to the S3 bucket's prompts/ folder.
    This triggers the Lambda function which processes the prompt
    and stores the result in the results/ folder.
    """
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 is not configured on the server.")

    if not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are allowed.")

    file_content = await file.read()
    s3_key = f"prompts/{file.filename}"

    try:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_content,
            ContentType="text/plain",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {str(e)}")

    return {
        "message": "File uploaded successfully",
        "bucket": S3_BUCKET,
        "key": s3_key,
        "filename": file.filename,
    }


@app.get("/results")
def list_results():
    """
    List all result files in the S3 bucket's results/ folder.
    Returns filename, key, size, and last-modified date for each file.
    """
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 is not configured on the server.")

    try:
        response = s3_client.list_objects_v2(
            Bucket=S3_BUCKET,
            Prefix="results/",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list S3 objects: {str(e)}")

    files = []
    for obj in response.get("Contents", []):
        key = obj["Key"]
        # Skip the folder marker itself
        if key == "results/":
            continue
        filename = key.split("/")[-1]
        files.append({
            "filename": filename,
            "key": key,
            "size": obj["Size"],
            "last_modified": obj["LastModified"].isoformat(),
        })

    # Sort by last modified (newest first)
    files.sort(key=lambda x: x["last_modified"], reverse=True)
    return files


@app.get("/results/download/{filename}")
def download_result(filename: str):
    """
    Download a specific result file from the S3 bucket's results/ folder.
    Returns the file content as a downloadable .txt attachment.
    """
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 is not configured on the server.")

    s3_key = f"results/{filename}"

    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
    except s3_client.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="Result file not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download from S3: {str(e)}")

    return StreamingResponse(
        response["Body"],
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )

# ==================================================
# Serve the frontend (must be LAST – catches all other routes)
# ==================================================
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="../health-frontend", html=True), name="frontend")