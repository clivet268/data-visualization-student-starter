export const NPL_STATUS_LABELS: Record<string, string> = {
  F: 'Final NPL',
  P: 'Proposed NPL',
  D: 'Deleted from NPL',
  N: 'Not on NPL',
};
export const ALL_STATUSES = Object.keys(NPL_STATUS_LABELS);

const DAY = 86_400_000;
export const TIME_OPTIONS = [
  { key: 'any', label: 'Any time', ms: Infinity },
  { key: '30d', label: 'Last 30 days', ms: 30 * DAY },
  { key: '1y', label: 'Last year', ms: 365 * DAY },
  { key: '5y', label: 'Last 5 years', ms: 5 * 365 * DAY },
] as const;
export type TimeKey = (typeof TIME_OPTIONS)[number]['key'];

export function siteMatchesFilters(props: any, statusFilter: Set<string>, timeFilter: TimeKey): boolean {
  const code = props?.NPL_STATUS;
  const status = code && code in NPL_STATUS_LABELS ? code : 'N';
  if (!statusFilter.has(status)) return false;

  const opt = TIME_OPTIONS.find((o) => o.key === timeFilter);
  if (!opt || opt.ms === Infinity) return true;
  const changed = props?.LAST_CHANG;
  return typeof changed === 'number' && changed >= Date.now() - opt.ms;
}