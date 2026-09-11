import supervision as sv
import numpy as np

def compute_tracking_score(frames: list[np.ndarray], detections: list[dict]) -> float:
    """
    ByteTrack으로 선수 추적 일관성 점수 계산 (0~1).
    - 트랙이 유지될수록 높은 점수
    - 트랙이 중간에 끊기면 낮은 점수
    """
    tracker = sv.ByteTrack()
    track_lifespans: dict[int, int] = {}  # track_id -> 등장 프레임 수
    total_frames = len(detections)

    for det in detections:
        boxes = det['boxes']
        confs = det['confidences']
        if not boxes:
            continue

        sv_det = sv.Detections(
            xyxy=np.array(boxes, dtype=np.float32),
            confidence=np.array(confs, dtype=np.float32),
            class_id=np.zeros(len(boxes), dtype=int),
        )
        tracked = tracker.update_with_detections(sv_det)

        for tid in tracked.tracker_id:
            track_lifespans[tid] = track_lifespans.get(tid, 0) + 1

    if not track_lifespans or total_frames == 0:
        return 0.0

    # 전체 프레임의 30% 이상 살아남은 트랙 비율 → 추적 일관성
    stable_threshold = total_frames * 0.3
    stable = sum(1 for v in track_lifespans.values() if v >= stable_threshold)
    total = len(track_lifespans)

    return round(stable / total, 3) if total > 0 else 0.0
