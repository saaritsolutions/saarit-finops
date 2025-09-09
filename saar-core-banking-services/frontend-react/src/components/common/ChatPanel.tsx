import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';

export interface ChatPanelProps {
  title?: string;
  placeholder?: string;
  helperText?: string;
  sending?: boolean;
  onSend: (message: string) => Promise<void> | void;
  defaultMessage?: string;
  actionLabel?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  title = 'AI Assistant',
  placeholder = 'Type your instruction…',
  helperText,
  sending,
  onSend,
  defaultMessage = '',
  actionLabel = 'Ask AI',
}) => {
  const [msg, setMsg] = useState<string>(defaultMessage);

  const handleSend = async () => {
    const text = msg.trim();
    if (!text) return;
    await onSend(text);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>{title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            placeholder={placeholder}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ 'aria-label': 'Type your instruction', 'data-testid': 'chat-input' }}
          />
          <Box display="flex" alignItems="flex-start">
            <Button variant="outlined" onClick={handleSend} disabled={!!sending || !msg.trim()} data-testid="chat-send">{actionLabel}</Button>
          </Box>
        </Stack>
        {helperText && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {helperText}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatPanel;
