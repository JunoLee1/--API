import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env["SMTP_HOST"] ?? "smtp.gmail.com",
  port: Number(process.env["SMTP_PORT"] ?? 587),
  secure: false,
  auth: {
    user: process.env["SMTP_USER"],
    pass: process.env["SMTP_PASS"],
  },
});

export async function sendInviteEmail(to: string, inviteUrl: string, role: string) {
  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "Football ERP <no-reply@example.com>",
    to,
    subject: "[Football ERP] 초대 링크",
    html: `
      <p>Football ERP에 초대되었습니다.</p>
      <p>역할: <strong>${role}</strong></p>
      <p>아래 링크를 클릭하여 24시간 이내에 가입을 완료해주세요.</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>링크는 24시간 후 만료됩니다.</p>
    `,
  });
}

export async function sendGuardianInjuryEmail(
  to: string,
  playerName: string,
  description: string,
) {
  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "Football ERP <no-reply@example.com>",
    to,
    subject: `[Football ERP] ${playerName} 선수 부상 발생 알림`,
    html: `
      <p><strong>${playerName}</strong> 선수에게 부상이 발생했습니다.</p>
      <p>부상 내용: ${description}</p>
      <p>자세한 내용은 앱에서 확인해주세요.</p>
    `,
  });
}

export async function sendApplicationStatusEmail(
  to: string,
  applicantName: string,
  status: "REJECTED" | "OFFERED" | "WAITLIST" | "WAITLIST_EXPIRED",
): Promise<void> {
  const messages: Record<
    "REJECTED" | "OFFERED" | "WAITLIST" | "WAITLIST_EXPIRED",
    { subject: string; body: string }
  > = {
    REJECTED: {
      subject: "[FC Seoul ERP] 채용 지원 결과 안내",
      body: `${applicantName}님, 지원해 주셔서 감사합니다. 아쉽게도 이번 전형에서 합격하지 못하셨습니다.`,
    },
    OFFERED: {
      subject: "[FC Seoul ERP] 채용 제안 안내",
      body: `${applicantName}님, 축하합니다! 채용 제안을 드리게 되어 기쁩니다. 담당자가 곧 연락드릴 예정입니다.`,
    },
    WAITLIST: {
      subject: "[FC Seoul ERP] 채용 대기(Waitlist) 등록 안내",
      body: `${applicantName}님, 서류/면접 결과가 우수하여 채용 대기(waitlist) 명단에 등록되었습니다. 자리가 나면 즉시 연락드리겠습니다.`,
    },
    WAITLIST_EXPIRED: {
      subject: "[FC Seoul ERP] 채용 대기(Waitlist) 만료 안내",
      body: `${applicantName}님, 아쉽게도 시즌 마감으로 인해 waitlist 가 종료되었습니다. 향후 다른 기회에 지원 부탁드립니다.`,
    },
  };
  const { subject, body } = messages[status];
  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "FC Seoul ERP <no-reply@fcs.example.com>",
    to,
    subject,
    html: `<p>${body}</p>`,
  });
}

export async function sendGuardianCallupEmail(
  to: string,
  playerName: string,
  requiredDocuments: string[],
) {
  const docList = requiredDocuments.length > 0
    ? `<ul>${requiredDocuments.map(d => `<li>${d}</li>`).join("")}</ul>`
    : "<p>담당자에게 문의해주세요.</p>";

  await transporter.sendMail({
    from: process.env["SMTP_FROM"] ?? "Football ERP <no-reply@example.com>",
    to,
    subject: `[Football ERP] ${playerName} 선수 1군 콜업 알림`,
    html: `
      <p><strong>${playerName}</strong> 선수의 1군 콜업이 승인됐습니다.</p>
      <p>필요 서류 목록:</p>
      ${docList}
    `,
  });
}
