export const ko = {
  player: {
    created: (name: string) => ({ title: '선수 등록', body: `${name} 선수가 등록되었습니다.` }),
    updated: (name: string) => ({ title: '선수 정보 수정', body: `${name} 선수 정보가 수정되었습니다.` }),
    positionChanged: (name: string, pos: string) => ({ title: '포지션 변경', body: `${name} 선수의 포지션이 ${pos}(으)로 변경되었습니다.` }),
    statusChanged: (name: string, status: string) => ({ title: '선수 상태 변경', body: `${name} 선수 상태가 ${status}(으)로 변경되었습니다.` }),
    offboardingStarted: (name: string) => ({ title: '오프보딩 시작', body: `${name} 선수의 오프보딩 절차가 시작되었습니다.` }),
  },
  coach: {
    created: (name: string) => ({ title: '코치 등록', body: `${name} 코치가 등록되었습니다.` }),
    updated: (name: string) => ({ title: '코치 정보 수정', body: `${name} 코치 정보가 수정되었습니다.` }),
    roleChanged: (name: string, role: string) => ({ title: '역할 변경', body: `${name} 코치의 역할이 ${role}(으)로 변경되었습니다.` }),
  },
  attendance: {
    absent: (date: string) => ({ title: '결석 처리', body: `${date} 훈련에 결석으로 처리되었습니다.` }),
    late: (date: string) => ({ title: '지각 처리', body: `${date} 훈련에 지각으로 처리되었습니다.` }),
    penaltyIssued: (reason: string) => ({ title: '페널티 부과', body: `${reason} 사유로 페널티가 부과되었습니다.` }),
    penaltyResolved: () => ({ title: '페널티 해제', body: '페널티가 해제되었습니다.' }),
  },
  jersey: {
    assigned: (number: number) => ({ title: '등번호 배정', body: `등번호 ${number}번이 배정되었습니다.` }),
    changed: (prev: number, next: number) => ({ title: '등번호 변경', body: `등번호가 ${prev}번에서 ${next}번으로 변경되었습니다.` }),
    unassigned: () => ({ title: '등번호 회수', body: '등번호가 회수되었습니다.' }),
  },
  match: {
    scheduled: (opponent: string, date: string) => ({ title: '경기 일정', body: `${date} ${opponent}와의 경기가 등록되었습니다.` }),
    resultEntered: (opponent: string, score: string) => ({ title: '경기 결과', body: `${opponent}전 결과: ${score}` }),
    cancelled: (opponent: string, date: string) => ({ title: '경기 취소', body: `${date} ${opponent}와의 경기가 취소되었습니다.` }),
    statsUpdated: (opponent: string) => ({ title: '경기 통계 입력', body: `${opponent}전 통계가 입력되었습니다.` }),
    statSheetScanned: (opponent: string) => ({ title: '스탯 시트 분석 완료', body: `${opponent}전 경기 기록지 분석이 완료되었습니다.` }),
  },
  injury: {
    reported: (name: string, type: string) => ({ title: '부상 보고', body: `${name} 선수 ${type} 부상이 보고되었습니다.` }),
    recovered: (name: string) => ({ title: '부상 회복', body: `${name} 선수가 부상에서 회복되었습니다.` }),
    statusChanged: (name: string, status: string) => ({ title: '부상 상태 변경', body: `${name} 선수 부상 상태: ${status}` }),
    treatmentAdded: (name: string) => ({ title: '치료 기록 추가', body: `${name} 선수 치료 기록이 추가되었습니다.` }),
  },
  callup: {
    issued: (name: string, team: string) => ({ title: '국가대표 소집', body: `${name} 선수가 ${team} 국가대표로 소집되었습니다.` }),
    returned: (name: string) => ({ title: '국가대표 소집 해제', body: `${name} 선수가 복귀했습니다.` }),
    extended: (name: string) => ({ title: '소집 기간 연장', body: `${name} 선수의 소집 기간이 연장되었습니다.` }),
  },
  video: {
    uploaded: (title: string) => ({ title: '영상 업로드', body: `"${title}" 영상이 업로드되었습니다.` }),
    aiSummaryGenerated: (title: string) => ({ title: 'AI 요약 생성', body: `"${title}" 영상 AI 요약이 생성되었습니다.` }),
    deleted: (title: string) => ({ title: '영상 삭제', body: `"${title}" 영상이 삭제되었습니다.` }),
  },
  youth: {
    playerPromoted: (name: string) => ({ title: '유소년 선수 승격', body: `${name} 선수가 1군으로 승격되었습니다.` }),
    evaluationAdded: (name: string) => ({ title: '평가 등록', body: `${name} 선수 평가가 등록되었습니다.` }),
    programStarted: (name: string) => ({ title: '프로그램 시작', body: `${name} 프로그램이 시작되었습니다.` }),
    programEnded: (name: string) => ({ title: '프로그램 종료', body: `${name} 프로그램이 종료되었습니다.` }),
    loanStarted: (name: string, club: string) => ({ title: '임대 출발', body: `${name} 선수가 ${club}으로 임대되었습니다.` }),
    loanReturned: (name: string) => ({ title: '임대 복귀', body: `${name} 선수가 임대에서 복귀했습니다.` }),
  },
  medical: {
    expenseSubmitted: (name: string, amount: string) => ({ title: '의료비 청구', body: `${name} 선수 의료비 ${amount}원이 청구되었습니다.` }),
    expenseApproved: (name: string) => ({ title: '의료비 승인', body: `${name} 선수 의료비가 승인되었습니다.` }),
    expenseRejected: (name: string, reason: string) => ({ title: '의료비 반려', body: `${name} 선수 의료비가 반려되었습니다: ${reason}` }),
  },
  equipment: {
    requestSubmitted: (item: string) => ({ title: '용품 신청', body: `${item} 신청이 접수되었습니다.` }),
    requestApproved: (item: string) => ({ title: '용품 신청 승인', body: `${item} 신청이 승인되었습니다.` }),
    requestRejected: (item: string, reason: string) => ({ title: '용품 신청 반려', body: `${item} 신청이 반려되었습니다: ${reason}` }),
    issued: (item: string) => ({ title: '용품 지급', body: `${item}이(가) 지급되었습니다.` }),
    returned: (item: string) => ({ title: '용품 반납', body: `${item}이(가) 반납되었습니다.` }),
  },
  report: {
    submitted: (type: string) => ({ title: '보고서 제출', body: `${type} 보고서가 제출되었습니다.` }),
    approved: (type: string) => ({ title: '보고서 승인', body: `${type} 보고서가 승인되었습니다.` }),
    rejected: (type: string, reason: string) => ({ title: '보고서 반려', body: `${type} 보고서가 반려되었습니다: ${reason}` }),
    revisionRequested: (type: string) => ({ title: '보고서 수정 요청', body: `${type} 보고서 수정이 요청되었습니다.` }),
  },
  development: {
    goalSet: (name: string, goal: string) => ({ title: '성장 목표 설정', body: `${name} 선수의 성장 목표가 설정되었습니다: ${goal}` }),
    milestoneReached: (name: string, milestone: string) => ({ title: '마일스톤 달성', body: `${name} 선수가 마일스톤을 달성했습니다: ${milestone}` }),
    evaluationAdded: (name: string) => ({ title: '성장 평가 등록', body: `${name} 선수 성장 평가가 등록되었습니다.` }),
  },
  incident: {
    reported: (name: string, type: string) => ({ title: '사고 보고', body: `${name} 관련 ${type} 사고가 보고되었습니다.` }),
    resolved: (name: string) => ({ title: '사고 처리 완료', body: `${name} 관련 사고가 처리되었습니다.` }),
  },
  safeguard: {
    caseOpened: (name: string) => ({ title: '세이프가드 케이스 개설', body: `${name} 관련 케이스가 개설되었습니다.` }),
    caseClosed: (name: string) => ({ title: '세이프가드 케이스 종료', body: `${name} 관련 케이스가 종료되었습니다.` }),
    reviewScheduled: (name: string, date: string) => ({ title: '검토 일정', body: `${name} 케이스 검토가 ${date}에 예정되었습니다.` }),
  },
  tactical: {
    referenceAdded: (title: string) => ({ title: '전술 레퍼런스 등록', body: `"${title}" 전술 레퍼런스가 등록되었습니다.` }),
    referenceDeleted: (title: string) => ({ title: '전술 레퍼런스 삭제', body: `"${title}" 전술 레퍼런스가 삭제되었습니다.` }),
  },
  training: {
    sessionCreated: (date: string, type: string) => ({ title: '훈련 세션 등록', body: `${date} ${type} 훈련 세션이 등록되었습니다.` }),
    sessionCancelled: (date: string) => ({ title: '훈련 세션 취소', body: `${date} 훈련 세션이 취소되었습니다.` }),
    attendanceRecorded: (date: string) => ({ title: '출석 기록', body: `${date} 훈련 출석이 기록되었습니다.` }),
  },
  loan: {
    started: (name: string, club: string, endDate: string) => ({ title: '임대 시작', body: `${name} 선수가 ${club}에 ${endDate}까지 임대되었습니다.` }),
    ended: (name: string, club: string) => ({ title: '임대 종료', body: `${name} 선수의 ${club} 임대가 종료되었습니다.` }),
    extended: (name: string, newEndDate: string) => ({ title: '임대 연장', body: `${name} 선수 임대가 ${newEndDate}까지 연장되었습니다.` }),
    recalled: (name: string) => ({ title: '임대 소환', body: `${name} 선수가 임대에서 소환되었습니다.` }),
  },
  workPermit: {
    submitted: (name: string) => ({ title: '취업비자 신청', body: `${name} 선수 취업비자 신청이 접수되었습니다.` }),
    approved: (name: string) => ({ title: '취업비자 승인', body: `${name} 선수 취업비자가 승인되었습니다.` }),
    rejected: (name: string, reason: string) => ({ title: '취업비자 거절', body: `${name} 선수 취업비자가 거절되었습니다: ${reason}` }),
    expiringSoon: (name: string, days: number) => ({ title: '취업비자 만료 임박', body: `${name} 선수 취업비자가 ${days}일 후 만료됩니다.` }),
    expired: (name: string) => ({ title: '취업비자 만료', body: `${name} 선수 취업비자가 만료되었습니다.` }),
  },
  contract: {
    created: (name: string, endDate: string) => ({ title: '계약 체결', body: `${name} 선수 계약이 ${endDate}까지 체결되었습니다.` }),
    renewed: (name: string, newEndDate: string) => ({ title: '계약 갱신', body: `${name} 선수 계약이 ${newEndDate}까지 갱신되었습니다.` }),
    terminated: (name: string) => ({ title: '계약 해지', body: `${name} 선수 계약이 해지되었습니다.` }),
    expiringSoon: (name: string, days: number) => ({ title: '계약 만료 임박', body: `${name} 선수 계약이 ${days}일 후 만료됩니다.` }),
    expired: (name: string) => ({ title: '계약 만료', body: `${name} 선수 계약이 만료되었습니다.` }),
    salaryChanged: (name: string) => ({ title: '급여 변경', body: `${name} 선수 급여가 변경되었습니다.` }),
  },
  matchDay: {
    lineupConfirmed: (opponent: string) => ({ title: '라인업 확정', body: `${opponent}전 라인업이 확정되었습니다.` }),
    lineupSelected: (opponent: string) => ({ title: '라인업 선발', body: `${opponent}전 선발 명단에 포함되었습니다.` }),
    lineupNotSelected: (opponent: string) => ({ title: '라인업 미선발', body: `${opponent}전 선발 명단에서 제외되었습니다.` }),
    substituteReady: (opponent: string) => ({ title: '교체 대기', body: `${opponent}전 교체 대기 명단에 등록되었습니다.` }),
  },
};

export type Messages = typeof ko;
