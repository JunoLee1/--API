import { SponsorshipService } from "./sponsorship.service";

const makeRepo = () => ({
  findBySponsorName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  createPayments: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue({
    id: 1,
    sponsorName: "테스트",
    isOverseas: false,
    payments: [],
  }),
});

const makeLedger = () => ({} as any);

describe("SponsorshipService.create — region fields", () => {
  it("국내 스폰서 생성 시 isOverseas:false 와 businessRegNumber 를 repo.create 에 전달한다", async () => {
    const repo = makeRepo();
    const service = new SponsorshipService(repo as any, makeLedger());
    await service.create(
      {
        sponsorName: "테스트",
        type: "TITLE",
        totalFee: 1_000_000,
        contractStart: "2026-01-01",
        contractEnd: "2026-12-31",
        paymentSchedule: "ANNUAL",
        isOverseas: false,
        businessRegNumber: "123-45-67890",
        postalCode: "06236",
        address: "서울 강남구 테헤란로 427",
        addressDetail: "10층",
      },
      1,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverseas: false,
        businessRegNumber: "123-45-67890",
        postalCode: "06236",
        address: "서울 강남구 테헤란로 427",
        addressDetail: "10층",
      }),
    );
  });

  it("해외 스폰서 생성 시 isOverseas:true 와 taxId 를 repo.create 에 전달한다", async () => {
    const repo = makeRepo();
    const service = new SponsorshipService(repo as any, makeLedger());
    await service.create(
      {
        sponsorName: "Overseas Corp",
        type: "KIT",
        totalFee: 500_000,
        contractStart: "2026-01-01",
        contractEnd: "2026-12-31",
        paymentSchedule: "ANNUAL",
        isOverseas: true,
        taxId: "GB123456789",
        overseasAddress: "10 Downing Street, London",
      },
      1,
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverseas: true,
        taxId: "GB123456789",
        overseasAddress: "10 Downing Street, London",
      }),
    );
  });
});
