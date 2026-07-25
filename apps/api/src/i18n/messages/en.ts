import type { Messages } from './ko';

export const en: Messages = {
  player: {
    created: (name: string) => ({ title: 'Player Registered', body: `${name} has been registered.` }),
    updated: (name: string) => ({ title: 'Player Updated', body: `${name}'s information has been updated.` }),
    positionChanged: (name: string, pos: string) => ({ title: 'Position Changed', body: `${name}'s position has been changed to ${pos}.` }),
    statusChanged: (name: string, status: string) => ({ title: 'Player Status Changed', body: `${name}'s status has been changed to ${status}.` }),
    offboardingStarted: (name: string) => ({ title: 'Offboarding Started', body: `Offboarding process has started for ${name}.` }),
  },
  coach: {
    created: (name: string) => ({ title: 'Coach Registered', body: `${name} has been registered as a coach.` }),
    updated: (name: string) => ({ title: 'Coach Updated', body: `${name}'s information has been updated.` }),
    roleChanged: (name: string, role: string) => ({ title: 'Role Changed', body: `${name}'s role has been changed to ${role}.` }),
  },
  attendance: {
    absent: (date: string) => ({ title: 'Marked Absent', body: `You have been marked absent for training on ${date}.` }),
    late: (date: string) => ({ title: 'Marked Late', body: `You have been marked late for training on ${date}.` }),
    penaltyIssued: (reason: string) => ({ title: 'Penalty Issued', body: `A penalty has been issued for: ${reason}.` }),
    penaltyResolved: () => ({ title: 'Penalty Lifted', body: 'Your penalty has been lifted.' }),
  },
  jersey: {
    assigned: (number: number) => ({ title: 'Jersey Assigned', body: `Jersey number ${number} has been assigned to you.` }),
    changed: (prev: number, next: number) => ({ title: 'Jersey Changed', body: `Your jersey number has been changed from ${prev} to ${next}.` }),
    unassigned: () => ({ title: 'Jersey Unassigned', body: 'Your jersey number has been unassigned.' }),
  },
  match: {
    scheduled: (opponent: string, date: string) => ({ title: 'Match Scheduled', body: `A match against ${opponent} has been scheduled on ${date}.` }),
    resultEntered: (opponent: string, score: string) => ({ title: 'Match Result', body: `Result vs ${opponent}: ${score}` }),
    cancelled: (opponent: string, date: string) => ({ title: 'Match Cancelled', body: `The match against ${opponent} on ${date} has been cancelled.` }),
    statsUpdated: (opponent: string) => ({ title: 'Match Stats Updated', body: `Statistics for the match against ${opponent} have been updated.` }),
    statSheetScanned: (opponent: string) => ({ title: 'Stat Sheet Scanned', body: `Match stat sheet analysis for the ${opponent} game is complete.` }),
  },
  injury: {
    reported: (name: string, type: string) => ({ title: 'Injury Reported', body: `A ${type} injury has been reported for ${name}.` }),
    recovered: (name: string) => ({ title: 'Injury Recovered', body: `${name} has recovered from their injury.` }),
    statusChanged: (name: string, status: string) => ({ title: 'Injury Status Changed', body: `${name}'s injury status: ${status}` }),
    treatmentAdded: (name: string) => ({ title: 'Treatment Added', body: `A treatment record has been added for ${name}.` }),
  },
  callup: {
    issued: (name: string, team: string) => ({ title: 'National Team Callup', body: `${name} has been called up to ${team}.` }),
    returned: (name: string) => ({ title: 'Callup Released', body: `${name} has returned from the national team.` }),
    extended: (name: string) => ({ title: 'Callup Extended', body: `${name}'s callup period has been extended.` }),
  },
  video: {
    uploaded: (title: string) => ({ title: 'Video Uploaded', body: `"${title}" has been uploaded.` }),
    aiSummaryGenerated: (title: string) => ({ title: 'AI Summary Generated', body: `AI summary for "${title}" has been generated.` }),
    deleted: (title: string) => ({ title: 'Video Deleted', body: `"${title}" has been deleted.` }),
  },
  youth: {
    playerPromoted: (name: string) => ({ title: 'Youth Player Promoted', body: `${name} has been promoted to the first team.` }),
    evaluationAdded: (name: string) => ({ title: 'Evaluation Added', body: `An evaluation has been added for ${name}.` }),
    programStarted: (name: string) => ({ title: 'Program Started', body: `The ${name} program has started.` }),
    programEnded: (name: string) => ({ title: 'Program Ended', body: `The ${name} program has ended.` }),
    loanStarted: (name: string, club: string) => ({ title: 'Loan Started', body: `${name} has been loaned to ${club}.` }),
    loanReturned: (name: string) => ({ title: 'Loan Return', body: `${name} has returned from their loan.` }),
  },
  medical: {
    expenseSubmitted: (name: string, amount: string) => ({ title: 'Medical Expense Submitted', body: `A medical expense of ${amount} KRW has been submitted for ${name}.` }),
    expenseApproved: (name: string) => ({ title: 'Medical Expense Approved', body: `The medical expense for ${name} has been approved.` }),
    expenseRejected: (name: string, reason: string) => ({ title: 'Medical Expense Rejected', body: `The medical expense for ${name} has been rejected: ${reason}` }),
  },
  equipment: {
    requestSubmitted: (item: string) => ({ title: 'Equipment Request', body: `Your request for ${item} has been received.` }),
    requestApproved: (item: string) => ({ title: 'Request Approved', body: `Your request for ${item} has been approved.` }),
    requestRejected: (item: string, reason: string) => ({ title: 'Request Rejected', body: `Your request for ${item} has been rejected: ${reason}` }),
    issued: (item: string) => ({ title: 'Equipment Issued', body: `${item} has been issued to you.` }),
    returned: (item: string) => ({ title: 'Equipment Returned', body: `${item} has been returned.` }),
  },
  report: {
    submitted: (type: string) => ({ title: 'Report Submitted', body: `A ${type} report has been submitted.` }),
    approved: (type: string) => ({ title: 'Report Approved', body: `The ${type} report has been approved.` }),
    rejected: (type: string, reason: string) => ({ title: 'Report Rejected', body: `The ${type} report has been rejected: ${reason}` }),
    revisionRequested: (type: string) => ({ title: 'Revision Requested', body: `A revision has been requested for the ${type} report.` }),
  },
  development: {
    goalSet: (name: string, goal: string) => ({ title: 'Development Goal Set', body: `A development goal has been set for ${name}: ${goal}` }),
    milestoneReached: (name: string, milestone: string) => ({ title: 'Milestone Reached', body: `${name} has reached a milestone: ${milestone}` }),
    evaluationAdded: (name: string) => ({ title: 'Development Evaluation Added', body: `A development evaluation has been added for ${name}.` }),
  },
  incident: {
    reported: (name: string, type: string) => ({ title: 'Incident Reported', body: `A ${type} incident involving ${name} has been reported.` }),
    resolved: (name: string) => ({ title: 'Incident Resolved', body: `The incident involving ${name} has been resolved.` }),
  },
  safeguard: {
    caseOpened: (name: string) => ({ title: 'Safeguard Case Opened', body: `A case has been opened regarding ${name}.` }),
    caseClosed: (name: string) => ({ title: 'Safeguard Case Closed', body: `The case regarding ${name} has been closed.` }),
    reviewScheduled: (name: string, date: string) => ({ title: 'Review Scheduled', body: `A review for the ${name} case has been scheduled on ${date}.` }),
  },
  tactical: {
    referenceAdded: (title: string) => ({ title: 'Tactical Reference Added', body: `"${title}" has been added to tactical references.` }),
    referenceDeleted: (title: string) => ({ title: 'Tactical Reference Deleted', body: `"${title}" has been removed from tactical references.` }),
  },
  training: {
    sessionCreated: (date: string, type: string) => ({ title: 'Training Session Scheduled', body: `A ${type} training session has been scheduled on ${date}.` }),
    sessionCancelled: (date: string) => ({ title: 'Training Session Cancelled', body: `The training session on ${date} has been cancelled.` }),
    attendanceRecorded: (date: string) => ({ title: 'Attendance Recorded', body: `Attendance for the ${date} training session has been recorded.` }),
  },
  loan: {
    started: (name: string, club: string, endDate: string) => ({ title: 'Loan Started', body: `${name} has been loaned to ${club} until ${endDate}.` }),
    ended: (name: string, club: string) => ({ title: 'Loan Ended', body: `${name}'s loan at ${club} has ended.` }),
    extended: (name: string, newEndDate: string) => ({ title: 'Loan Extended', body: `${name}'s loan has been extended until ${newEndDate}.` }),
    recalled: (name: string) => ({ title: 'Loan Recalled', body: `${name} has been recalled from their loan.` }),
  },
  workPermit: {
    submitted: (name: string) => ({ title: 'Work Permit Applied', body: `A work permit application has been submitted for ${name}.` }),
    approved: (name: string) => ({ title: 'Work Permit Approved', body: `${name}'s work permit has been approved.` }),
    rejected: (name: string, reason: string) => ({ title: 'Work Permit Rejected', body: `${name}'s work permit has been rejected: ${reason}` }),
    expiringSoon: (name: string, days: number) => ({ title: 'Work Permit Expiring', body: `${name}'s work permit expires in ${days} days.` }),
    expired: (name: string) => ({ title: 'Work Permit Expired', body: `${name}'s work permit has expired.` }),
  },
  contract: {
    created: (name: string, endDate: string) => ({ title: 'Contract Signed', body: `${name}'s contract has been signed until ${endDate}.` }),
    renewed: (name: string, newEndDate: string) => ({ title: 'Contract Renewed', body: `${name}'s contract has been renewed until ${newEndDate}.` }),
    terminated: (name: string) => ({ title: 'Contract Terminated', body: `${name}'s contract has been terminated.` }),
    expiringSoon: (name: string, days: number) => ({ title: 'Contract Expiring', body: `${name}'s contract expires in ${days} days.` }),
    expired: (name: string) => ({ title: 'Contract Expired', body: `${name}'s contract has expired.` }),
    salaryChanged: (name: string) => ({ title: 'Salary Changed', body: `${name}'s salary has been updated.` }),
  },
  matchDay: {
    lineupConfirmed: (opponent: string) => ({ title: 'Lineup Confirmed', body: `The lineup for the ${opponent} match has been confirmed.` }),
    lineupSelected: (opponent: string) => ({ title: 'Selected in Lineup', body: `You have been selected in the starting lineup for the ${opponent} match.` }),
    lineupNotSelected: (opponent: string) => ({ title: 'Not Selected', body: `You have not been selected in the starting lineup for the ${opponent} match.` }),
    substituteReady: (opponent: string) => ({ title: 'Named as Substitute', body: `You have been named as a substitute for the ${opponent} match.` }),
  },
};
