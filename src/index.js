// @reqvet/sdk — Official JavaScript SDK
// Zero dependencies. Works in Node.js 18+ and modern browsers.

class ReqVetError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ReqVetError';
    this.status = status;
    this.body = body;
  }
}

function mimeFromFileName(fileName) {
  const name = (fileName || '').toLowerCase();
  const ext = name.split('.').pop();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    default:
      return '';
  }
}

class ReqVet {
  /**
   * Create a ReqVet client.
   *
   * @param {string} apiKey - Your API key (rqv_live_...)
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - API base URL (default: https://api.reqvet.com)
   * @param {number} [options.pollInterval] - Polling interval in ms (default: 5000)
   * @param {number} [options.timeout] - Max wait time in ms (default: 300000 = 5 min)
   */
  constructor(apiKey, options = {}) {
    if (!apiKey?.startsWith('rqv_')) {
      throw new Error('Invalid API key. Must start with "rqv_".');
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl || 'https://api.reqvet.com').replace(/\/$/, '');
    this.pollInterval = options.pollInterval || 5000;
    this.timeout = options.timeout || 300_000;
  }

  // ─── Core: Generate a report (upload + job + poll) ─────────

  /**
   * Generate a veterinary report from an audio file.
   * Handles the full flow: upload → create job → wait for result.
   *
   * @param {Object} params
   * @param {Blob|Buffer|File} params.audio - Audio file
   * @param {string} params.animalName - Name of the animal
   * @param {string} params.templateId - Template UUID
   * @param {string} [params.fileName] - File name (default: audio.webm)
   * @param {string} [params.callbackUrl] - Webhook URL for result
   * @param {Object} [params.metadata] - Custom data passed through
   * @param {Function} [params.onStatus] - Called on each poll with current status
   * @returns {Promise<ReqVetReport>}
   */
  async generateReport({
    audio,
    animalName,
    templateId,
    fileName,
    callbackUrl,
    metadata,
    extraInstructions,
    onStatus,
    waitForResult = false,
  }) {
    // Convenience helper.
    // - Default: webhook-first (returns immediately after job creation). If callbackUrl is provided,
    //   ReqVet will POST the final result to that URL when ready.
    // - Optional: polling mode (waitForResult=true) which returns the final report.

    // Step 1: Upload
    const upload = await this.uploadAudio(audio, fileName);

    // Step 2: Create job (pipeline starts server-side)
    const job = await this.createJob({
      audioFile: upload.audio_file,
      animalName,
      templateId,
      callbackUrl,
      metadata, // 👈 ne touche pas metadata
      extraInstructions, // 👈 passe le param séparé
    });

    // Step 3: Either return immediately, or poll until completion.
    if (waitForResult) {
      return this.waitForJob(job.job_id, onStatus);
    }
    return job;
  }

  // ─── Upload ────────────────────────────────────────────────

  /**
   * Get a presigned upload URL for direct upload to ReqVet storage (Supabase).
   *
   * Recommended for server-side integrations (e.g. Next.js proxy routes).
   * The file goes directly to Supabase — it never passes through a Vercel
   * Serverless Function, so there is no ~4.5 MB payload limit.
   *
   * Flow:
   *   1. getSignedUploadUrl(fileName, contentType) — tiny JSON request, no file.
   *   2. PUT the audio buffer to uploadUrl (direct to Supabase).
   *   3. Pass path to createJob({ audioFile: path }).
   *
   * @param {string} fileName - File name (e.g. 'consultation.webm')
   * @param {string} contentType - MIME type (e.g. 'audio/webm')
   * @returns {Promise<{uploadUrl: string, path: string}>}
   */
  async getSignedUploadUrl(fileName, contentType) {
    return this._fetch('POST', '/api/v1/storage/signed-upload', {
      file_name: fileName,
      content_type: contentType,
    });
  }

