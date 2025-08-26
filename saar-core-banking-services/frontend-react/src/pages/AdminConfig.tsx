import { useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';

export default function AdminConfig() {
  const [workflowJson, setWorkflowJson] = useState('');
  const [schemaJson, setSchemaJson] = useState('');
  const [loading, setLoading] = useState(false);
  const baseUrl = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
  const workflowType = 'LOAN_ORIGINATION';
  const productType = 'personal_loan';
  const [msg, setMsg] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const wf = await fetch(`${baseUrl}/api/admin/config/workflow/${workflowType}`).then(r => r.json());
      setWorkflowJson(JSON.stringify(wf, null, 2));
      const schema = await fetch(`${baseUrl}/api/admin/config/forms/${productType}`).then(r => r.text());
      setSchemaJson(schema);
    } catch (e:any) {
      setMsg(e?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveWorkflow = async () => {
    setMsg(null);
    await fetch(`${baseUrl}/api/admin/config/workflow/${workflowType}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: workflowJson });
    setMsg('Workflow saved');
  };

  const saveSchema = async () => {
    setMsg(null);
    await fetch(`${baseUrl}/api/admin/config/forms/${productType}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: schemaJson });
    setMsg('Form schema saved');
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin Config</Typography>
      {msg && <Alert severity="info" sx={{ mb: 2 }}>{msg}</Alert>}
      <Paper sx={{ p:2, mb:2 }}>
        <Typography variant="h6">Workflow Definition ({workflowType})</Typography>
        <Typography variant="body2" color="text.secondary">Hint: Use conditionExpressionId to link steps with Expression IDs (e.g., EXPR_IS_HIGH_RISK). Save to apply instantly.</Typography>
        <Stack spacing={1} sx={{ mt:1 }}>
          <TextField multiline minRows={10} value={workflowJson} onChange={(e) => setWorkflowJson(e.target.value)} fullWidth />
          <Button variant="contained" onClick={saveWorkflow} disabled={loading}>Save Workflow</Button>
        </Stack>
      </Paper>
      <Paper sx={{ p:2 }}>
        <Typography variant="h6">Form Schema ({productType})</Typography>
        <Stack spacing={1} sx={{ mt:1 }}>
          <TextField multiline minRows={10} value={schemaJson} onChange={(e) => setSchemaJson(e.target.value)} fullWidth />
          <Button variant="contained" onClick={saveSchema} disabled={loading}>Save Schema</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
