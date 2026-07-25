import { CoachingStaffService } from '../../src/coaching-staff/coaching-staff.service';
import { CoachingStaffRepository } from '../../src/coaching-staff/coaching-staff.repo';

const mockFindAll = jest.fn();
jest.mock('../../src/coaching-staff/coaching-staff.repo', () => ({
  CoachingStaffRepository: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
  })),
}));

const repo = new CoachingStaffRepository({} as never);
const service = new CoachingStaffService(repo);

const weekStart = new Date('2026-07-21T00:00:00.000Z');
const weekEnd   = new Date('2026-07-27T23:59:59.999Z');

describe('CoachingStaffService.getAll', () => {
  it('weekStart/weekEnd를 그대로 repo.findAll에 전달한다', async () => {
    mockFindAll.mockResolvedValue([]);
    await service.getAll(weekStart, weekEnd);
    expect(mockFindAll).toHaveBeenCalledWith(weekStart, weekEnd);
  });

  it('repo가 반환한 배열을 그대로 반환한다', async () => {
    const stub = [{ id: 1, nickname: '홍감독', coachingRole: 'HEAD_COACH', teamId: 1, coachAvailabilities: [] }];
    mockFindAll.mockResolvedValue(stub);
    const result = await service.getAll(weekStart, weekEnd);
    expect(result).toBe(stub);
  });
});
