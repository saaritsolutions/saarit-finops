import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Stack, TextField, Typography, Alert } from '@mui/material';
import { aiFormService, type FormSchema } from '../services/aiFormService';
import SchemaForm from '../components/forms/SchemaForm';
import { loanDetailedSchema } from '../schemas/loanDetailedSchema';

const pretty = (obj: any) => JSON.stringify(obj, null, 2);

const DEFAULT_SCHEMA: FormSchema = loanDetailedSchema;

const AIDynamicFormDesigner: React.FC = () => {
  const [schema, setSchema] = useState<FormSchema>(DEFAULT_SCHEMA);
  const [schemaText, setSchemaText] = useState(pretty(DEFAULT_SCHEMA));
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Try load last applied on mount
    (async () => {
      const last = await aiFormService.getLastApplied();
      if (last) {
        setSchema(last);
        setSchemaText(pretty(last));
      }
  // Initialize values keys based on schema
  const vals: Record<string, any> = {};
  for (const f of (DEFAULT_SCHEMA.fields || [])) vals[f.name] = '';
  setValues(vals);
    })();
  }, []);

  const currentSchemaJson = useMemo(() => {
    try { return JSON.stringify(JSON.parse(schemaText)); } catch { return JSON.stringify(schema); }
  }, [schemaText, schema]);

  const runPrompt = async () => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const result = await aiFormService.chatSchema({
        Message: prompt,
        CurrentSchemaJson: currentSchemaJson,
        Category: 'form',
        FormOnly: true,
      });
      setSchema(result);
      setSchemaText(pretty(result));
      setMsg('Schema updated from AI');
  // sync values keys
  const vals: Record<string, any> = { ...values };
  for (const f of (result.fields || [])) if (!(f.name in vals)) vals[f.name] = '';
  setValues(vals);
    } catch (e: any) {
      setError(e?.message || 'Failed to update schema');
    } finally {
      setLoading(false);
    }
  };

  const applySchema = async () => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const success = await aiFormService.apply({
        Explanation: 'apply from UI',
        SuggestedFields: [],
        SchemaJson: currentSchemaJson,
        Confidence: 'high',
        IsValid: true,
        Transcript: prompt,
      });
      if (success?.success) setMsg('Schema applied'); else setError('Apply failed');
    } catch (e: any) {
      setError(e?.message || 'Apply failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={2}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>AI Dynamic Form Designer</Typography>
      <Box sx={{
        display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
      }}>
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>AI Prompt</Typography>
              <TextField
                placeholder="e.g., Add fields mobileNumber (text, required), dateOfBirth (date)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                fullWidth
                multiline
                minRows={3}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button variant="contained" onClick={runPrompt} disabled={loading || !prompt.trim()}>Update Schema</Button>
                <Button variant="outlined" onClick={applySchema} disabled={loading}>Apply</Button>
              </Stack>
              {loading && <Alert sx={{ mt: 1 }} severity="info">Working…</Alert>}
              {msg && <Alert sx={{ mt: 1 }} severity="success">{msg}</Alert>}
              {error && <Alert sx={{ mt: 1 }} severity="error">{error}</Alert>}
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Tips: "Add fields panNumber (text, required), income (number)", "Make age required", "Remove middleName".
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Schema JSON</Typography>
              <TextField
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                fullWidth
                multiline
                minRows={18}
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: { xs: '1', md: '1 / span 2' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Live Preview</Typography>
              <SchemaForm schema={schema} values={values} onChange={(n,v)=>setValues(s=>({ ...s, [n]: v }))} />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default AIDynamicFormDesigner;
