import React, { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import {
  performEligibilityCheck,
  lockInPreApproval,
  PerformEligibilityCheckRequest,
  EligibilityCheckResponse,
} from '../services/loanOriginationService';

const steps = ['Personal Info', 'Financial Info', 'Review & Submit', 'Results'];

interface FormData {
  applicantName: string;
  panNumber: string;
  dateOfBirth: string;
  employmentType: string;
  productType: string;
  grossMonthlyIncome: number;
  existingMonthlyEmi: number;
  monthlyObligations: number;
  otherMonthlyIncome?: number;
  cibilScore?: number;
  collateralType?: string;
  collateralValue?: number;
}

const initialFormData: FormData = {
  applicantName: '',
  panNumber: '',
  dateOfBirth: '',
  employmentType: 'SALARIED',
  productType: 'PERSONAL_LOAN',
  grossMonthlyIncome: 0,
  existingMonthlyEmi: 0,
  monthlyObligations: 0,
  otherMonthlyIncome: 0,
  cibilScore: 700,
  collateralType: '',
  collateralValue: 0,
};

export const EligibilityCheck: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preApprovalDialogOpen, setPreApprovalDialogOpen] = useState(false);
  const [preApprovalAmount, setPreApprovalAmount] = useState(0);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: isNaN(Number(value)) ? value : Number(value),
    }));
  };

  const handleNext = async () => {
    setError(null);

    if (activeStep === 0) {
      if (!formData.applicantName || !formData.panNumber || !formData.dateOfBirth) {
        setError('Please fill in all personal information');
        return;
      }
    } else if (activeStep === 1) {
      if (formData.grossMonthlyIncome <= 0) {
        setError('Gross monthly income must be greater than 0');
        return;
      }
    } else if (activeStep === 2) {
      // Submit eligibility check
      try {
        setLoading(true);
        const request: PerformEligibilityCheckRequest = {
          applicantName: formData.applicantName,
          panNumber: formData.panNumber,
          dateOfBirth: formData.dateOfBirth,
          productType: formData.productType,
          employmentType: formData.employmentType,
          grossMonthlyIncome: formData.grossMonthlyIncome,
          existingMonthlyEmi: formData.existingMonthlyEmi,
          monthlyObligations: formData.monthlyObligations,
          otherMonthlyIncome: formData.otherMonthlyIncome || 0,
          cibilScore: formData.cibilScore,
          collateralType: formData.collateralType || undefined,
          collateralValue: formData.collateralValue || undefined,
        };
        const result = await performEligibilityCheck(request);
        setEligibilityResult(result);
        setPreApprovalAmount(Math.min(result.maxEligibleAmount * 0.8, result.maxEligibleAmount));
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to perform eligibility check');
        return;
      } finally {
        setLoading(false);
      }
    }

    setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData(initialFormData);
    setEligibilityResult(null);
    setError(null);
  };

  const handleLockPreApproval = async () => {
    try {
      setLoading(true);
      // Note: In a real app, we'd have the application ID from context
      // For now, we'll just simulate the pre-approval
      const mockApplicationId = '00000000-0000-0000-0000-000000000001';
      await lockInPreApproval(mockApplicationId, preApprovalAmount);
      setPreApprovalDialogOpen(false);
      setError(null);
      // Show success message
      alert(`Pre-approval locked for ₹${preApprovalAmount.toLocaleString('en-IN')} for 24 hours!`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to lock pre-approval');
    } finally {
      setLoading(false);
    }
  };

  const getRiskGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'success';
      case 'B+':
        return 'info';
      case 'B':
        return 'warning';
      case 'C':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEligibilityColor = (status: string) => {
    if (status === 'APPROVED' || status === 'APPROVED_WITH_CONDITIONS') return 'success';
    if (status === 'DECLINED') return 'error';
    return 'warning';
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Loan Eligibility Check
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* STEP 0: Personal Information */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Personal Information</Typography>
              <TextField
                label="Full Name"
                name="applicantName"
                value={formData.applicantName}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="PAN Number"
                name="panNumber"
                value={formData.panNumber}
                onChange={handleInputChange}
                fullWidth
                placeholder="AAABB1234A"
              />
              <TextField
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <Select
                label="Employment Type"
                name="employmentType"
                value={formData.employmentType}
                onChange={handleInputChange}
              >
                <MenuItem value="SALARIED">Salaried</MenuItem>
                <MenuItem value="SELF_EMPLOYED">Self-Employed</MenuItem>
                <MenuItem value="BUSINESS_OWNER">Business Owner</MenuItem>
                <MenuItem value="RETIRED">Retired</MenuItem>
              </Select>
            </Box>
          )}

          {/* STEP 1: Financial Information */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Financial Information</Typography>
              <Select
                label="Loan Product"
                name="productType"
                value={formData.productType}
                onChange={handleInputChange}
              >
                <MenuItem value="PERSONAL_LOAN">Personal Loan</MenuItem>
                <MenuItem value="HOME_LOAN">Home Loan</MenuItem>
                <MenuItem value="BUSINESS_LOAN">Business Loan</MenuItem>
                <MenuItem value="GOLD_LOAN">Gold Loan</MenuItem>
                <MenuItem value="VEHICLE_LOAN">Vehicle Loan</MenuItem>
              </Select>
              <TextField
                label="Gross Monthly Income"
                name="grossMonthlyIncome"
                type="number"
                value={formData.grossMonthlyIncome}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Existing Monthly EMI"
                name="existingMonthlyEmi"
                type="number"
                value={formData.existingMonthlyEmi}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Monthly Obligations"
                name="monthlyObligations"
                type="number"
                value={formData.monthlyObligations}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="Other Monthly Income"
                name="otherMonthlyIncome"
                type="number"
                value={formData.otherMonthlyIncome || 0}
                onChange={handleInputChange}
                fullWidth
              />
              <TextField
                label="CIBIL Score"
                name="cibilScore"
                type="number"
                value={formData.cibilScore || 0}
                onChange={handleInputChange}
                fullWidth
              />
            </Box>
          )}

          {/* STEP 2: Review */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Review Your Information</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{formData.applicantName}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    PAN
                  </Typography>
                  <Typography variant="body1">{formData.panNumber}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Employment Type
                  </Typography>
                  <Typography variant="body1">{formData.employmentType}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Loan Product
                  </Typography>
                  <Typography variant="body1">{formData.productType}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Gross Monthly Income
                  </Typography>
                  <Typography variant="body1">
                    ₹{formData.grossMonthlyIncome.toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    CIBIL Score
                  </Typography>
                  <Typography variant="body1">{formData.cibilScore}</Typography>
                </Box>
              </Box>
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>
          )}

          {/* STEP 3: Results */}
          {activeStep === 3 && eligibilityResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {eligibilityResult.status === 'APPROVED' ||
                eligibilityResult.status === 'APPROVED_WITH_CONDITIONS' ? (
                  <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
                ) : (
                  <ErrorIcon sx={{ color: 'error.main', fontSize: 32 }} />
                )}
                <Box>
                  <Typography variant="h6">
                    {eligibilityResult.status === 'APPROVED'
                      ? 'Approved!'
                      : eligibilityResult.status === 'APPROVED_WITH_CONDITIONS'
                      ? 'Approved with Conditions'
                      : 'Declined'}
                  </Typography>
                  <Chip
                    label={eligibilityResult.status}
                    color={getEligibilityColor(eligibilityResult.status) as any}
                    size="small"
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Max Eligible Amount
                    </Typography>
                    <Typography variant="h6">
                      ₹{eligibilityResult.maxEligibleAmount.toLocaleString('en-IN')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Recommended Rate
                    </Typography>
                    <Typography variant="h6">
                      {eligibilityResult.recommendedRate?.toFixed(2)}%
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Risk Grade
                    </Typography>
                    <Chip
                      label={eligibilityResult.riskGrade}
                      color={getRiskGradeColor(eligibilityResult.riskGrade) as any}
                    />
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Eligibility Score
                    </Typography>
                    <Typography variant="h6">
                      {eligibilityResult.eligibilityScore}/100
                    </Typography>
                  </CardContent>
                </Card>
                {eligibilityResult.foirPercent !== undefined && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        FOIR Ratio
                      </Typography>
                      <Typography variant="h6">
                        {eligibilityResult.foirPercent.toFixed(2)}%
                      </Typography>
                      {eligibilityResult.foirBreached && (
                        <Chip label="Breached" size="small" color="error" />
                      )}
                    </CardContent>
                  </Card>
                )}
                {eligibilityResult.ltvPercent !== undefined && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        LTV Ratio
                      </Typography>
                      <Typography variant="h6">
                        {eligibilityResult.ltvPercent.toFixed(2)}%
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>

              {eligibilityResult.rejectionReasons.length > 0 && (
                <Alert severity="warning" icon={<InfoIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Reasons:
                  </Typography>
                  {eligibilityResult.rejectionReasons.map((reason, idx) => (
                    <Typography key={idx} variant="body2">
                      • {reason}
                    </Typography>
                  ))}
                </Alert>
              )}

              {(eligibilityResult.status === 'APPROVED' ||
                eligibilityResult.status === 'APPROVED_WITH_CONDITIONS') && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => setPreApprovalDialogOpen(true)}
                >
                  Lock in Pre-Approval (24 hours)
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Pre-Approval Amount */}
      <Dialog open={preApprovalDialogOpen} onClose={() => setPreApprovalDialogOpen(false)}>
        <DialogTitle>Lock in Pre-Approval</DialogTitle>
        <DialogContent>
          <TextField
            label="Pre-Approval Amount"
            type="number"
            value={preApprovalAmount}
            onChange={(e) => setPreApprovalAmount(Number(e.target.value))}
            fullWidth
            sx={{ mt: 2 }}
            InputProps={{ startAdornment: '₹' }}
            helperText={`Max eligible: ₹${eligibilityResult?.maxEligibleAmount.toLocaleString('en-IN')}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreApprovalDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLockPreApproval}
            variant="contained"
            disabled={loading || preApprovalAmount <= 0}
          >
            {loading ? <CircularProgress size={24} /> : 'Lock in Pre-Approval'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button variant="contained" onClick={handleReset}>
            Start Over
          </Button>
        ) : (
          <Button variant="contained" onClick={handleNext} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Next'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default EligibilityCheck;
