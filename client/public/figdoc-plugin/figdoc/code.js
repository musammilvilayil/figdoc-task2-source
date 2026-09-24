"use strict";
(() => {
  // figma-plugin/figdoc/code.ts
  var busy = false;
  function selectionStatus() {
    figma.ui.postMessage({ type: "selection", count: figma.currentPage.selection.length, selection: figma.currentPage.id + ":" + figma.currentPage.selection.map((node) => node.id).sort().join(",") });
  }
  figma.on("selectionchange", selectionStatus);
  figma.ui.onmessage = async (message) => {
    if (message.type === "ready") return selectionStatus();
    if (message.type !== "export" || busy) return;
    busy = true;
    try {
      const page = figma.currentPage;
      const selection = [...page.selection];
      const selectionKey = page.id + ":" + selection.map((node) => node.id).sort().join(",");
      if (!selection.length) throw new Error("Select at least one frame or layer in Figma.");
      const ids = new Set(selection.map((node) => node.id));
      const roots = selection.filter((node) => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ids.has(parent.id)) return false;
        }
        return true;
      });
      const children = [];
      for (const node of roots) {
        const result = await node.exportAsync({ format: "JSON_REST_V1" });
        if (!result.document) throw new Error("Figma could not export this selection.");
        children.push(result.document);
      }
      const previews = [];
      const imageAssets = [];
      const previewWarnings = [];
      let imageBytes = 0;
      async function collect(node, sectionId) {
        const structural = ["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE"].includes(node.type);
        const owner = structural ? node.id : sectionId;
        if ("fills" in node && Array.isArray(node.fills) && node.fills.some((paint) => paint.type === "IMAGE")) imageAssets.push({ name: node.name, sectionId: owner });
        if (structural && "exportAsync" in node && node.width > 0 && node.height > 0) {
          if (previews.length < 40 && imageBytes < 5 * 1024 * 1024) {
            try {
              const scale = Math.min(900 / node.width, 650 / node.height, 1);
              const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
              if (imageBytes + bytes.length <= 5 * 1024 * 1024) {
                imageBytes += bytes.length;
                previews.push({ id: node.id, name: node.name, page: page.name, width: node.width * scale, height: node.height * scale, data: "data:image/png;base64," + figma.base64Encode(bytes) });
              } else previewWarnings.push("Preview omitted due to export size: " + node.name);
            } catch {
              previewWarnings.push("Preview unavailable: " + node.name);
            }
          } else previewWarnings.push("Preview omitted due to export limit: " + node.name);
        }
        if ("children" in node) for (const child of node.children) await collect(child, owner);
      }
      for (const node of roots) await collect(node, node.id);
      const payload = {
        previews,
        imageAssets,
        previewWarnings,
        format: "figdoc-plugin",
        version: 1,
        file: { name: figma.root.name, document: { id: "document", type: "DOCUMENT", children: [
          { id: page.id, name: page.name, type: "CANVAS", children }
        ] } }
      };
      figma.ui.postMessage({ type: "result", selection: selectionKey, json: JSON.stringify(payload), name: figma.root.name });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : "Export failed. Try a smaller selection." });
    } finally {
      busy = false;
    }
  };
  figma.showUI(__html__, { width: 380, height: 560, themeColors: true });
  selectionStatus();
})();
