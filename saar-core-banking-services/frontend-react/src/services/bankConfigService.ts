export interface TenantConfig {
  name?: string;
  themeColor?: string;
  logoUrl?: string;
  bankAddress?: string;
  bankPhone?: string;
  bankEmail?: string;
  rbiLicenseNumber?: string;
  websiteUrl?: string;
  featureGoldLoan: boolean;
  featureDynamicForms: boolean;
  featureExpressions: boolean;
  featureApprovalChain: boolean;
  featureComplianceAlerts: boolean;
  featureFdRd: boolean;
  configUpdatedAt?: string;
  configUpdatedBy?: string;
}

const base = () =>
  (process.env.REACT_APP_UAM_BASE_URL ?? 'http://localhost:5033').replace(/\/$/, '');

const authHdr = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth-token') ?? ''}`,
});

export const getTenantConfig = async (): Promise<TenantConfig> => {
  const res = await fetch(`${base()}/api/tenant-config`, { headers: authHdr() });
  if (!res.ok) throw new Error(`Failed to load tenant config: ${res.status}`);
  return res.json();
};

export const saveTenantConfig = async (cfg: TenantConfig): Promise<TenantConfig> => {
  const res = await fetch(`${base()}/api/tenant-config`, {
    method: 'PUT',
    headers: authHdr(),
    body: JSON.stringify(cfg),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Save failed: ${res.status}`);
  }
  return res.json();
};
