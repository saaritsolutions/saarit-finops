import React from 'react';
import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material';

export interface WorkflowTimelineProps {
  events: string[];
  title?: string;
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ events, title }) => {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Box>
      {title && (
        <Typography fontWeight={600} sx={{ mb: 1 }}>{title}</Typography>
      )}
      <Stepper activeStep={events.length - 1} orientation="vertical" nonLinear>
        {events.map((e, i) => (
          <Step key={`${e}-${i}`} completed={i < events.length - 1}>
            <StepLabel>{e}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default WorkflowTimeline;
