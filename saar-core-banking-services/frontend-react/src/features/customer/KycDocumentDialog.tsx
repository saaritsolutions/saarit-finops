import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Checkbox, FormControlLabel, Alert, CircularProgress,
  Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
  LinearProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import { customerService } from '../../services/customerService';

export interface DocumentUpload {
  type: string;
  label: string;
  file?: File;
  uploaded: boolean;
  required: boolean;
}

interface KycDocumentDialogProps {
  open: boolean;
  customerId: number;
  customerType: string;
  onClose: () => void;
  onSuccess: (markAsSubmitted: boolean) => void;
}

const REQUIRED_DOCUMENTS: Record<string, { type: string; label: string; required: boolean }[]> = {
  Individual: [
    { type: 'pan', label: 'PAN Card', required: true },
    { type: 'aadhaar', label: 'Aadhaar Card', required: true },
    { type: 'identity', label: 'Identity Proof (Passport/DL/Voter ID)', required: true },
    { type: 'address', label: 'Address Proof (Utility Bill/Lease)', required: true },
  ],
  Corporate: [
    { type: 'pan', label: 'Company PAN', required: true },
    { type: 'registration', label: 'Certificate of Incorporation', required: true },
    { type: 'director', label: 'Director Identity & Address Proof', required: true },
    { type: 'director_pan', label: 'Director PAN', required: true },
    { type: 'board_resolution', label: 'Board Resolution', required: false },
  ],
  Government: [
    { type: 'registration', label: 'Government Registration', required: true },
    { type: 'authorized_signatory', label: 'Authorized Signatory Proof', required: true },
  ],
  NRI: [
    { type: 'pan', label: 'PAN Card', required: true },
    { type: 'passport', label: 'Passport', required: true },
    { type: 'address_abroad', label: 'Address Proof (Abroad)', required: true },
    { type: 'foreign_tax_id', label: 'Foreign Tax ID', required: false },
  ],
};

const KycDocumentDialog: React.FC<KycDocumentDialogProps> = ({
  open, customerId, customerType, onClose, onSuccess,
}) => {
  const docDefs = REQUIRED_DOCUMENTS[customerType] || REQUIRED_DOCUMENTS.Individual;
  const [documents, setDocuments] = useState<DocumentUpload[]>(
    docDefs.map(d => ({ ...d, uploaded: false, file: undefined }))
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAsComplete, setSubmitAsComplete] = useState(false);

  const handleFileSelect = useCallback((index: number, file: File | null) => {
    setDocuments(prev => {
      const updated = [...prev];
      if (file) {
        // Validate file size (max 5MB per document)
        if (file.size > 5 * 1024 * 1024) {
          setError(`File "${file.name}" is too large. Maximum 5MB allowed.`);
          return prev;
        }
        updated[index] = { ...updated[index], file, uploaded: false };
      } else {
        updated[index] = { ...updated[index], file: undefined };
      }
      setError(null);
      return updated;
    });
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    handleFileSelect(index, null);
  }, [handleFileSelect]);

  const handleSave = useCallback(async () => {
    // Validate required documents have files
    const missingRequired = documents.filter(d => d.required && !d.file);
    if (missingRequired.length > 0) {
      setError(`Missing required documents: ${missingRequired.map(d => d.label).join(', ')}`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      // Upload all documents
      const uploadPromises = documents
        .filter(d => d.file)
        .map(d => customerService.uploadDocument(customerId, d.type, d.file!));

      await Promise.all(uploadPromises);

      // If marking as submitted, call submit endpoint
      if (submitAsComplete) {
        await customerService.submitKycDocuments(customerId);
      }

      onSuccess(submitAsComplete);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [documents, customerId, submitAsComplete, onSuccess, onClose]);

  const requiredCount = documents.filter(d => d.required).length;
  const uploadedCount = documents.filter(d => d.file).length;
  const allRequiredUploaded = documents.filter(d => d.required && !d.file).length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>KYC Document Upload</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Required Documents: {requiredCount} | Uploaded: {uploadedCount}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(uploadedCount / requiredCount) * 100}
            sx={{ mb: 2 }}
          />
        </Box>

        <List disablePadding>
          {documents.map((doc, idx) => (
            <Paper
              key={doc.type}
              sx={{
                p: 2,
                mb: 2,
                border: doc.file ? '2px solid success.main' : doc.required ? '2px solid error.light' : '2px solid divider',
                bgcolor: doc.file ? 'success.lighter' : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {doc.file ? (
                  <CheckCircleIcon sx={{ color: 'success.main' }} />
                ) : doc.required ? (
                  <ErrorIcon sx={{ color: 'error.main' }} />
                ) : null}
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {doc.label}
                  {doc.required && <span style={{ color: 'red' }}> *</span>}
                </Typography>
              </Box>

              {doc.file ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
                    ✓ {doc.file.name}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleRemoveFile(idx)}
                    disabled={uploading}
                  >
                    Remove
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  disabled={uploading}
                >
                  Choose File (PDF/JPG, max 5MB)
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(idx, file);
                    }}
                  />
                </Button>
              )}
            </Paper>
          ))}
        </List>

        <FormControlLabel
          control={
            <Checkbox
              checked={submitAsComplete}
              onChange={(e) => setSubmitAsComplete(e.target.checked)}
              disabled={!allRequiredUploaded || uploading}
            />
          }
          label={
            <Typography variant="body2">
              Mark KYC as complete after uploading
              {!allRequiredUploaded && ' (upload all required documents first)'}
            </Typography>
          }
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={uploading || uploadedCount === 0}
          startIcon={uploading ? <CircularProgress size={16} /> : undefined}
        >
          {uploading ? 'Uploading...' : submitAsComplete ? 'Upload & Submit' : 'Save Documents'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KycDocumentDialog;
