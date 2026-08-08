export function formatLedgerDescription(
  module: string,
  action: string,
  context: Record<string, string | number>,
): string {
  const tag = `[${module.toUpperCase()}:${action.toUpperCase()}]`;
  switch (`${module}:${action}`) {
    case "sales:ticket_sale":
      return `${tag} 티켓 판매 — ${context["home"]} vs ${context["away"]}`;
    case "sponsorship:payment_received":
      return `${tag} 스폰서십 수입 — ${context["sponsorName"]} #${context["paymentId"]}`;
    case "facility:repair_completed":
      return `${tag} 시설 수리 — ${context["title"]}`;
    case "payroll:salary_disbursed":
      return `${tag} 급여 지급 — salaryId ${context["salaryId"]}, run #${context["runId"]}`;
    case "equipment:retired":
      return `${tag} 장비 폐기 — Unit #${context["unitId"]}`;
    case "ledger:refund":
      return `${tag} Refund for entry #${context["entryId"]}`;
    default:
      return `${tag} ${context["detail"] ?? "Transaction"}`;
  }
}