  /**
   * Upload an audio file to ReqVet storage.
   *
   * ⚠️  This method POSTs the file to /api/v1/upload, which runs as a
   * Vercel Serverless Function (~4.5 MB request limit). For server-side
   * proxies (Next.js, Express…) handling files > 4 MB, prefer
   * getSignedUploadUrl() + a direct PUT to avoid this limit.
   *
   * @param {Blob|Buffer|File} audio - The audio file
   * @param {string} [fileName] - File name
   * @returns {Promise<{audio_file: string, size_bytes: number}>}
   */
  async uploadAudio(audio, fileName) {
    const form = new FormData();

    if (typeof Blob !== 'undefined' && audio instanceof Blob) {
      form.append('file', audio, fileName || 'audio.webm');
    } else if (Buffer.isBuffer(audio)) {
      // Node.js Buffer → Blob
      const finalName = fileName || 'audio.webm';
      const mime = mimeFromFileName(finalName);
      const blob = mime ? new Blob([audio], { type: mime }) : new Blob([audio]);
      form.append('file', blob, finalName);
    } else {
      throw new ReqVetError('audio must be a Blob, File, or Buffer', 0, null);
    }

    const res = await this._fetch('POST', '/api/v1/upload', null, form);
    // DX: provide a stable alias `path` for consumers.
    if (res && typeof res === 'object' && res.audio_file && !res.path) {
      return { ...res, path: res.audio_file };
    }
    return res;
  }

  // ─── Jobs ──────────────────────────────────────────────────

  /**
   * Create a new CR generation job.
   *
   * @param {Object} params
   * @param {string} params.audioFile - Path from upload
   * @param {string} params.animalName
   * @param {string} params.templateId
   * @param {string} [params.callbackUrl]
   * @param {Object} [params.metadata]
   * @returns {Promise<{job_id: string, status: string}>}
   */
  async createJob({ audioFile, animalName, templateId, callbackUrl, metadata, extraInstructions }) {
    return this._fetch('POST', '/api/v1/jobs', {
      audio_file: audioFile,
      animal_name: animalName,
      template_id: templateId,
      callback_url: callbackUrl,
      metadata,
      extra_instructions: extraInstructions,
    });
  }

  /**
   * Get the status and result of a job.
   *
   * @param {string} jobId
   * @returns {Promise<ReqVetJob>}
   */
  async getJob(jobId) {
    return this._fetch('GET', `/api/v1/jobs/${jobId}`);
  }

  /**
   * List jobs with optional pagination and filtering.
   *
   * @param {Object} [options]
   * @param {number} [options.limit] - Number of jobs to return (1-100, default 20)
   * @param {number} [options.offset] - Pagination offset (default 0)
   * @param {string} [options.status] - Filter by status (pending|transcribing|generating|completed|failed|amending)
   * @param {string} [options.sort] - Sort field: 'created_at' (default) or 'updated_at'
   * @param {string} [options.order] - Sort direction: 'desc' (default) or 'asc'
   * @returns {Promise<{jobs: Object[], pagination: {total: number, limit: number, offset: number, has_more: boolean}}>}
   */
  async listJobs({ limit, offset, status, sort, order } = {}) {
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', String(limit));
    if (offset != null) params.set('offset', String(offset));
    if (status != null) params.set('status', status);
    if (sort != null) params.set('sort', sort);
    if (order != null) params.set('order', order);
    const qs = params.toString();
    return this._fetch('GET', `/api/v1/jobs${qs ? `?${qs}` : ''}`);
  }

  /**
   * Wait for a job to complete by polling.
   *
   * @param {string} jobId
   * @param {Function} [onStatus] - Called on each poll
   * @returns {Promise<ReqVetReport>}
   */
  async waitForJob(jobId, onStatus) {
    const deadline = Date.now() + this.timeout;

    while (Date.now() < deadline) {
      await this._sleep(this.pollInterval);

      const job = await this.getJob(jobId);

      if (onStatus) onStatus(job.status);

      if (job.status === 'completed') {
        return {
          jobId: job.job_id,
          html: job.result?.html || '',
          fields: job.result?.fields || null,
          transcription: job.transcription || '',
          animalName: job.animal_name,
          cost: job.cost || {},
          metadata: job.metadata || {},
        };
      }

      if (job.status === 'failed') {
        throw new ReqVetError(`Job failed: ${job.error || 'Unknown error'}`, 0, job);
      }
    }

    throw new ReqVetError('Timeout waiting for job to complete', 0, { jobId });
  }

