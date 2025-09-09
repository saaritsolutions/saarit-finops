import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import StatusBanner from '../components/common/StatusBanner';
import ChatPanel from '../components/common/ChatPanel';
import SchemaForm from '../components/forms/SchemaForm';
import type { FormSchema } from '../services/aiFormService';
import expressionService from '../services/expressionService';

export default function AdminConfig() {
  const [workflowJson, setWorkflowJson] = useState('');
  const [schemaJson, setSchemaJson] = useState('');
  const [loading, setLoading] = useState(false);
  const baseUrl = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
  const aiBase = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const workflowType = 'LOAN_ORIGINATION';
  const productType = 'personal_loan';
  const [msg, setMsg] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [exprOutput, setExprOutput] = useState('');
  const [exprMsg, setExprMsg] = useState<string | null>(null);
  const [exprId, setExprId] = useState('EXPR_LOAN_E2E');

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

  // Allow deep linking to a specific tab via ?tab=form|workflow|expressions
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const t = (qs.get('tab') || '').toLowerCase();
      if (t === 'form') setTab(0);
      else if (t === 'workflow') setTab(1);
      else if (t === 'expressions') setTab(2);
    } catch { /* ignore */ }
  }, []);

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

  const chatWorkflow = async (message: string) => {
    setChatMsg(null);
    try {
      const res = await fetch(`${aiBase}/api/aiworkflow/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentWorkflowJson: workflowJson, workflowType })
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const text = await res.text();
      JSON.parse(text);
      setWorkflowJson(text);
      setChatMsg('Workflow updated from AI');
    } catch (e:any) {
      setChatMsg(e?.message || 'Failed to update workflow from AI');
    }
  };

  const chatExpression = async (message: string) => {
    setExprOutput('');
    setExprMsg(null);
    try {
      const res = await fetch(`${aiBase}/api/aiexpression/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, category: 'expression' })
      });
      if (!res.ok) throw new Error(`Expression chat failed (${res.status})`);
      const json = await res.json();
      // Controller returns { response: string | object }
      let content = '';
      const resp = json?.response;
      if (typeof resp === 'string') {
        content = resp;
      } else if (resp && typeof resp === 'object') {
        // Try common keys first
        const maybe = resp.expressionText || resp.expression || resp.content || resp.text;
        if (typeof maybe === 'string' && maybe.trim()) {
          content = maybe;
        } else {
          content = JSON.stringify(resp, null, 2);
        }
      }
      setExprOutput(content);
    } catch (e: any) {
      setExprOutput(e?.message || 'Failed to get expression from AI');
    }
  };

  const extractRawExpression = (text: string): string | null => {
    if (!text) return null;
    // If JSON-ish, try to parse and pick known fields
    try {
      const obj = JSON.parse(text);
      const maybe = obj?.expressionText || obj?.expression || obj?.content || obj?.text;
      if (typeof maybe === 'string' && maybe.trim()) return maybe.trim();
    } catch { /* ignore */ }
    // Try to extract the first fenced code block
    const fence = text.match(/```[a-zA-Z0-9]*\n([\s\S]*?)```/);
    if (fence && fence[1]) return fence[1].trim();
    // If it looks like an inline C# ternary we expect, just return trimmed
    if (/\?\s*"APPROVED"\s*:\s*"DECLINED"/i.test(text) || /\bAND\b|&&|\|\|/.test(text)) {
      return text.trim();
    }
    return null;
  };

  const saveExpressionFromAI = async () => {
    setExprMsg(null);
    const raw = extractRawExpression(exprOutput);
    if (!raw) {
      setExprMsg('Could not parse expression from AI response. Ask for "expression only".');
      return;
    }
    try {
      // Check if expression exists by expressionId
      let existing: any | null = null;
      try {
        existing = await expressionService.getExpressionByExpressionId(exprId);
      } catch { existing = null; }

      if (existing && existing.id) {
        await expressionService.updateExpression(existing.id, { expressionText: raw });
        setExprMsg(`Expression ${exprId} updated.`);
      } else {
        await expressionService.createExpression({
          expressionId: exprId,
          name: 'Loan Eligibility (AI)',
          description: 'Generated via Admin Config AI',
          category: 'Validation',
          subCategory: 'Loan',
          expressionText: raw,
          returnType: 'string',
          contextType: 'Loan',
          usageType: 'Validation',
          tags: ['ai', 'eligibility'],
          variables: {}
        });
        setExprMsg(`Expression ${exprId} created.`);
      }
    } catch (e: any) {
      setExprMsg(e?.message || 'Failed to save expression');
    }
  };

  const parsedSchema: FormSchema | null = useMemo(() => {
    try { return JSON.parse(schemaJson); } catch { return null; }
  }, [schemaJson]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin Config</Typography>
      <StatusBanner message={`LoanService: ${baseUrl} | ExpressionBuilderService (AI): ${aiBase}`} severity="info" />
      <StatusBanner message={msg} severity="info" />
      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Admin Config Tabs" variant="scrollable" scrollButtons="auto">
          <Tab label={`Form (${productType})`} />
          <Tab label={`Workflow (${workflowType})`} />
          <Tab label="Expressions" data-testid="tab-expressions" />
        </Tabs>
        <Divider sx={{ mb: 2 }} />

        {tab === 0 && (
          <Box>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Form Schema JSON</Typography>
                  <TextField multiline minRows={12} value={schemaJson} onChange={(e) => setSchemaJson(e.target.value)} fullWidth spellCheck={false} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button variant="contained" onClick={saveSchema} disabled={loading}>Save Schema</Button>
                    <Button variant="outlined" onClick={fetchAll} disabled={loading}>Reload</Button>
                  </Stack>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Live Preview</Typography>
                  {parsedSchema ? (
                    <SchemaForm schema={parsedSchema} values={{}} onChange={() => {}} />
                  ) : (
                    <Typography color="text.secondary">Invalid JSON. Fix the schema to preview.</Typography>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        )}

        {tab === 1 && (
          <Box>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Workflow Definition</Typography>
                  <Typography variant="body2" color="text.secondary">Use conditionExpressionId to link steps with Expression IDs (e.g., EXPR_IS_HIGH_RISK). Save to apply instantly.</Typography>
                  <TextField multiline minRows={12} value={workflowJson} onChange={(e) => setWorkflowJson(e.target.value)} fullWidth spellCheck={false} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button variant="contained" onClick={saveWorkflow} disabled={loading}>Save Workflow</Button>
                    <Button variant="outlined" onClick={fetchAll} disabled={loading}>Reload</Button>
                  </Stack>
                </CardContent>
              </Card>

              <ChatPanel
                title="AI Assistant (Workflow)"
                placeholder="e.g., Add required action KYC_VERIFY to KYC; Insert step Risk Assessment before Credit Check"
                helperText={!process.env.REACT_APP_EXPRESSION_API_URL ? 'REACT_APP_EXPRESSION_API_URL is not set; using default http://localhost:5004' : undefined}
                sending={loading}
                onSend={chatWorkflow}
                actionLabel="Apply"
              />
              <StatusBanner message={chatMsg} severity="info" />
            </Stack>
          </Box>
        )}

        {tab === 2 && (
          <Box>
            <Stack spacing={2}>
              <ChatPanel
                title="AI Assistant (Expressions)"
                placeholder="e.g., Build an expression for KYC: customer.Age >= 18 AND customer.Status = 'ACTIVE'"
                sending={loading}
                onSend={chatExpression}
                actionLabel="Generate"
              />
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>AI Response</Typography>
                  <TextField value={exprOutput} onChange={() => {}} multiline minRows={12} fullWidth spellCheck={false} inputProps={{ 'data-testid': 'ai-expression-output' }} />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      label="Expression ID"
                      value={exprId}
                      onChange={(e) => setExprId(e.target.value)}
                      inputProps={{ 'data-testid': 'expression-id-input' }}
                    />
                    <Button variant="contained" onClick={saveExpressionFromAI} data-testid="save-ai-expression">Save Expression</Button>
                  </Stack>
                  {exprMsg && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{exprMsg}</Typography>}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
