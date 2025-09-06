import { apiService } from './apiService';

export interface SuggestedField {
  Name: string;
  Label: string;
  Type: string;
  Required: boolean;
  ValidationRegex?: string;
  MaxLength?: number;
  Description?: string;
}

export interface AIFormResponse {
  Explanation: string;
  SuggestedFields: SuggestedField[];
  SchemaJson: string;
  Confidence: string;
  IsValid: boolean;
  Transcript: string;
}

export interface AIFormRequest {
  Message: string;
  CurrentSchemaJson?: string;
  Category?: string;
  FormOnly: boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: string; // text|number|date|boolean|select
  required?: boolean;
  validationRegex?: string;
  maxLength?: number;
  description?: string;
  section?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface FormSchema {
  entityName?: string;
  title?: string;
  fields?: FormField[];
  sections?: Array<{ key: string; title: string; fields: string[]; description?: string }>;
  [key: string]: any;
}

const BASE = '/api/AIForm';

export const aiFormService = {
  async chatSchema(request: AIFormRequest): Promise<FormSchema> {
    // When FormOnly=true, backend returns a raw JSON object (schema)
    const data = await apiService.post<FormSchema>(`${BASE}/chat`, request);
    return data;
  },

  async chatEnvelope(request: AIFormRequest): Promise<AIFormResponse> {
    // When FormOnly=false, backend returns an AIFormResponse envelope
    const data = await apiService.post<AIFormResponse>(`${BASE}/chat`, request);
    return data;
  },

  async apply(response: AIFormResponse): Promise<{ success: boolean; file?: string }> {
    return await apiService.post(`${BASE}/apply`, response);
  },

  async getLastApplied(): Promise<FormSchema | null> {
    try {
      const res = await apiService.get<{ schema: string }>(`${BASE}/last-applied`);
      if (!res?.schema) return null;
      try {
        return JSON.parse(res.schema) as FormSchema;
      } catch {
        // If stored as envelope or invalid, try to parse fallback structure
        return null;
      }
    } catch {
      return null;
    }
  },
};

export default aiFormService;
