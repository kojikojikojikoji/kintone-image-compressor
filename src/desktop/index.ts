import { CONFIG_KEY, parseConfig } from "../core";
import { CanvasImageCompressor } from "../kintone/compressor";
import { KintoneGateway } from "../kintone/rest";
import { mountButton, type Platform } from "../kintone/controller";

// Desktop entry. Registers the create/edit show handlers and mounts the compress
// button. When the plugin is not configured, parseConfig returns null and the
// handlers do nothing (common spec 4): no button, no console error.
const config = parseConfig(kintone.plugin.app.getConfig(kintone.$PLUGIN_ID)?.[CONFIG_KEY]);

if (config) {
  const settings = config.settings;
  const gateway = new KintoneGateway();
  const compressor = new CanvasImageCompressor();
  const platform: Platform = {
    kind: "desktop",
    recordApi: kintone.app.record,
    enableDragDrop: true,
  };

  kintone.events.on(["app.record.create.show", "app.record.edit.show"], (event) => {
    mountButton(platform, settings, compressor, gateway);
    return event;
  });
}
