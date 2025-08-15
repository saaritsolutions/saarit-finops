import React from 'react';
import { Box, TextField } from '@mui/material';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'text',
  height = '200px',
  placeholder = 'Enter code...',
  readOnly = false
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <Box>
      <TextField
        multiline
        fullWidth
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        InputProps={{
          readOnly,
          sx: {
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '0.875rem',
            backgroundColor: readOnly ? 'grey.50' : 'background.paper',
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
