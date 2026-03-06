// @reqvet/sdk — Type definitions

export interface ReqVetOptions {
  baseUrl?: string;
  pollInterval?: number;
  timeout?: number;
}

export interface UploadResult {
  /** Canonical path to the uploaded audio in ReqVet storage */
  audio_file: string;
  /** Alias for audio_file (for DX / backward compatibility) */
  path: string;
  size_bytes: number;
  content_type: string;
}

export interface SignedUploadResult {
  /** Presigned URL for direct PUT upload to Supabase storage */
  uploadUrl: string;
  /** Storage path to pass to createJob({ audioFile: path }) */
  path: string;
}

export interface JobResult {
  job_id: string;
  status: 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed' | 'amending';
}

// ─── Field Extraction Types ─────────────────────────────────

/** Supported field types for structured extraction */
export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'array' | 'html';

/** A single field definition in an organization's field_schema */
export interface FieldDefinition {
  /** Unique key in snake_case (e.g. "espece", "poids", "traitements") */
  key: string;
  /** Human-readable label (e.g. "Espèce", "Poids (kg)") */
  label: string;
  /** Data type for this field */
  type: FieldType;
}

/**
 * Extracted fields from a generation.
 * Keys match the field_schema definitions on the organization.
 * Values are typed according to the field type, or null if not mentioned.
 */
export type ExtractedFields = Record<string, string | number | boolean | string[] | null>;

// ─── Report & Job Types ─────────────────────────────────────

export interface ReqVetReport {
  jobId: string;
  html: string;
  /** Structured fields extracted from the transcription (null if org has no field_schema) */
  fields: ExtractedFields | null;
  transcription: string;
  animalName: string;
  cost: {
    transcription_usd: number;
    generation_usd: number;
    total_usd: number;
  };
  metadata: Record<string, unknown>;
}

export interface Template {
  id: string;
  org_id: string | null;
  name: string;
  description: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Params ──────────────────────────────────────────────────

export interface GenerateReportParams {
  audio: Blob | Buffer | File;
  animalName: string;
  templateId: string;
  fileName?: string;
  /**
   * Optional webhook URL.
   * If provided, ReqVet will POST the final result to this endpoint when ready.
   */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  /** Optional: extra instructions injected into the generation prompt (kept separate from metadata) */
  extraInstructions?: string;
  /**
   * When true, generateReport() will poll until completion and return the final report.
   * When false (default), it returns immediately after creating the job.
   */
  waitForResult?: boolean;
  /** Called on each poll with current status (only when waitForResult=true). */
  onStatus?: (status: string) => void;
}

export interface CreateJobParams {
  audioFile: string;
  animalName: string;
  templateId: string;
  /** Optional webhook URL (falls back to the org default webhook_url server-side if omitted). */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  extraInstructions?: string; // 👈 add
}

export interface CreateTemplateParams {
  name: string;
  content: string;
  description?: string;
  is_default?: boolean;
}

export interface ListJobsOptions {
  limit?: number;
  offset?: number;
  status?: 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed' | 'amending';
  sort?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface JobSummary {
  id: string;
  status: 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed' | 'amending';
  animal_name: string;
  template_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
}

export interface ListJobsResult {
  jobs: JobSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface RegenerateOptions {
  extraInstructions?: string;
  templateId?: string;
}

export interface RegenerateResult {
  job_id: string;
  status: string;
  result: {
    html: string;
    fields?: ExtractedFields;
  };
}

export type ReformulationPurpose =
  | 'owner'
  | 'referral'
  | 'summary'
  | 'custom'
  | 'diagnostic_hypothesis';

export interface ReformulateParams {
  purpose: ReformulationPurpose;
  customInstructions?: string;
}

export interface ReqVetReformulation {
  id: string;
  job_id: string;
  purpose: ReformulationPurpose;
  html: string;
  custom_instructions?: string;
  cost: {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  };
  created_at: string;
}

// ─── Partner / Reseller Types ────────────────────────────────

export interface OrganizationUsage {
  jobs_this_month: number;
  quota_remaining: number | 'unlimited';
}

export interface PartnerOrganization {
  id: string;
  name: string;
  contact_email: string | null;
  is_active: boolean;
  monthly_quota: number | null;
  external_id: string | null;
  created_at: string;
  usage?: OrganizationUsage;
}

export interface CreateOrganizationParams {
  name: string;
  contactEmail?: string;
  /** Your internal ID — enables idempotency (same externalId returns the existing org) */
  externalId?: string;
  /** Max jobs per month (default: 100, max: 10 000) */
  monthlyQuota?: number;
  webhookUrl?: string;
}

export interface UpdateOrganizationParams {
  monthlyQuota?: number;
  /** Set to false to suspend the clinic and revoke its API keys */
  isActive?: boolean;
  webhookUrl?: string;
}

export interface CreateOrganizationResult {
  organization: Pick<PartnerOrganization, 'id' | 'name' | 'monthly_quota' | 'external_id'>;
  /** The clinic's API key — returned only once, store it securely! */
  api_key: string;
  /** Webhook signing secret — returned only once, store it securely! */
  webhook_secret: string;
  warning: string;
  /** Returned instead of api_key/webhook_secret when the org already exists (idempotent) */
  message?: string;
}

// ─── Client ──────────────────────────────────────────────────

export declare class ReqVetError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown);
}

export declare class ReqVet {
  constructor(apiKey: string, options?: ReqVetOptions);

