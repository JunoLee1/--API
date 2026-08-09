import { AppError } from "../lib/appError";
import { TransferRequestRepository } from "./transfer-request.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { TransferRequestStatus } from "../generated/enums";
import { CreateTransferRequestDto, UpdateTransferRequestDto, ReviewTransferRequestDto, ConfirmTransferRequestDto, ListTransferRequestQuery } from "./dto/transfer-request.dto";

export class TransferRequestService {
  constructor(
    private repo: TransferRequestRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list(query: ListTransferRequestQuery) {
    return this.repo.findAll(query);
  }

  async getById(id: number) {
    const req = await this.repo.findById(id);
    if (!req) throw new AppError(404, "TRANSFER_REQUEST_NOT_FOUND");
    return req;
  }

  async create(dto: CreateTransferRequestDto, requestedById: number) {
    const inProgress = await this.repo.hasInProgress(dto.playerId);
    if (inProgress) throw new AppError(409, "TRANSFER_REQUEST_IN_PROGRESS");
    return this.repo.create(dto, requestedById);
  }

  async update(id: number, dto: UpdateTransferRequestDto) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_MODIFY_NON_DRAFT");
    return this.repo.update(id, dto);
  }

  async submit(id: number, userId: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_SUBMIT_NON_DRAFT");
    if (req.requestedBy.id !== userId) throw new AppError(403, "FORBIDDEN");
    const result = await this.repo.submit(id);
    await this.notifRepo.createForStaff(
      "TRANSFER_REQUEST_SUBMITTED",
      (lang) => ({
        title: lang === "ko" ? "이적 요청 검토 필요" : "Transfer Request Review Required",
        body: lang === "ko" ? "선수 이적 요청이 접수되었습니다." : "A transfer request has been submitted.",
      }),
      id,
    );
    return result;
  }

  async review(id: number, dto: ReviewTransferRequestDto, reviewedById: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.PENDING_APPROVAL) throw new AppError(409, "CANNOT_REVIEW_NON_PENDING");
    if (dto.action === "reject" && !dto.rejectReason?.trim()) throw new AppError(400, "REJECT_REASON_REQUIRED");
    const result = await this.repo.review(id, dto.action, reviewedById, dto.rejectReason);
    const notifType = dto.action === "approve" ? "TRANSFER_REQUEST_APPROVED" : "TRANSFER_REQUEST_REJECTED";
    await this.notifRepo.createForUser(
      req.requestedBy.id,
      notifType,
      (lang) => ({
        title: lang === "ko"
          ? (dto.action === "approve" ? "이적 요청 1차 승인" : "이적 요청 반려")
          : (dto.action === "approve" ? "Transfer Request Approved (1st)" : "Transfer Request Rejected"),
        body: lang === "ko"
          ? (dto.action === "approve" ? "이적 요청이 1차 승인되었습니다." : `이적 요청이 반려되었습니다: ${dto.rejectReason}`)
          : (dto.action === "approve" ? "Your transfer request has been approved." : `Your transfer request was rejected: ${dto.rejectReason}`),
      }),
      id,
    );
    return result;
  }

  async confirmStep(id: number, dto: ConfirmTransferRequestDto, confirmedById: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.APPROVED) throw new AppError(409, "CANNOT_CONFIRM_NON_APPROVED");
    if (dto.action === "reject" && !dto.rejectReason?.trim()) throw new AppError(400, "REJECT_REASON_REQUIRED");
    const result = await this.repo.confirm(id, dto.action, confirmedById, dto.rejectReason);
    if (dto.action === "confirm") {
      await Promise.all([
        this.notifRepo.createForUser(
          req.requestedBy.id,
          "TRANSFER_REQUEST_CONFIRMED",
          (lang) => ({
            title: lang === "ko" ? "이적 최종 확정" : "Transfer Confirmed",
            body: lang === "ko" ? "이적 요청이 최종 확정되었습니다." : "Your transfer request has been confirmed.",
          }),
          id,
        ),
        this.notifRepo.createForGM(
          "TRANSFER_REQUEST_CONFIRMED",
          (lang) => ({
            title: lang === "ko" ? "이적 확정 완료" : "Transfer Confirmed",
            body: lang === "ko" ? "이적 요청이 최종 확정 처리되었습니다." : "A transfer request has been confirmed.",
          }),
          id,
        ),
      ]);
    } else {
      await this.notifRepo.createForUser(
        req.requestedBy.id,
        "TRANSFER_REQUEST_REJECTED",
        (lang) => ({
          title: lang === "ko" ? "이적 요청 최종 반려" : "Transfer Request Rejected",
          body: lang === "ko"
            ? `이적 요청이 최종 반려되었습니다: ${dto.rejectReason}`
            : `Your transfer request was rejected: ${dto.rejectReason}`,
        }),
        id,
      );
    }
    return result;
  }

  async delete(id: number, userId: number) {
    const req = await this.getById(id);
    if (req.status !== TransferRequestStatus.DRAFT) throw new AppError(409, "CANNOT_DELETE_NON_DRAFT");
    if (req.requestedBy.id !== userId) throw new AppError(403, "FORBIDDEN");
    return this.repo.delete(id);
  }
}
