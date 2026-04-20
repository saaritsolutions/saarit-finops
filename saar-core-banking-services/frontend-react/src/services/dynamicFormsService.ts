// ── DynamicFieldsSchemaService API client ─────────────────────────────────────
// Base URL: REACT_APP_DYNAMIC_FORMS_API_URL env var (falls back to localhost:5013)
// In production nginx proxies /api/forms → dynamicfields:5013

const BASE = process.env.REACT_APP_DYNAMIC_FORMS_API_URL || 'http://localhost:5013';

// ── TypeScript interfaces matching DFS DTOs (camelCase from ASP.NET Core JSON) ─

export interface FormSchemaOption {
  value: string;
  label: string;
}

export interface DFSFormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  validationRegex?: string;
  description?: string;
  section?: string;
  options?: FormSchemaOption[];
}

export interface DFSFormSection {
  key: string;
  title: string;
  fields: string[];
  description?: string;
}

export interface DFSFormSchema {
  title: string;
  fields: DFSFormField[];
  sections?: DFSFormSection[];
}

export interface FormSchemaListItem {
  formType:  string;
  tenantId:  string;
  version:   number;
  isActive:  boolean;
  isDefault: boolean;
  updatedAt: string;
  updatedBy?: string;
  notes?:    string;
}

export interface FormSchemaResponse {
  formType:  string;
  tenantId:  string;
  version:   number;
  isDefault: boolean;
  updatedAt: string;
  updatedBy?: string;
  notes?:    string;
  /** Raw JSON string — parse with JSON.parse to get DFSFormSchema */
  schema:    string;
}

export interface SaveSchemaRequest {
  schema: string;   // JSON.stringify(DFSFormSchema)
  notes?: string;
}

export interface FormSchemaHistoryItem {
  version:    number;
  savedBy:    string;
  savedAt:    string;
  notes?:     string;
  schemaJson: string;  // Raw JSON string
}

// ── Auth header helper ────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error ?? body?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Service methods ───────────────────────────────────────────────────────────

export const dynamicFormsService = {

  /** GET /api/forms — list all schemas for the current tenant */
  async listSchemas(): Promise<FormSchemaListItem[]> {
    const res = await fetch(`${BASE}/api/forms`, { headers: authHeaders() });
    return handleResponse<FormSchemaListItem[]>(res);
  },

  /** GET /api/forms/{formType} — get active schema (falls back to public default) */
  async getSchema(formType: string): Promise<FormSchemaResponse> {
    const res = await fetch(`${BASE}/api/forms/${encodeURIComponent(formType)}`, {
      headers: authHeaders(),
    });
    return handleResponse<FormSchemaResponse>(res);
  },

  /** PUT /api/forms/{formType} — save (create or overwrite) the tenant schema */
  async saveSchema(formType: string, req: SaveSchemaRequest): Promise<FormSchemaResponse> {
    const res = await fetch(`${BASE}/api/forms/${encodeURIComponent(formType)}`, {
      method:  'PUT',
      headers: authHeaders(),
      body:    JSON.stringify(req),
    });
    return handleResponse<FormSchemaResponse>(res);
  },

  /** POST /api/forms/{formType}/reset — remove tenant override, revert to public default */
  async resetSchema(formType: string): Promise<void> {
    const res = await fetch(`${BASE}/api/forms/${encodeURIComponent(formType)}/reset`, {
      method:  'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json())?.error ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
  },

  /** GET /api/forms/{formType}/history — version history, latest first */
  async getHistory(formType: string): Promise<FormSchemaHistoryItem[]> {
    const res = await fetch(
      `${BASE}/api/forms/${encodeURIComponent(formType)}/history`,
      { headers: authHeaders() }
    );
    return handleResponse<FormSchemaHistoryItem[]>(res);
  },
};
