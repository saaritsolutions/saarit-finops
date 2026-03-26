import React, { useState } from 'react';
import {
  Box, Chip, Collapse, IconButton, Stack,
  Step, StepLabel, Stepper, Tooltip, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ReplayIcon from '@mui/icons-material/Replay';
import NotesIcon from '@mui/icons-material/Notes';

export type WorkflowStepStatus = 'completed' | 'active' | 'failed' | 'pending';

export interface WorkflowEvent {
  label: string;
  status?: WorkflowStepStatus;
  /** ISO string — when the step was reached */
  timestamp?: string;
  /** ISO string — the SLA deadline for this step */
  slaDueAt?: string;
  /** Optional notes/comments (expandable) */
  notes?: string;
}

export interface WorkflowTimelineProps {
  events: (WorkflowEvent | string)[];
  title?: string;
  onRetry?: (index: number) => void;
  onNoteChange?: (index: number, note: string) => void;
}

function normalise(e: WorkflowEvent | string): WorkflowEvent {
  return typeof e === 'string' ? { label: e, status: 'completed' } : e;
}

function formatSla(slaDueAt: string): { label: string; color: 'default' | 'warning' | 'error' } {
  const due = new Date(slaDueAt).getTime();
  const diffMs = due - Date.now();
  const diffH = Math.round(Math.abs(diffMs) / 1000 / 60 / 60);

  if (diffMs < 0) return { label: `Overdue ${diffH}h`, color: 'error' };
  if (diffH < 4)  return { label: `Due in ${diffH}h`, color: 'warning' };
  return { label: `Due in ${diffH}h`, color: 'default' };
}

function StatusIcon({ status }: { status: WorkflowStepStatus }) {
  switch (status) {
    case 'completed': return <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 22 }} />;
    case 'failed':    return <ErrorOutlineIcon       sx={{ color: 'error.main',   fontSize: 22 }} />;
    case 'active':    return <RadioButtonCheckedIcon  sx={{ color: 'primary.main', fontSize: 22 }} />;
    default:          return <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 22 }} />;
  }
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  events,
  title,
  onRetry,
}) => {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  if (!events || events.length === 0) return null;

  const normalised = events.map(normalise);

  // Find the last 'active' step index to drive the Stepper highlight
  let displayActiveStep = normalised.length - 1;
  for (let i = normalised.length - 1; i >= 0; i--) {
    if (normalised[i].status === 'active') { displayActiveStep = i; break; }
  }

  const toggleNotes = (i: number) => {
    setExpandedNotes((prev: Set<number>) => {
      const next = new Set<number>(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <Box>
      {title && (
        <Typography fontWeight={600} sx={{ mb: 1 }}>{title}</Typography>
      )}
      <Stepper activeStep={displayActiveStep} orientation="vertical" nonLinear>
        {normalised.map((e: WorkflowEvent, i: number) => {
          const status: WorkflowStepStatus = e.status ?? 'pending';
          const slaInfo = e.slaDueAt ? formatSla(e.slaDueAt) : null;
          const isExpanded = expandedNotes.has(i);

          return (
            <Step key={`${e.label}-${i}`} completed={status === 'completed'}>
              <StepLabel
                icon={<StatusIcon status={status} />}
                optional={
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
                    {e.timestamp && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    )}
                    {slaInfo && (
                      <Chip
                        label={slaInfo.label}
                        color={slaInfo.color}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                      />
                    )}
                    {status === 'failed' && onRetry && (
                      <Tooltip title="Retry this step">
                        <IconButton size="small" onClick={() => onRetry(i)} sx={{ p: 0.25 }}>
                          <ReplayIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {e.notes && (
                      <Tooltip title={isExpanded ? 'Hide notes' : 'Show notes'}>
                        <IconButton size="small" onClick={() => toggleNotes(i)} sx={{ p: 0.25 }}>
                          <NotesIcon fontSize="small" color={isExpanded ? 'primary' : 'action'} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                }
              >
                <Typography
                  variant="body2"
                  fontWeight={status === 'active' ? 600 : 400}
                  color={status === 'failed' ? 'error.main' : 'inherit'}
                >
                  {e.label}
                </Typography>
              </StepLabel>
              {e.notes && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ ml: 4, mb: 1, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {e.notes}
                    </Typography>
                  </Box>
                </Collapse>
              )}
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
};

export default WorkflowTimeline;
