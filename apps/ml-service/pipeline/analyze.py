import asyncio
import cv2
import httpx
import numpy as np
import os
import re
import tempfile
from pathlib import Path

from .detect import detect_players
from .track import compute_tracking_score
from .jersey import recognize_jersey_numbers

MAX_FRAMES = 200
FRAME_INTERVAL = 30

YOUTUBE_RE = re.compile(r'(youtube\.com|youtu\.be)', re.IGNORECASE)


def _is_youtube(url: str) -> bool:
    return bool(YOUTUBE_RE.search(url))


async def download_video(url: str) -> str:
    """영상 다운로드 → 임시 파일 경로 반환"""
    if _is_youtube(url):
        return await _download_youtube(url)
    return await _download_direct(url)


async def _download_youtube(url: str) -> str:
    """yt-dlp로 YouTube 영상 다운로드 (최대 720p로 제한해 용량 절감)"""
    import yt_dlp
    tmp_dir = tempfile.mkdtemp()
    out_path = os.path.join(tmp_dir, 'video.mp4')

    ydl_opts = {
        'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        'outtmpl': out_path,
        'quiet': True,
        'no_warnings': True,
        # 긴 영상은 앞 10분만 다운로드 (분석에 충분)
        'download_ranges': lambda info, _: [{'start_time': 0, 'end_time': 600}],
        'force_keyframes_at_cuts': False,
    }
    loop = asyncio.get_event_loop()
    def _dl():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    await loop.run_in_executor(None, _dl)

    # yt-dlp가 확장자를 바꿀 수 있으므로 실제 파일 탐색
    for f in os.listdir(tmp_dir):
        if f.startswith('video'):
            return os.path.join(tmp_dir, f)
    raise FileNotFoundError('yt-dlp 다운로드 실패')


async def _download_direct(url: str) -> str:
    """직접 mp4 URL 스트리밍 다운로드"""
    suffix = Path(url.split('?')[0]).suffix or '.mp4'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        async with client.stream('GET', url) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                tmp.write(chunk)
    tmp.close()
    return tmp.name


def sample_frames(video_path: str) -> list[np.ndarray]:
    """영상에서 균등 간격 프레임 샘플링"""
    cap = cv2.VideoCapture(video_path)
    frames = []
    idx = 0
    while len(frames) < MAX_FRAMES:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % FRAME_INTERVAL == 0:
            frames.append(frame)
        idx += 1
    cap.release()
    return frames


async def analyze_video(video_url: str) -> dict:
    video_path = await download_video(video_url)
    try:
        frames = sample_frames(video_path)
        if not frames:
            raise ValueError('영상에서 프레임을 추출할 수 없습니다')

        detections = detect_players(frames)

        # 감지 신뢰도: 전체 프레임 평균 (감지 없는 프레임은 0으로 포함)
        all_confs = [c for d in detections for c in d['confidences']]
        detection_confidence = round(float(np.mean(all_confs)), 3) if all_confs else 0.0

        tracking_score = compute_tracking_score(frames, detections)

        jersey_numbers = recognize_jersey_numbers(frames, detections)

        # 감지된 최대 선수 수 (한 프레임 기준)
        player_count = max((len(d['boxes']) for d in detections), default=0)

        return {
            'detectionConfidence': detection_confidence,
            'trackingScore': tracking_score,
            'detectedJerseyNumbers': jersey_numbers,
            'playerCount': player_count,
        }
    finally:
        os.unlink(video_path)
