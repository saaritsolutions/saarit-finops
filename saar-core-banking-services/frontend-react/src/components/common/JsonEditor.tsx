import React from 'react';
import { Box, TextField } from '@mui/material';

interface JsonEditorProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  height = '200px',
  placeholder = 'Enter JSON...',
  readOnly = false
}) => {
  const [jsonString, setJsonString] = React.useState(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  });
  
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    try {
      const formatted = JSON.stringify(value, null, 2);
      setJsonString(formatted);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setJsonString(newValue);

    try {
      const parsed = JSON.parse(newValue);
      onChange(parsed);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  return (
    <Box>
      <TextField
        multiline
        fullWidth
        value={jsonString}
        onChange={handleChange}
        placeholder={placeholder}
        error={!!error}
        helperText={error}
        InputProps={{
          readOnly,
          sx: {
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }
        }}
        sx={{
          '& .MuiInputBase-root': {
            height: height,
            alignItems: 'flex-start',
          },
          '& .MuiInputBase-input': {
            height: `calc(${height} - 16px) !important`,
            overflow: 'auto !important',
          }
        }}
      />
    </Box>
  );
};
