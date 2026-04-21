import React from 'react';
import { Box, TextField, MenuItem, FormControlLabel, Checkbox, Typography, Divider, Stack } from '@mui/material';
import type { FormSchema, FormField } from '../../services/aiFormService';

export interface SchemaFormProps {
  schema: FormSchema;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  readonly?: boolean;
}

// Returns a formatted display value for masked fields (Aadhaar spaced as XXXX XXXX XXXX)
function getMaskedDisplay(name: string, val: any): string {
  const n = name.toLowerCase();
  if (n === 'aadharnumber' || n === 'aadhar' || n === 'aadhaar') {
    const digits = String(val ?? '').replace(/\D/g, '');
    return digits.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' ')
    );
  }
  return val ?? '';
}

// Returns a masked onChange handler for PAN / Aadhaar / phone fields; null = use default
function getMaskedHandler(
  name: string,
  onChange: (n: string, v: any) => void
): ((e: React.ChangeEvent<HTMLInputElement>) => void) | null {
  const n = name.toLowerCase();
  if (n === 'pannumber' || n === 'pan') {
    return (e) => {
      const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      onChange(name, raw);
    };
  }
  if (n === 'aadharnumber' || n === 'aadhar' || n === 'aadhaar') {
    return (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
      onChange(name, digits);
    };
  }
  if (n === 'mobilenumber' || n === 'mobile' || n === 'phone') {
    return (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      onChange(name, digits);
    };
  }
  return null;
}

function getPlaceholder(name: string): string {
  const n = name.toLowerCase();
  if (n === 'pannumber' || n === 'pan') return 'ABCDE1234F';
  if (n === 'aadharnumber' || n === 'aadhar' || n === 'aadhaar') return 'XXXX XXXX XXXX';
  if (n === 'mobilenumber' || n === 'mobile' || n === 'phone') return '9876543210';
  return '';
}

const renderField = (f: FormField, val: any, onChange: (n: string, v: any) => void) => {
  const maskedHandler = getMaskedHandler(f.name, onChange);
  const displayValue = maskedHandler ? getMaskedDisplay(f.name, val) : (val ?? '');
  const placeholder = getPlaceholder(f.name);

  const common = {
    fullWidth: true,
    label: f.label,
    value: displayValue,
    onChange: maskedHandler ?? ((e: React.ChangeEvent<HTMLInputElement>) => onChange(f.name, e.target.value)),
    required: !!f.required,
    helperText: f.description,
    size: 'small' as const,
    margin: 'dense' as const,
    inputProps: { 'data-testid': `field-${f.name}`, name: f.name, ...(placeholder ? { placeholder } : {}) },
  };

  switch (f.type) {
    case 'number':
      return <TextField type="number" {...common} />;
    case 'date':
      return <TextField type="date" {...common} InputLabelProps={{ shrink: true }} />;
    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={!!val}
              onChange={(e) => onChange(f.name, e.target.checked)}
              slotProps={{ input: { 'data-testid': `field-${f.name}`, name: f.name } as any }}
            />
          }
          label={f.label}
        />
      );
    case 'select':
      return (
        <TextField select {...common}>
          {(f.options || []).map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
      );
    case 'textarea':
      return <TextField multiline minRows={3} {...common} />;
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
