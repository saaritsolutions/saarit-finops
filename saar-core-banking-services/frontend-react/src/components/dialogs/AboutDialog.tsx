import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Stack,
  Chip,
} from '@mui/material';
import { Info as InfoIcon, Close as CloseIcon } from '@mui/icons-material';
import { getAppVersion, getBuildTime } from '../../utils/version';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose }) => {
  const version = getAppVersion();
  const buildTime = getBuildTime();
  const buildDate = buildTime ? new Date(buildTime).toLocaleDateString() : 'Unknown';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon color="primary" />
        About SaaR Core Banking System
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          {/* Application Info */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Application Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Version:
                </Typography>
                <Chip label={`v${version}`} color="primary" variant="outlined" />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="textSecondary">
                  Build Date:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {buildDate}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="textSecondary">
                  Environment:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Company Info */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Company Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Product:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  SaaR Core Banking System
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Developer:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  SaaR Banking Solutions
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Copyright:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  © 2024 SaaR Banking Solutions. All rights reserved.
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Features */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Key Features
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[
                'Account Management',
                'Transaction Processing',
                'Loan Origination',
                'Expression Builder',
                'Workflow Orchestration',
                'Regulatory Compliance',
                'Real-time Analytics'
              ].map((feature) => (
                <Chip
                  key={feature}
                  label={feature}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutDialog;
