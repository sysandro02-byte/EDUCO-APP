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
  if (!subscription?.endDate) return true;
  const endDate = new Date(subscription.endDate);
  return Number.isNaN(endDate.getTime())
    || endDate.getTime() < now.getTime()
    || subscription.status === 'expired'
    || subscription.status === 'revoked';
};

export const pickCurrentActiveSubscription = <T extends SubscriptionLike>(subscriptions: T[], now = new Date()) =>
  subscriptions
    .filter((subscription) => subscription.status === 'active' && !isSubscriptionExpired(subscription, now))
    .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())[0] || null;

export const ensureActivationBelongsToSchool = (
  subscription: SubscriptionLike,
  school: SchoolLike,
) => {
  const sameSchoolId = Number(subscription.schoolId) === Number(school.id);
  const sameSchoolIdentifier = normalizeSchoolIdentifier(subscription.schoolIdentifier)
    === normalizeSchoolIdentifier(school.identifier);
  return sameSchoolId && sameSchoolIdentifier;
};

export const buildIssuedSubscriptionStatus = (): SubscriptionStatus => 'pending';
