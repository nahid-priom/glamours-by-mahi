export type StaffMessageInput = {
  staffName: string
  todaySales: number
  yesterdaySales: number
  todayOrders: number
  targetAmount: number | null
  achievedSales: number
  followUpsDue: number
  followUpsOverdue: number
  commissionToday: number
  pendingOrders: number
}

export type StaffMessage = {
  tone: 'success' | 'encourage' | 'warn' | 'neutral'
  headline: string
  detail?: string
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || 'বন্ধু'
}

function formatTaka(n: number) {
  return `৳${Math.round(Math.max(n, 0)).toLocaleString('en-BD')}`
}

/** Bangla performance guidance from real metrics — never insulting. */
export function getStaffPerformanceMessage(input: StaffMessageInput): StaffMessage {
  const name = firstName(input.staffName)
  const remaining =
    input.targetAmount != null ? Math.max(input.targetAmount - input.achievedSales, 0) : null
  const pct =
    input.targetAmount && input.targetAmount > 0
      ? (input.achievedSales / input.targetAmount) * 100
      : null

  if (input.followUpsOverdue > 0) {
    return {
      tone: 'warn',
      headline: `শুভ দিন, ${name}। ${input.followUpsOverdue}টি Follow-up বাকি আছে।`,
      detail: 'আগে Overdue Follow-up শেষ করলে Customer response ভালো হবে।',
    }
  }

  if (pct != null && pct >= 100) {
    return {
      tone: 'success',
      headline: `দারুণ কাজ, ${name}! Target আপনি পূরণ করেছেন।`,
      detail:
        input.commissionToday > 0
          ? `আজকের Commission ${formatTaka(input.commissionToday)}। ধারাবাহিকতা বজায় রাখুন।`
          : 'এই গতি বজায় রাখলে মাসের Targetও সহজ হবে।',
    }
  }

  if (pct != null && pct >= 75 && remaining != null) {
    return {
      tone: 'encourage',
      headline: `শুভ সকাল, ${name}। আর মাত্র ${formatTaka(remaining)} Sale হলেই Target পূরণ হবে।`,
      detail:
        input.pendingOrders > 0
          ? `${input.pendingOrders}টি Pending Order আছে — এগুলো থেকে শুরু করুন।`
          : 'আজকের Follow-up থেকে নতুন Sale তৈরি করতে পারেন।',
    }
  }

  if (input.todayOrders === 0 && input.todaySales === 0) {
    return {
      tone: 'neutral',
      headline: `শুভ সকাল, ${name}। আজ এখনো কোনো Sale হয়নি।`,
      detail:
        input.followUpsDue > 0
          ? `${input.followUpsDue}টি Follow-up থেকে কাজ শুরু করুন।`
          : 'নতুন Order বা Customer Call দিয়ে দিন শুরু করুন।',
    }
  }

  if (input.yesterdaySales > 0 && input.todaySales > input.yesterdaySales * 1.1) {
    return {
      tone: 'success',
      headline: `ভালো যাচ্ছে, ${name}! আজকের Sale গতকালের চেয়ে এগিয়ে।`,
      detail: `আজ ${formatTaka(input.todaySales)} · ${input.todayOrders}টি Order`,
    }
  }

  if (remaining != null && remaining > 0) {
    return {
      tone: 'encourage',
      headline: `শুভ সকাল, ${name}। Target পূরণ করতে আর ${formatTaka(remaining)} Sale প্রয়োজন।`,
      detail: `আজ এখন পর্যন্ত ${formatTaka(input.todaySales)}।`,
    }
  }

  return {
    tone: 'neutral',
    headline: `শুভ সকাল, ${name}। আজকের কাজ চালিয়ে যান।`,
    detail: `আজ ${formatTaka(input.todaySales)} Sale · ${input.todayOrders}টি Order`,
  }
}

export function targetStatusLabel(pct: number, daysRemaining: number): string {
  if (pct >= 100) return 'Completed'
  if (pct >= 90) return 'Ahead'
  if (daysRemaining <= 2 && pct < 70) return 'At Risk'
  if (pct >= 60) return 'On Track'
  if (pct >= 40) return 'Slightly Behind'
  return 'At Risk'
}
