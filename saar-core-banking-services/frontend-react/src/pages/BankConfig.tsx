import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Container,
  Alert,
  CircularProgress,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Grid,
} from '@mui/material';
import { Save as SaveIcon, Business as BusinessIcon, ToggleOn as ToggleOnIcon } from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';
import { getTenantConfig, saveTenantConfig, type TenantConfig } from '../services/bankConfigService';

// ── TabPanel helper ───────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bc-tabpanel-${index}`}
      aria-labelledby={`bc-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ── Default (empty) config ────────────────────────────────────────────────────

const EMPTY_CONFIG: TenantConfig = {
  name: '',
  themeColor: '#2563EB',
  logoUrl: '',
  bankAddress: '',
  bankPhone: '',
  bankEmail: '',
  rbiLicenseNumber: '',
  websiteUrl: '',
  featureGoldLoan: true,
  featureDynamicForms: true,
  featureExpressions: true,
  featureApprovalChain: true,
  featureComplianceAlerts: false,
  featureFdRd: true,
};

// ── Component ─────────────────────────────────────────────────────────────────

const BankConfig: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [config, setConfig] = useState<TenantConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTenantConfig()
      .then(cfg => setConfig(cfg))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleField = (field: keyof TenantConfig) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfig(prev => ({ ...prev, [field]: e.target.value }));
    };

  const handleToggle = (field: keyof TenantConfig) =>
    (_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setConfig(prev => ({ ...prev, [field]: checked }));
    };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await saveTenantConfig(config);
      setConfig(updated);
      setSuccess('Bank configuration saved successfully. Feature toggle changes take effect at next login.');
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <PageHeader
        title="Bank Configuration"
        subtitle="Manage bank profile and per-tenant feature toggles"
        breadcrumbs={[
          { label: 'Administration' },
          { label: 'Bank Configuration' },
        ]}
      />

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabIndex}
            onChange={(_e, v) => setTabIndex(v)}
            aria-label="Bank configuration tabs"
          >
            <Tab
              label="Bank Profile"
              id="bc-tab-0"
              aria-controls="bc-tabpanel-0"
              icon={<BusinessIcon />}
              iconPosition="start"
            />
            <Tab
              label="Feature Toggles"
              id="bc-tab-1"
              aria-controls="bc-tabpanel-1"
              icon={<ToggleOnIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* ── Tab 0: Bank Profile ────────────────────────────────────────── */}
        <TabPanel value={tabIndex} index={0}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Bank Name"
                value={config.name ?? ''}
                onChange={handleField('name')}
                fullWidth
                inputProps={{ 'aria-label': 'Bank Name' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="RBI License Number"
                value={config.rbiLicenseNumber ?? ''}
                onChange={handleField('rbiLicenseNumber')}
                fullWidth
                inputProps={{ 'aria-label': 'RBI License Number' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Theme Color (hex)"
                value={config.themeColor ?? ''}
                onChange={handleField('themeColor')}
                fullWidth
                placeholder="#2563EB"
                inputProps={{ 'aria-label': 'Theme Color' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Logo URL"
                value={config.logoUrl ?? ''}
                onChange={handleField('logoUrl')}
                fullWidth
                inputProps={{ 'aria-label': 'Logo URL' }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Bank Address"
                value={config.bankAddress ?? ''}
                onChange={handleField('bankAddress')}
                fullWidth
                multiline
                rows={2}
                inputProps={{ 'aria-label': 'Bank Address' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Phone"
                value={config.bankPhone ?? ''}
                onChange={handleField('bankPhone')}
                fullWidth
                inputProps={{ 'aria-label': 'Bank Phone' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Email"
                value={config.bankEmail ?? ''}
                onChange={handleField('bankEmail')}
                fullWidth
                inputProps={{ 'aria-label': 'Bank Email' }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Website URL"
                value={config.websiteUrl ?? ''}
                onChange={handleField('websiteUrl')}
                fullWidth
                inputProps={{ 'aria-label': 'Website URL' }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* ── Tab 1: Feature Toggles ─────────────────────────────────────── */}
        <TabPanel value={tabIndex} index={1}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Feature toggle changes take effect at next login.
          </Alert>

          <Stack spacing={1} divider={<Divider flexItem />}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureGoldLoan}
                  onChange={handleToggle('featureGoldLoan')}
                  inputProps={{ 'aria-label': 'Toggle Gold Loan' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>Gold Loan</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable gold loan origination and management
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureDynamicForms}
                  onChange={handleToggle('featureDynamicForms')}
                  inputProps={{ 'aria-label': 'Toggle Dynamic Forms' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>Dynamic Forms</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable schema-driven dynamic form builder
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureExpressions}
                  onChange={handleToggle('featureExpressions')}
                  inputProps={{ 'aria-label': 'Toggle Expression Builder' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>Expression Builder</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable Roslyn-based expression engine for eligibility rules
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureApprovalChain}
                  onChange={handleToggle('featureApprovalChain')}
                  inputProps={{ 'aria-label': 'Toggle Approval Chain' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>Approval Chain</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable multi-step loan approval workflows
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureFdRd}
                  onChange={handleToggle('featureFdRd')}
                  inputProps={{ 'aria-label': 'Toggle FD/RD' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>FD / RD</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable Fixed Deposit and Recurring Deposit accounts
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.featureComplianceAlerts}
                  onChange={handleToggle('featureComplianceAlerts')}
                  inputProps={{ 'aria-label': 'Toggle Compliance Alerts' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>Compliance Alerts</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable automated KYC/AML compliance alert system (beta)
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </TabPanel>

        {/* ── Save Button ────────────────────────────────────────────────── */}
        <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            aria-label="Save bank configuration"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default BankConfig;
