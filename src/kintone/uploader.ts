import type { KintoneGateway } from "./rest";

interface FileValueItem {
  fileKey?: string;
  name?: string;
  contentType?: string;
  size?: string;
}

/**
 * Uploads compressed blobs and appends their fileKeys to the target attachment
 * field on the in-memory record (FR-10). Record writes go through
 * kintone.app.record.get/set (passed in as recordApi) rather than REST, so the
 * user still saves the record manually. Works for desktop and mobile: the mobile
 * record API has the same shape.
 */
export class RecordAppender {
  constructor(
    private readonly gateway: KintoneGateway,
    private readonly recordApi: KintoneRecordApi,
    private readonly fieldCode: string,
  ) {}

  /** File names currently in the target field, used to seed dedupe (FR-9). */
  getExistingFileNames(): string[] {
    const field = this.recordApi.get()?.record?.[this.fieldCode];
    if (!field || !Array.isArray(field.value)) return [];
    return (field.value as FileValueItem[]).map((v) => v.name ?? "").filter((n) => n.length > 0);
  }

  /** Upload a blob and return its fileKey. Throws on network failure (EC-7). */
  upload(name: string, blob: Blob): Promise<string> {
    return this.gateway.uploadFile(name, blob);
  }

  /**
   * Append one fileKey to the field and confirm the value grew (FR-10, EC-19).
   * Returns false when the field is missing, not an attachment field, or the
   * count did not increase after set (no write permission).
   */
  append(fileKey: string): boolean {
    const before = this.recordApi.get();
    if (!before) return false;
    const field = before.record[this.fieldCode];
    if (!field || field.type !== "FILE" || !Array.isArray(field.value)) return false;
    const prevCount = field.value.length;
    field.value = [...(field.value as FileValueItem[]), { fileKey }];
    this.recordApi.set({ record: before.record });

    const after = this.recordApi.get();
    const afterField = after?.record?.[this.fieldCode];
    const afterCount = Array.isArray(afterField?.value) ? afterField!.value.length : 0;
    return afterCount > prevCount;
  }
}
