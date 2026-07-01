// All DOM coupling for the record screen lives here (common spec 4). This plugin
// only ever touches its own elements, which it creates, plus the space element
// returned by the official kintone.app.record.getSpaceElement API. It does not
// rely on kintone's internal markup or selectors, so there is nothing here that
// a kintone UI update would break. Classes and ids use the kp-imgc- prefix to
// avoid colliding with other plugins in this series.

export const PREFIX = "kp-imgc";
export const RESULT_ID = `${PREFIX}-result`;
export const STYLE_ID = `${PREFIX}-style`;

/** Create an element with attributes and optional text in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Styles for the button and result area. Injected once per page. Colors follow
// the record-screen guidance in section 6 (match kintone, restrained shadows).
const CSS = `
.${PREFIX}-btn{display:inline-flex;align-items:center;gap:6px;min-width:200px;height:40px;
padding:0 14px;box-sizing:border-box;background:#fff;border:1px solid #e3e7e8;border-radius:4px;
color:#3d4b5b;font-size:14px;line-height:1;cursor:pointer;
font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic UI",Meiryo,sans-serif;}
.${PREFIX}-btn:hover:not(:disabled){background:#f7f9fa;}
.${PREFIX}-btn:disabled{cursor:not-allowed;opacity:.7;}
.${PREFIX}-btn.${PREFIX}-dragover{border:2px solid #0f6db3;background:#f0f7fc;}
.${PREFIX}-btn svg{flex:0 0 auto;}
.${PREFIX}-spinner{width:14px;height:14px;border:2px solid #c3ccd6;border-top-color:#0f6db3;
border-radius:50%;animation:${PREFIX}-spin .8s linear infinite;}
@keyframes ${PREFIX}-spin{to{transform:rotate(360deg);}}
.${PREFIX}-result{margin-top:8px;font-size:13px;color:#3d4b5b;
font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic UI",Meiryo,sans-serif;}
.${PREFIX}-progress{height:4px;background:#e3e7e8;border-radius:2px;overflow:hidden;margin:6px 0;}
.${PREFIX}-progress-bar{height:100%;background:#0f6db3;width:0;transition:width .2s;}
.${PREFIX}-count{font-size:13px;color:#5f6b7a;margin-bottom:4px;}
.${PREFIX}-row{padding:2px 0;}
.${PREFIX}-row-failed{color:#b3261e;}
.${PREFIX}-total{padding-top:4px;margin-top:4px;border-top:1px solid #e3e7e8;font-weight:600;}
.${PREFIX}-mobile .${PREFIX}-btn{width:100%;height:44px;}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Down-arrow-over-image monoline icon (16px) shown on the button (section 6). */
export function buttonIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  const paths = [
    { d: "M2 3.5h9v6H2z", stroke: "#5f6b7a", extra: { rx: "1" } },
    { d: "M3 9l2.5-2.5L7.5 8.5 9 7l2 2", stroke: "#5f6b7a" },
    { d: "M13 6v7", stroke: "#0f6db3" },
    { d: "M10.5 10.5L13 13l2.5-2.5", stroke: "#0f6db3" },
  ];
  for (const p of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", p.d);
    path.setAttribute("stroke", p.stroke);
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
  }
  return svg;
}
