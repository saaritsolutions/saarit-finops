import React from 'react';
import { Box, TextField, MenuItem, FormControlLabel, Checkbox, Typography, Divider, Stack } from '@mui/material';
import type { FormSchema, FormField } from '../../services/aiFormService';

export interface SchemaFormProps {
  schema: FormSchema;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  readonly?: boolean;
}

const renderField = (f: FormField, val: any, onChange: (n: string, v: any) => void) => {
  const common = {
    fullWidth: true,
    label: f.label,
    value: val ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(f.name, e.target.value),
    required: !!f.required,
    helperText: f.description,
    size: 'small' as const,
    margin: 'dense' as const,
  };

  switch (f.type) {
    case 'number':
      return <TextField type="number" {...common} />;
    case 'date':
      return <TextField type="date" {...common} InputLabelProps={{ shrink: true }} />;
    case 'boolean':
      return <FormControlLabel control={<Checkbox checked={!!val} onChange={(e) => onChange(f.name, e.target.checked)} />} label={f.label} />;
    case 'select':
      return (
        <TextField select {...common}>
          {(f.options || []).map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
      );
    default:
      return <TextField {...common} />;
  }
};

export const SchemaForm: React.FC<SchemaFormProps> = ({ schema, values, onChange, readonly }) => {
  const bySection = new Map<string, FormField[]>();
  const fields = schema.fields || [];
  for (const f of fields) {
    const key = f.section || 'General';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(f);
  }

  const order = schema.sections?.map(s => s.key) || Array.from(bySection.keys());

  return (
    <Box>
      {order.map((secKey) => {
        const secFields = bySection.get(secKey) || [];
        if (secFields.length === 0) return null;
        const secMeta = schema.sections?.find(s => s.key === secKey);
        return (
          <Box key={secKey} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>{secMeta?.title || secKey}</Typography>
            {secMeta?.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{secMeta.description}</Typography>}
            <Stack spacing={1}>
              {secFields.map(f => (
                <Box key={f.name}>
                  {renderField(f, values[f.name], onChange)}
                </Box>
              ))}
            </Stack>
            <Divider sx={{ mt: 2 }} />
          </Box>
        );
      })}
    </Box>
  );
};

export default SchemaForm;
