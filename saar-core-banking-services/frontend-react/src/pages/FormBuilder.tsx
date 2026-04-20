import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Container,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  Grid,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  RestoreFromTrash as ResetIcon,
} from '@mui/icons-material';
import {
  dynamicFormsService,
  type FormSchemaListItem,
  type FormSchemaHistoryItem,
  type DFSFormField,
  type DFSFormSchema,
  type DFSFormSection,
  type FormSchemaOption,
} from '../services/dynamicFormsService';
import SchemaForm from '../components/forms/SchemaForm';

// ── TabPanel helper ───────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`fb-tabpanel-${index}`}
      aria-labelledby={`fb-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return { id: `fb-tab-${index}`, 'aria-controls': `fb-tabpanel-${index}` };
}

// ── FieldTypeSelect ───────────────────────────────────────────────────────────

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea', 'boolean'] as const;

// ── Main component ────────────────────────────────────────────────────────────

const FormBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  // ── Schemas tab state
  const [schemas, setSchemas]       = useState<FormSchemaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError]   = useState('');

  // ── Field Editor state
  const [selectedType, setSelectedType]   = useState('');
  const [editSchema, setEditSchema]       = useState<DFSFormSchema | null>(null);
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [saveSuccess, setSaveSuccess]     = useState('');
  const [saveError, setSaveError]         = useState('');
  const [loadingSchema, setLoadingSchema] = useState(false);

  // ── Reset confirm dialog
  const [resetTarget, setResetTarget]     = useState<string | null>(null);
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetMsg, setResetMsg]           = useState('');

  // ── History tab state
  const [historyType, setHistoryType]     = useState('');
  const [history, setHistory]             = useState<FormSchemaHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError]   = useState('');
  const [viewJsonItem, setViewJsonItem]   = useState<FormSchemaHistoryItem | null>(null);

  // ── Load schema list on mount ─────────────────────────────────────────────

  const loadSchemas = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const data = await dynamicFormsService.listSchemas();
      setSchemas(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadSchemas(); }, [loadSchemas]);

  // ── Load a schema into the editor ─────────────────────────────────────────

  const loadIntoEditor = useCallback(async (formType: string) => {
    setLoadingSchema(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const resp = await dynamicFormsService.getSchema(formType);
      const parsed: DFSFormSchema = JSON.parse(resp.schema);
      setSelectedType(formType.toUpperCase());
      setEditSchema(parsed);
      setSelectedFieldName(null);
      setNotes('');
      setActiveTab(1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoadingSchema(false);
    }
  }, []);

  // ── Load history ──────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (formType: string) => {
    if (!formType) return;
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const data = await dynamicFormsService.getHistory(formType);
      setHistory(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 3 && historyType) loadHistory(historyType);
  }, [activeTab, historyType, loadHistory]);

  // ── Derived: selected field object ────────────────────────────────────────

  const selectedField: DFSFormField | null =
    editSchema && selectedFieldName
      ? (editSchema.fields.find(f => f.name === selectedFieldName) ?? null)
      : null;

  // ── Field editor helpers ──────────────────────────────────────────────────

  const updateField = (patch: Partial<DFSFormField>) => {
    if (!editSchema || !selectedFieldName) return;
    setEditSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map(f =>
          f.name === selectedFieldName ? { ...f, ...patch } : f
        ),
      };
    });
  };

  const moveField = (fieldName: string, direction: 'up' | 'down', sectionKey: string) => {
    if (!editSchema) return;
    const section = editSchema.sections?.find(s => s.key === sectionKey);
    if (!section) return;

    const sectionFieldNames = section.fields;
    const idx = sectionFieldNames.indexOf(fieldName);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sectionFieldNames.length) return;

    // Reorder in section.fields
    const newSectionFields = [...sectionFieldNames];
    [newSectionFields[idx], newSectionFields[newIdx]] = [newSectionFields[newIdx], newSectionFields[idx]];

    // Reorder in schema.fields (maintaining relative order within section)
    const allFields = [...editSchema.fields];
    const sectionFieldObjects = newSectionFields
      .map(n => allFields.find(f => f.name === n))
      .filter(Boolean) as DFSFormField[];
    const otherFields = allFields.filter(f => f.section !== sectionKey);

    // Rebuild fields: insert section fields in their new order after the last non-section field before them
    const rebuiltFields: DFSFormField[] = [];
    let sectionInserted = false;
    for (const f of allFields) {
      if (f.section === sectionKey) {
        if (!sectionInserted) {
          rebuiltFields.push(...sectionFieldObjects);
          sectionInserted = true;
        }
      } else {
        rebuiltFields.push(f);
      }
    }
    // fallback: if no fields had this section before
    if (!sectionInserted) {
      rebuiltFields.push(...sectionFieldObjects, ...otherFields);
    }

    setEditSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: rebuiltFields,
        sections: prev.sections?.map(s =>
          s.key === sectionKey ? { ...s, fields: newSectionFields } : s
        ),
      };
    });
  };

  const deleteField = (fieldName: string, sectionKey: string) => {
    if (!editSchema) return;
    if (selectedFieldName === fieldName) setSelectedFieldName(null);
    setEditSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.filter(f => f.name !== fieldName),
        sections: prev.sections?.map(s =>
          s.key === sectionKey
            ? { ...s, fields: s.fields.filter(n => n !== fieldName) }
            : s
        ),
      };
    });
  };

  const addField = (sectionKey: string) => {
    if (!editSchema) return;
    const newName = `field_${Date.now()}`;
    const newField: DFSFormField = {
      name:    newName,
      label:   'New Field',
      type:    'text',
      section: sectionKey,
    };
    setEditSchema(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: [...prev.fields, newField],
        sections: prev.sections?.map(s =>
          s.key === sectionKey ? { ...s, fields: [...s.fields, newName] } : s
        ),
      };
    });
    setSelectedFieldName(newName);
  };

  // ── Save schema ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!editSchema || !selectedType) return;
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const resp = await dynamicFormsService.saveSchema(selectedType, {
        schema: JSON.stringify(editSchema),
        notes:  notes || undefined,
      });
      setSaveSuccess(`Saved v${resp.version}`);
      setNotes('');
      loadSchemas();  // refresh list
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset schema ──────────────────────────────────────────────────────────

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    setResetMsg('');
    try {
      await dynamicFormsService.resetSchema(resetTarget);
      setResetMsg(`'${resetTarget}' reset to public default.`);
      loadSchemas();
    } catch (err) {
      setResetMsg(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  // ── History helpers ───────────────────────────────────────────────────────

  const openHistory = (formType: string) => {
    setHistoryType(formType);
    setActiveTab(3);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Form Builder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Visually edit bank form schemas. Changes are versioned and tenant-specific.
      </Typography>

      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            aria-label="form-builder-tabs"
          >
            <Tab label="Schemas" {...a11yProps(0)} />
            <Tab label="Field Editor" {...a11yProps(1)} disabled={!editSchema} />
            <Tab label="Preview" {...a11yProps(2)} disabled={!editSchema} />
            <Tab label="History" {...a11yProps(3)} />
          </Tabs>
        </Box>

        {/* ── Tab 0: Schemas List ──────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={0}>
          {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}
          {resetMsg  && (
            <Alert severity={resetMsg.includes('failed') ? 'error' : 'success'} sx={{ mb: 2 }}
              onClose={() => setResetMsg('')}>{resetMsg}</Alert>
          )}
          {loadingList ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Form Type</strong></TableCell>
                    <TableCell><strong>Tenant</strong></TableCell>
                    <TableCell><strong>Version</strong></TableCell>
                    <TableCell><strong>Active</strong></TableCell>
                    <TableCell><strong>Default</strong></TableCell>
                    <TableCell><strong>Updated By</strong></TableCell>
                    <TableCell><strong>Updated At</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schemas.map((s, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {s.formType}
                        </Typography>
                      </TableCell>
                      <TableCell>{s.tenantId}</TableCell>
                      <TableCell>
                        <Chip label={`v${s.version}`} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {s.isActive
                          ? <Chip label="Active" size="small" color="success" />
                          : <Chip label="Inactive" size="small" />}
                      </TableCell>
                      <TableCell>
                        {s.isDefault && <Chip label="Default" size="small" color="info" />}
                      </TableCell>
                      <TableCell>{s.updatedBy ?? '—'}</TableCell>
                      <TableCell>{new Date(s.updatedAt).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit in Field Editor">
                            <IconButton
                              size="small"
                              aria-label={`Edit ${s.formType}`}
                              onClick={() => loadIntoEditor(s.formType)}
                              disabled={loadingSchema}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View History">
                            <IconButton
                              size="small"
                              aria-label={`History ${s.formType}`}
                              onClick={() => openHistory(s.formType)}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={s.isDefault ? 'Cannot reset public default' : 'Reset to public default'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={`Reset ${s.formType}`}
                                onClick={() => setResetTarget(s.formType)}
                                disabled={s.isDefault}
                              >
                                <ResetIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {schemas.length === 0 && !loadingList && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">No schemas found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 1: Field Editor ───────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={1}>
          {editSchema && (
            <>
              {/* Top action bar */}
              <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Form Type</InputLabel>
                  <Select
                    value={selectedType}
                    label="Form Type"
                    onChange={e => loadIntoEditor(e.target.value)}
                  >
                    {[...new Set(schemas.map(s => s.formType))].map(ft => (
                      <MenuItem key={ft} value={ft}>{ft}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Version Notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                  placeholder="Optional note for this version"
                />

                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                  aria-label="Save schema"
                >
                  Save
                </Button>

                {saveSuccess && (
                  <Chip label={saveSuccess} color="success" onDelete={() => setSaveSuccess('')} />
                )}
                {saveError && (
                  <Chip label={saveError} color="error" onDelete={() => setSaveError('')} />
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Split pane: left = sections/fields, right = property editor */}
              <Grid container spacing={2}>
                {/* Left panel: section accordions */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>
                    Sections &amp; Fields — click a field to edit its properties
                  </Typography>
                  {(editSchema.sections ?? []).map(section => (
                    <FieldSectionAccordion
                      key={section.key}
                      section={section}
                      fields={editSchema.fields.filter(f => f.section === section.key)}
                      selectedFieldName={selectedFieldName}
                      onSelect={setSelectedFieldName}
                      onMove={(name, dir) => moveField(name, dir, section.key)}
                      onDelete={name => deleteField(name, section.key)}
                      onAdd={() => addField(section.key)}
                    />
                  ))}
                  {/* Fields with no section */}
                  {editSchema.fields.filter(f => !f.section).length > 0 && (
                    <FieldSectionAccordion
                      key="__unsectioned"
                      section={{ key: '__unsectioned', title: 'Other Fields', fields: editSchema.fields.filter(f => !f.section).map(f => f.name) }}
                      fields={editSchema.fields.filter(f => !f.section)}
                      selectedFieldName={selectedFieldName}
                      onSelect={setSelectedFieldName}
                      onMove={(name, dir) => moveField(name, dir, '__unsectioned')}
                      onDelete={name => deleteField(name, '__unsectioned')}
                      onAdd={() => addField('__unsectioned')}
                    />
                  )}
                </Grid>

                {/* Right panel: field property editor */}
                <Grid item xs={12} md={6}>
                  {selectedField ? (
                    <FieldPropertyEditor field={selectedField} onChange={updateField} />
                  ) : (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        Select a field on the left to edit its properties.
                      </Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </>
          )}
        </TabPanel>

        {/* ── Tab 2: Preview ────────────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={2}>
          {editSchema && (
            <>
              <Typography variant="subtitle2" color="text.secondary" mb={2}>
                Live preview of the current editor state (not saved yet). Read-only.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <SchemaForm
                  schema={editSchema as any}
                  values={{}}
                  onChange={() => {}}
                  readonly={true}
                />
              </Paper>
            </>
          )}
        </TabPanel>

        {/* ── Tab 3: History ───────────────────────────────────────────────── */}
        <TabPanel value={activeTab} index={3}>
          <Box display="flex" gap={2} alignItems="center" mb={2}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Form Type</InputLabel>
              <Select
                value={historyType}
                label="Form Type"
                onChange={e => { setHistoryType(e.target.value); loadHistory(e.target.value); }}
              >
                {[...new Set(schemas.map(s => s.formType))].map(ft => (
                  <MenuItem key={ft} value={ft}>{ft}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {loadingHistory && <CircularProgress size={20} />}
          </Box>

          {historyError && <Alert severity="error" sx={{ mb: 2 }}>{historyError}</Alert>}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Version</strong></TableCell>
                  <TableCell><strong>Saved By</strong></TableCell>
                  <TableCell><strong>Saved At</strong></TableCell>
                  <TableCell><strong>Notes</strong></TableCell>
                  <TableCell align="right"><strong>View JSON</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Chip label={`v${h.version}`} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{h.savedBy}</TableCell>
                    <TableCell>{new Date(h.savedAt).toLocaleString()}</TableCell>
                    <TableCell>{h.notes ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View schema JSON">
                        <IconButton size="small" aria-label={`View JSON v${h.version}`}
                          onClick={() => setViewJsonItem(h)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && !loadingHistory && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {historyType ? 'No history records found.' : 'Select a form type to view history.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* ── Reset Confirm Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!resetTarget} onClose={() => { setResetTarget(null); setResetMsg(''); }}>
        <DialogTitle>Reset Schema</DialogTitle>
        <DialogContent>
          <Typography>
            Remove the tenant override for <strong>{resetTarget}</strong>?
            The form will revert to the public default schema.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResetTarget(null); setResetMsg(''); }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => { await handleReset(); setResetTarget(null); }}
            disabled={resetLoading}
          >
            {resetLoading ? <CircularProgress size={16} /> : 'Reset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View JSON Dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!viewJsonItem}
        onClose={() => setViewJsonItem(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Schema JSON — v{viewJsonItem?.version}</DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              backgroundColor: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 500,
            }}
          >
            {viewJsonItem
              ? (() => { try { return JSON.stringify(JSON.parse(viewJsonItem.schemaJson), null, 2); } catch { return viewJsonItem.schemaJson; } })()
              : ''}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewJsonItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// ── FieldSectionAccordion ─────────────────────────────────────────────────────

interface FieldSectionAccordionProps {
  section:           DFSFormSection;
  fields:            DFSFormField[];
  selectedFieldName: string | null;
  onSelect:          (name: string) => void;
  onMove:            (name: string, dir: 'up' | 'down') => void;
  onDelete:          (name: string) => void;
  onAdd:             () => void;
}

const FieldSectionAccordion: React.FC<FieldSectionAccordionProps> = ({
  section, fields, selectedFieldName, onSelect, onMove, onDelete, onAdd,
}) => {
  return (
    <Accordion defaultExpanded sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={600}>{section.title}</Typography>
        <Chip label={fields.length} size="small" sx={{ ml: 1 }} />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={1}>
          {fields.map((field, idx) => (
            <FieldCard
              key={field.name}
              field={field}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              isSelected={field.name === selectedFieldName}
              onSelect={() => onSelect(field.name)}
              onMoveUp={() => onMove(field.name, 'up')}
              onMoveDown={() => onMove(field.name, 'down')}
              onDelete={() => onDelete(field.name)}
            />
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={onAdd}
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
            aria-label={`Add field to ${section.title}`}
          >
            Add Field
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// ── FieldCard ─────────────────────────────────────────────────────────────────

interface FieldCardProps {
  field:      DFSFormField;
  isFirst:    boolean;
  isLast:     boolean;
  isSelected: boolean;
  onSelect:   () => void;
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onDelete:   () => void;
}

const FieldCard: React.FC<FieldCardProps> = ({
  field, isFirst, isLast, isSelected, onSelect, onMoveUp, onMoveDown, onDelete,
}) => (
  <Paper
    variant="outlined"
    onClick={onSelect}
    sx={{
      p: 1,
      cursor: 'pointer',
      borderColor: isSelected ? 'primary.main' : 'divider',
      borderWidth: isSelected ? 2 : 1,
      '&:hover': { borderColor: 'primary.light' },
    }}
  >
    <Box display="flex" alignItems="center" gap={1}>
      {/* Move buttons */}
      <Box display="flex" flexDirection="column">
        <Tooltip title="Move up">
          <span>
            <IconButton
              size="small"
              aria-label={`Move ${field.label} up`}
              onClick={e => { e.stopPropagation(); onMoveUp(); }}
              disabled={isFirst}
              sx={{ p: 0 }}
            >
              <ArrowUpIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton
              size="small"
              aria-label={`Move ${field.label} down`}
              onClick={e => { e.stopPropagation(); onMoveDown(); }}
              disabled={isLast}
              sx={{ p: 0 }}
            >
              <ArrowDownIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Field info */}
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={600} noWrap>{field.label}</Typography>
        <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.25}>
          <Chip label={field.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
          {field.required && (
            <Chip label="required" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
          )}
        </Box>
      </Box>

      {/* Delete button */}
      <Tooltip title="Delete field">
        <IconButton
          size="small"
          aria-label={`Delete ${field.label}`}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          sx={{ color: 'error.light' }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  </Paper>
);

// ── FieldPropertyEditor ───────────────────────────────────────────────────────

interface FieldPropertyEditorProps {
  field:    DFSFormField;
  onChange: (patch: Partial<DFSFormField>) => void;
}

const FieldPropertyEditor: React.FC<FieldPropertyEditorProps> = ({ field, onChange }) => {
  const isNumber  = field.type === 'number';
  const isText    = field.type === 'text' || field.type === 'textarea';
  const isSelect  = field.type === 'select';

  const handleTypeChange = (newType: DFSFormField['type']) => {
    const patch: Partial<DFSFormField> = { type: newType };
    if (newType !== 'number')  { patch.min = undefined; patch.max = undefined; }
    if (newType !== 'text' && newType !== 'textarea') { patch.maxLength = undefined; }
    if (newType !== 'select')  { patch.options = undefined; }
    onChange(patch);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Field Properties
      </Typography>

      <Stack spacing={2}>
        {/* Label */}
        <TextField
          label="Label"
          size="small"
          fullWidth
          value={field.label}
          onChange={e => onChange({ label: e.target.value })}
        />

        {/* Field Name (read-only) */}
        <TextField
          label="Field Name (read-only)"
          size="small"
          fullWidth
          value={field.name}
          InputProps={{ readOnly: true }}
          sx={{ '& .MuiInputBase-root': { backgroundColor: 'action.hover' } }}
          helperText="Changing field names breaks stored form data"
        />

        {/* Type */}
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={field.type}
            label="Type"
            onChange={e => handleTypeChange(e.target.value as DFSFormField['type'])}
          >
            {FIELD_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Required */}
        <FormControlLabel
          control={
            <Checkbox
              checked={!!field.required}
              onChange={e => onChange({ required: e.target.checked })}
              size="small"
            />
          }
          label="Required"
        />

        {/* Min / Max (number only) */}
        {isNumber && (
          <Box display="flex" gap={1}>
            <TextField
              label="Min"
              size="small"
              type="number"
              fullWidth
              value={field.min ?? ''}
              onChange={e => onChange({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            <TextField
              label="Max"
              size="small"
              type="number"
              fullWidth
              value={field.max ?? ''}
              onChange={e => onChange({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Box>
        )}

        {/* Max Length (text/textarea only) */}
        {isText && (
          <TextField
            label="Max Length"
            size="small"
            type="number"
            fullWidth
            value={field.maxLength ?? ''}
            onChange={e => onChange({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        )}

        {/* Validation Regex */}
        <TextField
          label="Validation Regex"
          size="small"
          fullWidth
          value={field.validationRegex ?? ''}
          onChange={e => onChange({ validationRegex: e.target.value || undefined })}
          InputProps={{ sx: { fontFamily: 'monospace' } }}
          placeholder="e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$"
        />

        {/* Description */}
        <TextField
          label="Description (help text)"
          size="small"
          fullWidth
          multiline
          rows={2}
          value={field.description ?? ''}
          onChange={e => onChange({ description: e.target.value || undefined })}
        />

        {/* Options (select only) */}
        {isSelect && (
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Options
            </Typography>
            <Stack spacing={1} mt={0.5}>
              {(field.options ?? []).map((opt, i) => (
                <Box key={i} display="flex" gap={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Value"
                    value={opt.value}
                    sx={{ flex: 1 }}
                    onChange={e => {
                      const opts = [...(field.options ?? [])];
                      opts[i] = { ...opts[i], value: e.target.value };
                      onChange({ options: opts });
                    }}
                  />
                  <TextField
                    size="small"
                    label="Label"
                    value={opt.label}
                    sx={{ flex: 1 }}
                    onChange={e => {
                      const opts = [...(field.options ?? [])];
                      opts[i] = { ...opts[i], label: e.target.value };
                      onChange({ options: opts });
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => {
                      const opts = (field.options ?? []).filter((_, j) => j !== i);
                      onChange({ options: opts });
                    }}
                    sx={{ color: 'error.light' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const opts = [...(field.options ?? []), { value: '', label: '' }];
                  onChange({ options: opts });
                }}
                aria-label="Add option"
              >
                Add Option
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default FormBuilder;