  /**
   * Regenerate a completed report with new instructions.
   *
   * @param {string} jobId
   * @param {Object} [options]
   * @param {string} [options.extraInstructions]
   * @param {string} [options.templateId]
   * @returns {Promise<{job_id: string, html: string}>}
   */
  async regenerateJob(jobId, options = {}) {
    return this._fetch('POST', `/api/v1/jobs/${jobId}/regenerate`, {
      extra_instructions: options.extraInstructions,
      template_id: options.templateId,
    });
  }

  // ─── Amendments (audio complements) ────────────────────────

  /**
   * Add an audio complement to a completed job.
   *
   * The new audio is transcribed and merged with the existing
   * transcription(s). The CR is then regenerated with the full context.
   * Supports multiple amendments — each one appends.
   *
   * @param {string} jobId - The completed job ID
   * @param {Object} params
   * @param {string} params.audioFile - Path from signed upload
   * @param {string} [params.templateId] - Optional: switch to a different template
   * @returns {Promise<{job_id: string, status: string, amendment_number: number}>}
   *
   * @example
   * // Upload the complement audio first
   * const { audio_file } = await reqvet.uploadAudio(newAudioBlob, 'complement.webm');
   *
   * // Submit the amendment
   * const amend = await reqvet.amendJob(jobId, { audioFile: audio_file });
   * // amend.status === 'amending'
   *
   * // Poll for completion (same as initial job)
   * const updated = await reqvet.waitForJob(jobId);
   * // updated.html now includes the complement info
   */
  async amendJob(jobId, { audioFile, templateId } = {}) {
    if (!audioFile) throw new Error('audioFile is required for amendJob');
    return this._fetch('POST', `/api/v1/jobs/${jobId}/amend`, {
      audio_file: audioFile,
      template_id: templateId,
    });
  }

  // ─── Reformulations ─────────────────────────────────────────

  /**
   * Generate a reformulation of a completed report.
   *
   * Produces an alternative version of the CR adapted to a specific audience.
   *
   * @param {string} jobId - The completed job ID
   * @param {Object} params
   * @param {string} params.purpose - 'owner' | 'referral' | 'summary' | 'custom'
   * @param {string} [params.customInstructions] - Required when purpose is 'custom'
   * @returns {Promise<ReqVetReformulation>}
   *
   * @example
   * // Simplified version for the pet owner
   * const ownerVersion = await reqvet.reformulateReport(jobId, { purpose: 'owner' });
   *
   * // Clinical summary for specialist referral
   * const referral = await reqvet.reformulateReport(jobId, { purpose: 'referral' });
   *
   * // Short internal summary
   * const summary = await reqvet.reformulateReport(jobId, { purpose: 'summary' });
   *
   * // Custom reformulation
   * const custom = await reqvet.reformulateReport(jobId, {
   *   purpose: 'custom',
   *   customInstructions: 'Reformule en insistant sur le pronostic et le suivi nutritionnel',
   * });
   */
  async reformulateReport(jobId, { purpose, customInstructions } = {}) {
    if (!purpose) {
      throw new ReqVetError(
        'purpose is required. Must be one of: owner, referral, summary, custom, diagnostic_hypothesis',
        0,
        null,
      );
    }
    return this._fetch('POST', `/api/v1/jobs/${jobId}/reformulate`, {
      purpose,
      custom_instructions: customInstructions,
    });
  }

  /**
   * List all reformulations for a completed job.
   *
   * @param {string} jobId
   * @returns {Promise<{reformulations: ReqVetReformulation[]}>}
   */
  async listReformulations(jobId) {
    return this._fetch('GET', `/api/v1/jobs/${jobId}/reformulate`);
  }

  // ─── Templates ─────────────────────────────────────────────

  /**
   * List all accessible templates.
   * @returns {Promise<{custom: Template[], system: Template[]}>}
   */
  async listTemplates() {
    return this._fetch('GET', '/api/v1/templates');
  }

  /**
   * Get a template by ID.
   * @param {string} templateId
   */
  async getTemplate(templateId) {
    return this._fetch('GET', `/api/v1/templates/${templateId}`);
  }

  /**
   * Create a new template.
   * @param {Object} params
   * @param {string} params.name
   * @param {string} params.content - The prompt instructions
   * @param {string} [params.description]
   */
  async createTemplate({ name, content, description }) {
    return this._fetch('POST', '/api/v1/templates', {
      name,
      content,
      description,
    });
  }

