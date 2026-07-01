import {
  CONFIG_KEY,
  DEFAULT_SETTINGS,
  MAX_LONG_EDGE_CHOICES,
  configSchema,
  parseConfig,
  serializeConfig,
  type PluginConfig,
  type Settings,
} from "../core";
import { KintoneGateway, type FieldMeta } from "../kintone/rest";

// Settings screen (CF-1..CF-8). Dropdowns for the space and attachment field are
// populated from the preview form endpoints. Validation is per field, shown
// directly under the control (common spec 7, no summary at the top).

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(
  labelText: string,
  descText: string,
  control: HTMLElement,
): { wrap: HTMLElement; error: HTMLElement } {
  const wrap = el("div", { class: "kp-imgc-field" });
  wrap.appendChild(el("span", { class: "kp-imgc-field__label" }, labelText));
  wrap.appendChild(control);
  const error = el("p", { class: "kp-imgc-error" });
  error.style.display = "none";
  wrap.appendChild(error);
  if (descText) wrap.appendChild(el("p", { class: "kp-imgc-field__desc" }, descText));
  return { wrap, error };
}

function showError(node: HTMLElement, message: string): void {
  node.textContent = message;
  node.style.display = "block";
}
function clearError(node: HTMLElement): void {
  node.textContent = "";
  node.style.display = "none";
}