  /**
   * Convenience helper.
   * - Default: upload → create job → return {job_id, status}
   * - If waitForResult=true: upload → create job → poll → return final report
   */
  generateReport(params: GenerateReportParams & { waitForResult: true }): Promise<ReqVetReport>;
  generateReport(params: GenerateReportParams & { waitForResult?: false }): Promise<JobResult>;
  generateReport(params: GenerateReportParams): Promise<JobResult | ReqVetReport>;

  /**
   * Get a presigned URL for direct upload to Supabase storage.
   * Recommended for server-side proxies — bypasses Vercel's ~4.5 MB payload limit.
   * PUT the audio buffer to uploadUrl, then pass path to createJob().
   */
  getSignedUploadUrl(fileName: string, contentType: string): Promise<SignedUploadResult>;

  /**
   * Upload an audio file via ReqVet's /api/v1/upload endpoint.
   * ⚠️ Subject to Vercel Serverless Function payload limit (~4.5 MB).
   * For files > 4 MB in server-side contexts, use getSignedUploadUrl() instead.
   */
  uploadAudio(audio: Blob | Buffer | File, fileName?: string): Promise<UploadResult>;

  /** Create a generation job */
  createJob(params: CreateJobParams): Promise<JobResult>;

  /** List jobs with optional pagination and filtering */
  listJobs(options?: ListJobsOptions): Promise<ListJobsResult>;

  /** Get job status */
  getJob(jobId: string): Promise<Record<string, unknown>>;

  /** Wait for a job to finish */
  waitForJob(jobId: string, onStatus?: (status: string) => void): Promise<ReqVetReport>;

  /** Regenerate a completed report */
  regenerateJob(jobId: string, options?: RegenerateOptions): Promise<RegenerateResult>;

  /** Add an audio complement to a completed job */
  amendJob(
    jobId: string,
    params: { audioFile: string; templateId?: string },
  ): Promise<{
    job_id: string;
    status: 'amending';
    amendment_number: number;
    message: string;
  }>;

  /** Reformulate a completed report for a specific audience */
  reformulateReport(jobId: string, params: ReformulateParams): Promise<ReqVetReformulation>;

  /** List all reformulations for a job */
  listReformulations(jobId: string): Promise<{ reformulations: ReqVetReformulation[] }>;

  /** List templates */
  listTemplates(): Promise<{ custom: Template[]; system: Template[] }>;

  /** Get a template */
  getTemplate(templateId: string): Promise<Template>;

  /** Create a template */
  createTemplate(params: CreateTemplateParams): Promise<Template>;

  /** Update a template */
  updateTemplate(
    templateId: string,
    updates: Partial<Pick<CreateTemplateParams, 'name' | 'content' | 'description' | 'is_default'>>,
  ): Promise<Template>;

  /** Delete a template */
  deleteTemplate(templateId: string): Promise<{ success: boolean }>;

  // ─── Partner / Reseller (requires role='reseller' API key) ──

  /** List all organizations provisioned by the reseller */
  listOrganizations(): Promise<{ organizations: PartnerOrganization[] }>;

  /**
   * Provision a new organization/clinic.
   * Idempotent via externalId — returns existing org if already provisioned.
   * ⚠️ api_key and webhook_secret are returned only once.
   */
  createOrganization(params: CreateOrganizationParams): Promise<CreateOrganizationResult>;

  /** Get details and current month usage of a specific organization */
  getOrganization(orgId: string): Promise<PartnerOrganization>;

  /** Update an organization's quota, status, or webhook URL */
  updateOrganization(
    orgId: string,
    updates: UpdateOrganizationParams,
  ): Promise<Pick<PartnerOrganization, 'id' | 'name' | 'is_active' | 'monthly_quota' | 'external_id'>>;

  /** Deactivate an organization and revoke all its API keys (soft delete) */
  deactivateOrganization(orgId: string): Promise<{ success: boolean; message: string }>;

  /** Health check */
  health(): Promise<{ status: string; services: Record<string, string> }>;
}

export default ReqVet;
