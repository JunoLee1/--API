import os
import httpx
import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from pipeline import analyze_video

app = FastAPI(title='Football Video Analysis ML Service')

WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', '')


class AnalyzeRequest(BaseModel):
    jobId: int
    videoUrl: str
    callbackUrl: str
    prospectId: int | None = None
    webhookSecret: str | None = None


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/analyze', status_code=202)
async def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_analysis, req)
    return {'jobId': req.jobId, 'status': 'queued'}


async def _run_analysis(req: AnalyzeRequest):
    print(f'[분석 시작] jobId={req.jobId} url={req.videoUrl}', flush=True)
    try:
        data = await analyze_video(req.videoUrl)
        print(f'[분석 완료] jobId={req.jobId} result={data}', flush=True)
        payload = {'jobId': req.jobId, 'status': 'DONE', 'data': data}
    except Exception as e:
        import traceback
        print(f'[분석 실패] jobId={req.jobId} error={e}', flush=True)
        traceback.print_exc()
        payload = {'jobId': req.jobId, 'status': 'FAILED', 'errorMessage': str(e)}

    headers = {}
    if WEBHOOK_SECRET:
        headers['x-webhook-secret'] = WEBHOOK_SECRET

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(req.callbackUrl, json=payload, headers=headers)
    except Exception as e:
        print(f'[webhook] 콜백 실패 jobId={req.jobId}: {e}')
