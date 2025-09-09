import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiFormService, type FormSchema } from '../services/aiFormService';
import SchemaForm from '../components/forms/SchemaForm';
import { loanDetailedSchema } from '../schemas/loanDetailedSchema';
import { getFormSchema as getLoanFormSchema } from '../services/loanOriginationService';
import ChatPanel from '../components/common/ChatPanel';
import StatusBanner from '../components/common/StatusBanner';

const pretty = (obj: any) => JSON.stringify(obj, null, 2);

const DEFAULT_SCHEMA: FormSchema = loanDetailedSchema;

const AIDynamicFormDesigner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const productType = params.get('productType') || 'personal_loan';
  const returnTo = params.get('returnTo');
  const [schema, setSchema] = useState<FormSchema>(DEFAULT_SCHEMA);
  const [schemaText, setSchemaText] = useState(pretty(DEFAULT_SCHEMA));
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Try load current schema: prefer LoanService for productType when dynamic enabled, else last applied
    (async () => {
      setLoading(true);
      try {
        // Attempt server-provided schema for the selected product type
        const server = await getLoanFormSchema(productType);
        if (server && Array.isArray(server.fields) && server.fields.length > 0) {
          const s: FormSchema = {
            entityName: 'LoanApplication',
            title: 'Loan Application',
            fields: server.fields as any,
          };
          setSchema(s);
          setSchemaText(pretty(s));
        } else {
          const last = await aiFormService.getLastApplied();
          if (last) {
            setSchema(last);
            setSchemaText(pretty(last));
          }
        }
      } catch {
        const last = await aiFormService.getLastApplied();
        if (last) {
          setSchema(last);
          setSchemaText(pretty(last));
        }
      } finally {
        // Initialize values keys based on schema (fallback uses DEFAULT_SCHEMA until state updates)
        const base = schema.fields?.length ? schema : DEFAULT_SCHEMA;
        const vals: Record<string, any> = {};
        for (const f of (base.fields || [])) vals[f.name] = '';
        setValues(vals);
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType]);

  const currentSchemaJson = useMemo(() => {
    try { return JSON.stringify(JSON.parse(schemaText)); } catch { return JSON.stringify(schema); }
  }, [schemaText, schema]);

  const runPrompt = async (text?: string) => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const finalPrompt = (text ?? prompt).trim();
      if (!finalPrompt) { setLoading(false); return; }
      const result = await aiFormService.chatSchema({
        Message: finalPrompt,
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
      if (success?.success) {
        setMsg('Schema applied');
        if (returnTo) {
          // small delay to show feedback
          setTimeout(() => navigate(returnTo), 400);
        }
      } else setError('Apply failed');
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
              <ChatPanel
                title="AI Assistant (Form Designer)"
                placeholder="e.g., Add fields mobileNumber (text, required), dateOfBirth (date)"
                sending={loading}
                onSend={(m) => { setPrompt(m); return runPrompt(m); }}
                actionLabel="Update Schema"
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button variant="outlined" onClick={applySchema} disabled={loading}>{returnTo ? 'Apply & Return' : 'Apply'}</Button>
              </Stack>
              <StatusBanner message={loading ? 'Working…' : null} severity="info" />
              <StatusBanner message={msg} severity="success" />
              <StatusBanner message={error} severity="error" />
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