async function render(): Promise<void> {
  const root = document.getElementById("kp-imgc-config-root");
  if (!root) return;
  document.body.className = "kp-imgc-config";

  const appId = kintone.app.getId();
  const gateway = new KintoneGateway();
  let fileFields: FieldMeta[] = [];
  let spacerIds: string[] = [];
  if (appId !== null) {
    try {
      [fileFields, spacerIds] = await Promise.all([
        gateway.getFileFields(appId),
        gateway.getSpacerElementIds(appId),
      ]);
    } catch {
      fileFields = [];
      spacerIds = [];
    }
  }

  const current: PluginConfig | null = parseConfig(
    kintone.plugin.app.getConfig(kintone.$PLUGIN_ID)?.[CONFIG_KEY],
  );
  const s: Settings = current ? current.settings : { ...DEFAULT_SETTINGS };

  const inner = el("div", { class: "kp-imgc-config__inner" });
  inner.appendChild(el("h1", {}, "kintone-image-compressor"));
  inner.appendChild(
    el("p", { class: "kp-imgc-lead" }, "画像を圧縮してから添付ファイルフィールドに追加します。"),
  );

  // --- Placement card ---
  const placeCard = el("section", { class: "kp-imgc-card" });
  placeCard.appendChild(el("h2", {}, "設置場所"));

  const spaceSelect = el("select", { class: "kp-imgc-select" }) as HTMLSelectElement;
  spaceSelect.appendChild(el("option", { value: "" }, "選択してください"));
  for (const id of spacerIds) {
    spaceSelect.appendChild(el("option", { value: id }, id));
  }
  if (s.spaceElementId && !spacerIds.includes(s.spaceElementId)) {
    // Referenced space was deleted from the layout (common spec, TC-33).
    spaceSelect.appendChild(
      el("option", { value: s.spaceElementId }, `${s.spaceElementId}（見つかりません）`),
    );
  }
  spaceSelect.value = s.spaceElementId;
  const spaceField = field(
    "ボタンを置くスペース *",
    "レコード作成・編集画面のこのスペースに専用ボタンを表示します。",
    spaceSelect,
  );
  placeCard.appendChild(spaceField.wrap);
  if (s.spaceElementId && !spacerIds.includes(s.spaceElementId)) {
    showError(
      spaceField.error,
      `設定中のスペース「${s.spaceElementId}」が見つかりません。フォームで再度選択してください。`,
    );
  }

  const fileSelect = el("select", { class: "kp-imgc-select" }) as HTMLSelectElement;
  fileSelect.appendChild(el("option", { value: "" }, "選択してください"));
  for (const f of fileFields) {
    fileSelect.appendChild(el("option", { value: f.code }, `${f.label} (${f.code})`));
  }
  if (s.attachmentFieldCode && !fileFields.some((f) => f.code === s.attachmentFieldCode)) {
    fileSelect.appendChild(
      el("option", { value: s.attachmentFieldCode }, `${s.attachmentFieldCode}（見つかりません）`),
    );
  }
  fileSelect.value = s.attachmentFieldCode;
  const fileField = field(
    "書き込み先の添付ファイルフィールド *",
    "圧縮した画像はこのフィールドに追記します。既存の添付は消えません。",
    fileSelect,
  );
  placeCard.appendChild(fileField.wrap);
  if (s.attachmentFieldCode && !fileFields.some((f) => f.code === s.attachmentFieldCode)) {
    showError(
      fileField.error,
      `設定中のフィールド「${s.attachmentFieldCode}」が見つかりません。別のフィールドを選択してください。`,
    );
  }
  inner.appendChild(placeCard);

  // --- Compression card ---
  const compCard = el("section", { class: "kp-imgc-card" });
  compCard.appendChild(el("h2", {}, "圧縮設定"));

  const edgeSelect = el("select", { class: "kp-imgc-select" }) as HTMLSelectElement;
  for (const v of MAX_LONG_EDGE_CHOICES) {
    edgeSelect.appendChild(el("option", { value: String(v) }, String(v)));
  }
  edgeSelect.value = String(s.maxLongEdge);
  compCard.appendChild(field("長辺の上限（px）", "", edgeSelect).wrap);

  const qualityInput = el("input", {
    class: "kp-imgc-number",
    type: "number",
    min: "0.5",
    max: "0.95",
    step: "0.05",
  }) as HTMLInputElement;
  qualityInput.value = String(s.jpegQuality);
  const qualityField = field(
    "JPEG品質",
    "小さいほど軽く、粗くなります。迷ったら0.8のままにしてください。",
    qualityInput,
  );
  compCard.appendChild(qualityField.wrap);

  const thresholdInput = el("input", {
    class: "kp-imgc-number",
    type: "number",
    min: "0",
    max: "10240",
    step: "1",
  }) as HTMLInputElement;
  thresholdInput.value = String(s.skipThresholdKB);
  const thresholdField = field(
    "圧縮しきい値（KB）",
    "このサイズ未満のファイルは圧縮せずそのまま添付します。",
    thresholdInput,
  );
  compCard.appendChild(thresholdField.wrap);

  const convertWrap = el("div", { class: "kp-imgc-field" });
  const convertLabel = el("label", { class: "kp-imgc-check" });
  const convertInput = el("input", { type: "checkbox" }) as HTMLInputElement;
  convertInput.checked = s.convertPngToJpeg;
  convertLabel.appendChild(convertInput);
  convertLabel.appendChild(el("span", {}, "透過のないPNGをJPEGに変換する"));
  convertWrap.appendChild(convertLabel);
  compCard.appendChild(convertWrap);

  const dateWrap = el("div", { class: "kp-imgc-field" });
  const dateLabel = el("label", { class: "kp-imgc-check" });
  const dateInput = el("input", { type: "checkbox" }) as HTMLInputElement;
  dateInput.checked = s.prependDateToFilename;
  dateLabel.appendChild(dateInput);
  dateLabel.appendChild(el("span", {}, "撮影日をファイル名に付ける（YYYYMMDD_）"));
  dateWrap.appendChild(dateLabel);
  dateWrap.appendChild(
    el(
      "p",
      { class: "kp-imgc-field__desc" },
      "圧縮でEXIF（撮影日時・位置情報）が消えるため、撮影日をファイル名に残せます。",
    ),
  );
  compCard.appendChild(dateWrap);
  inner.appendChild(compCard);

  // --- Display card ---
  const dispCard = el("section", { class: "kp-imgc-card" });
  dispCard.appendChild(el("h2", {}, "表示"));
  const labelInput = el("input", {
    class: "kp-imgc-text",
    type: "text",
    maxlength: "60",
  }) as HTMLInputElement;
  labelInput.value = s.buttonLabel;
  const labelField = field("ボタンの文言", "", labelInput);
  dispCard.appendChild(labelField.wrap);
  inner.appendChild(dispCard);

  // --- Save bar ---
  const cancel = el(
    "button",
    { class: "kp-imgc-btn-cfg kp-imgc-btn-text", type: "button" },
    "キャンセル",
  );
  const save = el(
    "button",
    { class: "kp-imgc-btn-cfg kp-imgc-btn-primary", type: "button" },
    "保存する",
  );
  const bar = el("div", { class: "kp-imgc-bar" });
  bar.appendChild(cancel);
  bar.appendChild(save);

  root.textContent = "";
  root.appendChild(inner);
  root.appendChild(bar);

  cancel.addEventListener("click", () => history.back());

  save.addEventListener("click", () => {
    clearError(spaceField.error);
    clearError(fileField.error);
    clearError(qualityField.error);
    clearError(thresholdField.error);
    clearError(labelField.error);

    let ok = true;
    const spaceElementId = spaceSelect.value;
    if (!spaceElementId) {
      showError(spaceField.error, "ボタンを置くスペースを選択してください");
      ok = false;
    } else if (!spacerIds.includes(spaceElementId)) {
      showError(
        spaceField.error,
        `スペース「${spaceElementId}」が見つかりません。別のスペースを選択してください。`,
      );
      ok = false;
    }

    const attachmentFieldCode = fileSelect.value;
    if (!attachmentFieldCode) {
      showError(fileField.error, "書き込み先の添付ファイルフィールドを選択してください");
      ok = false;
    } else if (!fileFields.some((f) => f.code === attachmentFieldCode)) {
      showError(
        fileField.error,
        `フィールド「${attachmentFieldCode}」が見つかりません。別のフィールドを選択してください。`,
      );
      ok = false;
    }

    const jpegQuality = Number(qualityInput.value);
    if (!Number.isFinite(jpegQuality) || jpegQuality < 0.5 || jpegQuality > 0.95) {
      showError(qualityField.error, "0.5から0.95の間で入力してください");
      ok = false;
    }

    const skipThresholdKB = Number(thresholdInput.value);
    if (!Number.isInteger(skipThresholdKB) || skipThresholdKB < 0 || skipThresholdKB > 10240) {
      showError(thresholdField.error, "0から10240の整数で入力してください");
      ok = false;
    }

    const buttonLabel = labelInput.value.trim();
    if (buttonLabel.length === 0) {
      showError(labelField.error, "ボタンの文言を入力してください");
      ok = false;
    } else if (buttonLabel.length > 30) {
      showError(labelField.error, "30文字以内で入力してください");
      ok = false;
    }

    if (!ok) return;

    const settings: Settings = {
      spaceElementId,
      attachmentFieldCode,
      maxLongEdge: Number(edgeSelect.value) as Settings["maxLongEdge"],
      jpegQuality,
      skipThresholdKB,
      convertPngToJpeg: convertInput.checked,
      prependDateToFilename: dateInput.checked,
      buttonLabel,
    };
    const parsed = configSchema.safeParse({ version: 1, settings });
    if (!parsed.success) {
      showError(labelField.error, "設定値が不正です。入力内容を確認してください");
      return;
    }
    kintone.plugin.app.setConfig({ [CONFIG_KEY]: serializeConfig(settings) });
  });
}

void render();
