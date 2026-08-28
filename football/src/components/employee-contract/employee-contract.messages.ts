/**
 * Central Korean error-code → user copy map for the EmployeeContract
 * dialogs. Codes come straight from `apps/api/src/employee-contract`.
 * Some codes carry inline data separated by `:` (e.g.,
 * `INVALID_STATE_TRANSITION:DRAFT->SIGNED`) — we prefix-match so a data
 * change on the server doesn't force a FE redeploy.
 */
export function messageForContractCode(code: string, fallback: string): string {
  if (code.startsWith('INVALID_STATE_TRANSITION')) {
    return '현재 상태에서 실행할 수 없는 작업입니다. 새로고침 후 다시 시도해주세요.'
  }
  if (code.startsWith('CONTRACT_NOT_SIGNED')) {
    // Encoded shape: CONTRACT_NOT_SIGNED:DRAFT (or :ISSUED).
    const parts = code.split(':')
    const status = parts[1] ?? ''
    if (status === 'DRAFT') {
      return '계약서가 아직 발행되지 않았습니다. 발행 후 서명을 완료해주세요.'
    }
    if (status === 'ISSUED') {
      return '계약서가 아직 서명되지 않았습니다. 서명본을 업로드해주세요.'
    }
    return '계약서 서명이 완료되지 않았습니다.'
  }
  switch (code) {
    case 'CONTRACT_NOT_ISSUED':
      return '발령을 실행하려면 먼저 근로계약서를 발행하고 서명을 완료해야 합니다.'
    case 'CONTRACT_NOT_FOUND':
      return '계약서를 찾을 수 없습니다.'
    case 'DISPATCH_NOT_FOUND':
      return '발령 요청을 찾을 수 없습니다.'
    case 'ALREADY_CANCELLED':
      return '이미 취소된 계약서입니다.'
    case 'CANCEL_REASON_REQUIRED':
      return '취소 사유는 필수입니다.'
    case 'CANCEL_REASON_TOO_LONG':
      return '취소 사유는 2000자를 초과할 수 없습니다.'
    case 'SIGNED_AT_REQUIRED':
      return '서명 날짜를 입력해주세요.'
    case 'INVALID_SIGNED_AT':
      return '서명 날짜 형식이 올바르지 않습니다.'
    case 'FILE_REQUIRED':
      return '파일을 선택해주세요.'
    case 'INVALID_FILE_TYPE':
      return '허용된 파일 형식이 아닙니다 (PDF / JPG / PNG).'
    case 'INVALID_DISPATCH_ID':
    case 'INVALID_ID':
      return '요청이 올바르지 않습니다. 페이지를 새로고침해주세요.'
    case 'FORBIDDEN':
      return '권한이 없습니다.'
    default:
      return fallback
  }
}
