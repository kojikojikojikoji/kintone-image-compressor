// Minimal type surface for the kintone global used by this plugin. It covers
// only the members this code touches, not the full kintone JS API.

export {};

declare global {
  interface KintoneRecordField {
    type: string;
    value: unknown;
    [extra: string]: unknown;
  }

  type KintoneRecordData = Record<string, KintoneRecordField>;

  interface KintoneEvent {
    appId: number;
    recordId?: number | string;
    record: KintoneRecordData;
    [extra: string]: unknown;
  }

  type KintoneEventHandler = (event: KintoneEvent) => KintoneEvent | Promise<KintoneEvent>;

  interface KintoneRecordApi {
    get(): { record: KintoneRecordData } | null | undefined;
    set(data: { record: KintoneRecordData }): void;
    getId(): number | null;
    getSpaceElement(elementId: string): HTMLElement | null;
  }

  interface KintoneAppApi {
    getId(): number | null;
    record: KintoneRecordApi;
  }

  interface KintoneMobileAppApi {
    getId(): number | null;
    record: KintoneRecordApi;
  }

  interface KintonePluginApp {
    getConfig(id: string): Record<string, string> | undefined;
    setConfig(config: Record<string, string>, callback?: () => void): void;
  }

  interface KintoneNamespace {
    app: KintoneAppApi;
    mobile: { app: KintoneMobileAppApi };
    events: {
      on(events: string | string[], handler: KintoneEventHandler): void;
    };
    plugin: { app: KintonePluginApp };
    $PLUGIN_ID: string;
  }

  const kintone: KintoneNamespace;
}
