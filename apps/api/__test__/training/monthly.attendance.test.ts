import { calcMonthlyAttendanceRate } from '../../src/jobs/monthlyAttendanceCheck';

describe('calcMonthlyAttendanceRate', () => {
  it('출석 + 공결 / 전체', () => {
    expect(calcMonthlyAttendanceRate(8, 1, 10)).toBeCloseTo(0.9);
  });

  it('전체 세션 0이면 null 반환', () => {
    expect(calcMonthlyAttendanceRate(0, 0, 0)).toBeNull();
  });

  it('80% 미만 케이스', () => {
    expect(calcMonthlyAttendanceRate(6, 0, 10)).toBeCloseTo(0.6);
  });
});
