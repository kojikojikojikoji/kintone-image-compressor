import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export interface FieldMeta {
  code: string;
  label: string;
  type: string;
}

export interface SpacerMeta {
  elementId: string;
}

/**
 * Thin wrapper over @kintone/rest-api-client for the REST calls this plugin
 * makes (section 7). Everything runs under the logged-in user's session; the
 * plugin never handles API tokens (common spec 6). The client builds guest-space
 * URLs itself, so paths are never assembled by hand.
 */
export class KintoneGateway {
  private readonly client: KintoneRestAPIClient;

  constructor(client: KintoneRestAPIClient = new KintoneRestAPIClient()) {
    this.client = client;
  }

  /** Upload a blob and return its registration fileKey (POST /k/v1/file). */
  async uploadFile(name: string, blob: Blob): Promise<string> {
    const res = await this.client.file.uploadFile({ file: { name, data: blob } });
    return res.fileKey;
  }

  /** Attachment (FILE) fields from the preview endpoint, for the config screen (CF-2). */
  async getFileFields(app: number): Promise<FieldMeta[]> {
    const res = await this.client.app.getFormFields({ app, preview: true });
    const props = res.properties as unknown as Record<string, FieldMeta>;
    return Object.values(props).filter((f) => f.type === "FILE");
  }

  /** Space (SPACER) element ids from the preview layout, for the config screen (CF-1). */
  async getSpacerElementIds(app: number): Promise<string[]> {
    const res = await this.client.app.getFormLayout({ app, preview: true });
    const ids: string[] = [];
    collectSpacers(res.layout as unknown[], ids);
    return ids;
  }

  /** Whether a field code still exists as a FILE field (save-time validation, CF-2). */
  async fileFieldExists(app: number, code: string): Promise<boolean> {
    const fields = await this.getFileFields(app);
    return fields.some((f) => f.code === code);
  }

  /** Whether a spacer element id still exists in the layout (save-time validation, CF-1). */
  async spacerExists(app: number, elementId: string): Promise<boolean> {
    const ids = await this.getSpacerElementIds(app);
    return ids.includes(elementId);
  }
}

function collectSpacers(nodes: unknown[], out: string[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const record = node as {
      type?: string;
      elementId?: string;
      fields?: unknown[];
      layout?: unknown[];
    };
    if (record.type === "SPACER" && typeof record.elementId === "string" && record.elementId) {
      out.push(record.elementId);
    }
    if (Array.isArray(record.fields)) collectSpacers(record.fields, out);
    if (Array.isArray(record.layout)) collectSpacers(record.layout, out);
  }
}
