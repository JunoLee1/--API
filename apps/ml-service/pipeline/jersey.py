import easyocr
import numpy as np
import re
from collections import defaultdict

_reader = None

def get_reader():
    global _reader
    if _reader is None:
        # 영어 숫자 인식만 (등번호 1~99)
        _reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    return _reader

def crop_player(frame: np.ndarray, box: list[float]) -> np.ndarray:
    x1, y1, x2, y2 = map(int, box)
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = frame[y1:y2, x1:x2]
    # 등번호는 보통 상체 중앙 → 세로 중간~하단 1/3 구간
    ch = crop.shape[0]
    return crop[ch // 3: ch * 2 // 3, :]

def recognize_jersey_numbers(
    frames: list[np.ndarray],
    detections: list[dict],
    sample_every: int = 3,
) -> list[dict]:
    """
    감지된 선수 박스에서 등번호 OCR.
    가중 투표로 최종 번호 목록 반환.
    반환: [{ "number": int, "confidence": float }] (신뢰도 내림차순)
    """
    reader = get_reader()
    votes: dict[int, float] = defaultdict(float)

    for i, (frame, det) in enumerate(zip(frames, detections)):
        if i % sample_every != 0:
            continue
        for box, conf in zip(det['boxes'], det['confidences']):
            if conf < 0.5:
                continue
            crop = crop_player(frame, box)
            if crop.size == 0:
                continue
            try:
                ocr_results = reader.readtext(crop, allowlist='0123456789')
            except Exception:
                continue
            for _, text, ocr_conf in ocr_results:
                text = re.sub(r'\D', '', text)
                if not text:
                    continue
                num = int(text)
                if 1 <= num <= 99:
                    votes[num] += conf * ocr_conf

    if not votes:
        return []

    total = sum(votes.values())
    results = [
        {"number": k, "confidence": round(v / total, 3)}
        for k, v in sorted(votes.items(), key=lambda x: -x[1])
    ]
    return results[:5]  # 상위 5개만
