import { CONFIG_KEY, parseConfig } from "../core";
import { CanvasImageCompressor } from "../kintone/compressor";
import { KintoneGateway } from "../kintone/rest";
import { mountButton, type Platform } from "../kintone/controller";

// Mobile entry. Same button and pipeline as desktop, minus drag-and-drop (FR-3
// is desktop only). Uses the mobile record API, which has the same get/set/
// getSpaceElement shape.
const config = parseConfig(kintone.plugin.app.getConfig(kintone.$PLUGIN_ID)?.[CONFIG_KEY]);

if (config) {
  const settings = config.settings;
  const gateway = new KintoneGateway();
  const compressor = new CanvasImageCompressor();
  const platform: Platform = {
    kind: "mobile",
    recordApi: kintone.mobile.app.record,
    enableDragDrop: false,
  };

  kintone.events.on(["mobile.app.record.create.show", "mobile.app.record.edit.show"], (event) => {
    mountButton(platform, settings, compressor, gateway);
    return event;
  });
}
