export type SubscriptionPlanType = 'standard' | 'ai_premium';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'revoked' | string;

export interface SubscriptionLike {
  schoolId?: number | string | null;
  schoolIdentifier?: string | null;
  status?: SubscriptionStatus | null;
  endDate?: string | Date | null;
}

export interface SchoolLike {
  id?: number | string | null;
  identifier?: string | null;
}

/** Legacy imports have used both French and English labels for a paid licence. */
export const normalizeSubscriptionStatus = (status?: SubscriptionStatus | null) => {
  const value = String(status || '').trim().toLocaleLowerCase('fr-FR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['active', 'actif', 'activee', 'activated', 'paid', 'paye', 'approved', 'approuve', 'validated', 'valide', 'enabled'].includes(value)) return 'active';
  if (['expired', 'expire', 'revoked', 'revoque'].includes(value)) return value;
  return value || 'pending';
};

const resolveExpiryDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // A legacy YYYY-MM-DD end date means valid through that whole calendar day.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) date.setHours(23, 59, 59, 999);
  return date;
};

export const normalizeSchoolIdentifier = (identifier?: string | null) =>
  String(identifier || '').trim().toUpperCase();

export const normalizeSubscriptionPlan = (plan?: string | null): SubscriptionPlanType =>
  plan === 'ai_premium' ? 'ai_premium' : 'standard';

export const getSubscriptionMonthlyRate = (plan?: string | null) =>
  normalizeSubscriptionPlan(plan) === 'ai_premium' ? 20000 : 10000;

export const calculateSubscriptionEndDate = (startDate: Date, months?: number | string | null) => {
  const durationMonths = Math.max(1, Number(months) || 1);
  return new Date(startDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
};

export const isSubscriptionExpired = (subscription: SubscriptionLike, now = new Date()) => {
  const endDate = resolveExpiryDate(subscription?.endDate);
  const status = normalizeSubscriptionStatus(subscription?.status);
  return !endDate || endDate.getTime() < now.getTime() || status === 'expired' || status === 'revoque' || status === 'revoked';
};

export const pickCurrentActiveSubscription = <T extends SubscriptionLike>(subscriptions: T[], now = new Date()) =>
  subscriptions
    .filter((subscription) => normalizeSubscriptionStatus(subscription.status) === 'active' && !isSubscriptionExpired(subscription, now))
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())[0] || null;

export const ensureActivationBelongsToSchool = (
  subscription: SubscriptionLike,
  school: SchoolLike,
) => {
  const subscriptionSchoolId = String(subscription.schoolId ?? '').trim();
  const schoolId = String(school.id ?? '').trim();
  const subscriptionIdentifier = normalizeSchoolIdentifier(subscription.schoolIdentifier);
  const schoolIdentifier = normalizeSchoolIdentifier(school.identifier);

  const sameSchoolId = Boolean(subscriptionSchoolId && schoolId)
    && (Number.isFinite(Number(subscriptionSchoolId)) && Number.isFinite(Number(schoolId))
      ? Number(subscriptionSchoolId) === Number(schoolId)
      : subscriptionSchoolId === schoolId);
  const sameSchoolIdentifier = Boolean(subscriptionIdentifier && schoolIdentifier)
    && subscriptionIdentifier === schoolIdentifier;

  // Older licences were sometimes issued before school_id was backfilled or
  // before the identifier format was normalized/padded. A match on either
  // stable school scope is sufficient; requiring both incorrectly rejected a
  // licence that genuinely belonged to the current establishment.
  return sameSchoolId || sameSchoolIdentifier;
};

export const buildIssuedSubscriptionStatus = (): SubscriptionStatus => 'pending';