  /**
   * Update a template.
   * @param {string} templateId
   * @param {Object} updates
   * @param {string} [updates.name]
   * @param {string} [updates.content]
   * @param {string} [updates.description]
   */
  async updateTemplate(templateId, updates) {
    return this._fetch('PUT', `/api/v1/templates/${templateId}`, updates);
  }

  /**
   * Delete a template.
   * @param {string} templateId
   */
  async deleteTemplate(templateId) {
    return this._fetch('DELETE', `/api/v1/templates/${templateId}`);
  }

  // ─── Partner / Reseller ────────────────────────────────────

  /**
   * List all organizations provisioned by the reseller.
   * Requires a reseller API key (role='reseller').
   *
   * @returns {Promise<{organizations: Object[]}>}
   */
  async listOrganizations() {
    return this._fetch('GET', '/api/v1/partner/orgs');
  }

  /**
   * Provision a new organization (clinic) under the reseller account.
   * Requires a reseller API key (role='reseller').
   *
   * Idempotent via externalId: if an org with the same externalId already
   * exists under this reseller, the existing one is returned (no duplicate).
   *
   * ⚠️ The returned api_key and webhook_secret are shown only once — store them securely.
   *
   * @param {Object} params
   * @param {string} params.name - Clinic name
   * @param {string} [params.contactEmail]
   * @param {string} [params.externalId] - Your internal ID (enables idempotency)
   * @param {number} [params.monthlyQuota] - Job quota per month (default: 100, max: 10 000)
   * @param {string} [params.webhookUrl] - Webhook URL for job results
   * @returns {Promise<Object>}
   */
  async createOrganization({ name, contactEmail, externalId, monthlyQuota, webhookUrl }) {
    return this._fetch('POST', '/api/v1/partner/orgs', {
      name,
      contact_email: contactEmail,
      external_id: externalId,
      monthly_quota: monthlyQuota,
      webhook_url: webhookUrl,
    });
  }

  /**
   * Get details and current month usage of a specific organization.
   * Requires a reseller API key (role='reseller').
   *
   * @param {string} orgId
   * @returns {Promise<Object>}
   */
  async getOrganization(orgId) {
    return this._fetch('GET', `/api/v1/partner/orgs/${orgId}`);
  }

  /**
   * Update an organization's quota, status, or webhook URL.
   * Requires a reseller API key (role='reseller').
   *
   * @param {string} orgId
   * @param {Object} updates
   * @param {number} [updates.monthlyQuota]
   * @param {boolean} [updates.isActive] - Set to false to suspend the clinic
   * @param {string} [updates.webhookUrl]
   * @returns {Promise<Object>}
   */
  async updateOrganization(orgId, { monthlyQuota, isActive, webhookUrl } = {}) {
    return this._fetch('PATCH', `/api/v1/partner/orgs/${orgId}`, {
      monthly_quota: monthlyQuota,
      is_active: isActive,
      webhook_url: webhookUrl,
    });
  }

  /**
   * Deactivate an organization and revoke all its API keys.
   * Soft delete — data is preserved for audit/GDPR purposes.
   * Requires a reseller API key (role='reseller').
   *
   * @param {string} orgId
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deactivateOrganization(orgId) {
    return this._fetch('DELETE', `/api/v1/partner/orgs/${orgId}`);
  }

  // ─── Health ────────────────────────────────────────────────

  /**
   * Check API health.
   * @returns {Promise<{status: string, services: Object}>}
   */
  async health() {
    return this._fetch('GET', '/api/v1/health');
  }

  // ─── Internal ──────────────────────────────────────────────

  async _fetch(method, path, body, formData) {
    const url = `${this.baseUrl}${path}`;
    const headers = { Authorization: `Bearer ${this.apiKey}` };
    const opts = { method, headers };

    const isRealFormData =
      typeof FormData !== 'undefined' && formData && formData instanceof FormData;

    if (isRealFormData) {
      opts.body = formData;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      // Strip null/undefined values to keep payloads clean
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== null && v !== undefined),
      );
      opts.body = JSON.stringify(cleaned);
    }

    const response = await fetch(url, opts);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ReqVetError(`Non-JSON response from ${path}`, response.status, null);
    }

    if (!response.ok) {
      throw new ReqVetError(data?.error || `HTTP ${response.status}`, response.status, data);
    }

    return data;
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export { ReqVet, ReqVetError };
export default ReqVet;
