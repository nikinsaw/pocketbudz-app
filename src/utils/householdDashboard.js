// Turns the server's dashboard response (amounts in paise, already filtered by what the
// signed-in member may see) into what the screen draws. Pure, so it is easy to test.
// The wording about privacy lives here on purpose: it must stay truthful to the rules.

const WARNING_THRESHOLD = 0.85; // same as the solo envelopes (utils/envelopeDisplay.js)
const ROLE_LABEL = { OWNER: 'Owner', EARNER: 'Earner', SPENDER: 'Spender' };

export function formatMoney(paise, currencyFormat = 'indian') {
  const locale = currencyFormat === 'international' ? 'en-US' : 'en-IN';
  const rupees = paise / 100;
  const whole = paise % 100 === 0;
  const text = rupees.toLocaleString(locale, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `₹${text}`;
}

function formatDay(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function envelopeRow(envelope, money) {
  const { spent, budgetLimit } = envelope;
  const ratio = budgetLimit > 0 ? spent / budgetLimit : 0;
  const over = budgetLimit > 0 && spent > budgetLimit;
  const fixed = envelope.type === 'fixed';

  let status;
  if (fixed) {
    status = ratio >= 1 ? 'Paid this cycle' : 'Fixed';
  } else if (over) {
    status = `Over by ${money(spent - budgetLimit)}`;
  } else {
    status = `${money(budgetLimit - spent)} left`;
  }

  return {
    id: envelope.id,
    icon: envelope.icon,
    title: envelope.title,
    colorKey: envelope.colorKey,
    amountLabel: `${money(spent)} of ${money(budgetLimit)}`,
    status,
    progress: Math.min(ratio, 1),
    warning: !fixed && (over || ratio >= WARNING_THRESHOLD),
    // Whose envelope it is, when it isn't the viewer's or the household's.
    ownerLabel: envelope.owner ? `${envelope.owner}’s, shared with you` : null,
  };
}

function memberRow(member, complete, money) {
  const total = member.sharedSpent + member.privateSpent;

  let detail;
  if (member.isMe) {
    detail = 'You';
  } else if (member.privateSpent === 0) {
    // Earners see every member's total, so zero really means none. A spender can't tell
    // "no personal spending" from "not shared with me", so we say only what we know.
    detail = complete ? 'No personal spending' : 'Personal spending is private';
  } else if (member.itemisedSpent >= member.privateSpent) {
    detail = 'Details shared with you';
  } else if (member.itemisedSpent > 0) {
    detail = 'Some details shared with you';
  } else {
    detail = 'Total only';
  }

  return {
    membershipId: member.membershipId,
    name: member.name,
    roleLabel: ROLE_LABEL[member.role] ?? member.role,
    isMe: member.isMe,
    totalLabel: money(total),
    total,
    detail,
  };
}

export function buildDashboardView(data) {
  const money = (paise) => formatMoney(paise, data.household.currencyFormat);
  const { headline, period, me } = data;
  const earner = me.role === 'OWNER' || me.role === 'EARNER';

  const rows = data.envelopes.map((e) => envelopeRow(e, money));
  const byId = new Map(data.envelopes.map((e) => [e.id, e]));
  const sharedEnvelopes = rows.filter((r) => byId.get(r.id).scope === 'SHARED');
  const personalEnvelopes = rows.filter((r) => byId.get(r.id).scope === 'PERSONAL');

  const stats = [
    { label: 'Shared', value: money(headline.sharedSpent) },
    { label: 'Personal', value: money(headline.privateSpent) },
  ];
  if (data.income) {
    stats.push({ label: 'Income', value: money(data.income.total) });
  }

  const members = data.members
    .map((m) => memberRow(m, headline.complete, money))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.total - a.total);

  return {
    title: data.household.name,
    periodLabel: `${formatDay(period.from)} – ${formatDay(period.to)}`,
    progressLabel: `Day ${period.daysElapsed} of ${period.daysTotal}`,
    headline: {
      amountLabel: money(headline.householdSpent),
      caption: headline.complete
        ? 'spent by your household this cycle'
        : 'spent that you can see this cycle',
      // Spenders see a partial figure; say so rather than let it pass for the whole.
      note: headline.complete
        ? null
        : 'Includes shared spending and whatever others choose to show you.',
    },
    stats,
    leftOver: data.income
      ? {
          label: data.income.leftOver >= 0 ? 'Left after spending' : 'Spent beyond income',
          value: money(Math.abs(data.income.leftOver)),
          negative: data.income.leftOver < 0,
        }
      : null,
    mine: {
      spentLabel: money(headline.mySpent),
      allowanceLabel:
        data.allowances.received !== undefined && data.allowances.received > 0
          ? `${money(data.allowances.received)} set aside for you each cycle`
          : null,
      givenLabel:
        earner && data.allowances.given > 0
          ? `${money(data.allowances.given)} set aside for spenders each cycle`
          : null,
    },
    sharedEnvelopes,
    personalEnvelopes,
    members,
    isEmpty: rows.length === 0 && headline.householdSpent === 0,
  };
}
