from ultralytics import YOLO
import numpy as np

_model = None

def get_model():
    global _model
    if _model is None:
        # yolov8n: 가장 빠른 nano 모델 (첫 실행 시 자동 다운로드 ~6MB)
        _model = YOLO('yolov8n.pt')
    return _model

def detect_players(frames: list[np.ndarray]) -> list[dict]:
    """
    각 프레임에서 선수(person) 감지.
    반환: [{ 'frame_idx': int, 'boxes': [[x1,y1,x2,y2], ...], 'confidences': [float, ...] }]
    """
    model = get_model()
    results = []

    for idx, frame in enumerate(frames):
        preds = model(frame, classes=[0], verbose=False)[0]  # class 0 = person
        boxes = preds.boxes
        if boxes is None or len(boxes) == 0:
            results.append({'frame_idx': idx, 'boxes': [], 'confidences': []})
            continue

        xyxy = boxes.xyxy.cpu().numpy().tolist()
        confs = boxes.conf.cpu().numpy().tolist()
        results.append({'frame_idx': idx, 'boxes': xyxy, 'confidences': confs})

    return results
