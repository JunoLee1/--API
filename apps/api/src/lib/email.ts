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
