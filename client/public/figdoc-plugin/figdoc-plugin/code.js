"use strict";
(() => {
  // figma-plugin/selection.js
  function documentationRoots(selection) {
    const candidates = selection.map((node) => {
      let root = node;
      for (let parent = node.parent; parent && !["CANVAS", "DOCUMENT", "SECTION"].includes(parent.type); parent = parent.parent) {
        if (["FRAME", "COMPONENT", "INSTANCE", "COMPONENT_SET"].includes(parent.type)) root = parent;
      }
      return root;
    });
    const ids = new Set(candidates.map((node) => node.id));
    const roots = [...new Map(candidates.map((node) => [node.id, node])).values()].filter((node) => {
      for (let parent = node.parent; parent; parent = parent.parent) if (ids.has(parent.id)) return false;
      return true;
    });
    const order = (node) => {
      const path = [];
      for (let n = node; n.parent; n = n.parent) path.unshift(n.parent.children?.indexOf(n) ?? 0);
      return path;
    };
    return roots.sort((a, b) => {
      const x = order(a), y = order(b);
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
      return x.length - y.length;
    });
  }
  function pngDimensions(bytes, fallbackWidth, fallbackHeight) {
    if (bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
      const read = (offset) => bytes[offset] * 16777216 + bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
      const width = read(16), height = read(20);
      if (width > 0 && height > 0) return { width, height };
    }
    return { width: Math.max(1, Math.round(fallbackWidth)), height: Math.max(1, Math.round(fallbackHeight)) };
  }
  function pageDocumentationRoots(page) {
    const roots = [];
    function visit(node) {
      if (node.visible === false) return;
      if (node.type === "SECTION") {
        for (const child of node.children || []) visit(child);
      } else roots.push(node);
    }
    for (const child of page.children || []) visit(child);
    return roots;
  }

  // figma-plugin/figdoc/code.ts
  var busy = false;
  var scopeMode = "page";
  function exportRoots() {
    return scopeMode === "page" ? pageDocumentationRoots(figma.currentPage) : documentationRoots([...figma.currentPage.selection]);
  }
  function scopeKey() {
    return figma.currentPage.id + ":" + scopeMode + ":" + exportRoots().map((node) => node.id).join(",");
  }
  function selectionStatus() {
    const roots = exportRoots();
    figma.ui.postMessage({ type: "selection", count: roots.length, scopeMode, pageName: figma.currentPage.name, scope: roots.map((node) => node.name).join(", "), selection: scopeKey() });
  }
  figma.on("selectionchange", selectionStatus);
  figma.on("currentpagechange", selectionStatus);
  figma.ui.onmessage = async (message) => {
    if (message.type === "ready") return selectionStatus();
    if (message.type === "scope" && !busy) {
      scopeMode = message.scope === "selection" ? "selection" : "page";
      return selectionStatus();
    }
    if (message.type !== "export" || busy) return;
    busy = true;
    try {
      let hydrate2 = function(raw, live) {
        const result = { ...raw, id: live.id, name: live.name || raw?.name, type: live.type || raw?.type };
        const properties = [
          "visible",
          "locked",
          "opacity",
          "blendMode",
          "x",
          "y",
          "width",
          "height",
          "rotation",
          "absoluteBoundingBox",
          "relativeTransform",
          "constraints",
          "fills",
          "strokes",
          "strokeWeight",
          "strokeAlign",
          "strokeTopWeight",
          "strokeRightWeight",
          "strokeBottomWeight",
          "strokeLeftWeight",
          "dashPattern",
          "cornerRadius",
          "topLeftRadius",
          "topRightRadius",
          "bottomLeftRadius",
          "bottomRightRadius",
          "effects",
          "layoutMode",
          "layoutWrap",
          "layoutSizingHorizontal",
          "layoutSizingVertical",
          "primaryAxisAlignItems",
          "counterAxisAlignItems",
          "itemSpacing",
          "counterAxisSpacing",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "layoutAlign",
          "layoutGrow",
          "layoutPositioning",
          "clipsContent",
          "minWidth",
          "maxWidth",
          "minHeight",
          "maxHeight",
          "componentProperties",
          "variantProperties",
          "reactions",
          "boundVariables",
          "exportSettings",
          "description",
          "isMask",
          "maskType",
          "booleanOperation",
          "textAlignHorizontal",
          "textAlignVertical",
          "textAutoResize",
          "letterSpacing",
          "lineHeight",
          "paragraphSpacing",
          "textCase",
          "textDecoration"
        ];
        const unavailable = [];
        for (const key of properties) {
          if (!(key in live)) continue;
          try {
            const value = live[key];
            if (typeof value === "symbol") {
              unavailable.push(key + ": mixed values");
              continue;
            }
            if (value !== void 0) result[key] = JSON.parse(JSON.stringify(value));
          } catch {
            unavailable.push(key + ": unavailable");
          }
        }
        if (unavailable.length) result.extractionNotes = unavailable;
        if (live.type === "TEXT") {
          result.characters = live.characters;
          if (typeof live.getStyledTextSegments === "function") {
            try {
              result.textSegments = live.getStyledTextSegments(["fontName", "fontSize", "fontWeight", "fills", "textDecoration", "textCase", "letterSpacing", "lineHeight", "hyperlink"]);
            } catch {
              result.extractionNotes = [...result.extractionNotes || [], "Styled text segments unavailable"];
            }
          }
          const font = live.fontName;
          result.style = {
            ...raw?.style,
            ...typeof live.fontSize === "number" ? { fontSize: live.fontSize } : {},
            ...font && typeof font === "object" ? { fontFamily: font.family } : {},
            ...live.hyperlink && typeof live.hyperlink === "object" ? { hyperlink: live.hyperlink } : {}
          };
        }
        if ("children" in live) result.children = live.children.map((child) => hydrate2(raw?.children?.find((item) => item.id === child.id), child));
        return result;
      };
      var hydrate = hydrate2;
      const page = figma.currentPage;
      const selection = [...page.selection];
      const selectionKey = scopeKey();
      const roots = exportRoots();
      if (!roots.length) throw new Error(scopeMode === "page" ? "This page has no visible designs to document." : "Select a frame or switch to Current page.");
      const children = [];
      for (const [index, node] of roots.entries()) {
        figma.ui.postMessage({ type: "progress", message: "Reading screen " + (index + 1) + " of " + roots.length + ": " + node.name });
        const result = await node.exportAsync({ format: "JSON_REST_V1" });
        if (!result.document) throw new Error("Figma could not export this selection.");
        children.push(hydrate2(result.document, node));
      }
      const previews = [];
      const imageAssets = [];
      const previewWarnings = [];
      const previewIds = new Set(roots.map((node) => node.id));
      for (const root of roots) {
        let parent = root;
        if (scopeMode === "page") {
          while ("children" in parent) {
            const visible = parent.children.filter((child) => child.visible !== false);
            if (visible.length !== 1 || !["FRAME", "GROUP"].includes(visible[0].type)) break;
            parent = visible[0];
          }
        }
        if ("children" in parent) for (const child of parent.children) {
          if (["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP"].includes(child.type)) previewIds.add(child.id);
        }
      }
      let imageBytes = 0;
      async function collect(node, sectionId, imagesOnly) {
        if (node.visible === false) return;
        const structural = ["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP"].includes(node.type);
        const owner = structural || roots.includes(node) ? node.id : sectionId;
        const isImage = "fills" in node && Array.isArray(node.fills) && node.fills.some((paint) => paint.type === "IMAGE");
        if (isImage && imagesOnly) imageAssets.push({ id: node.id, name: node.name, sectionId: owner });
        if ((imagesOnly ? isImage : previewIds.has(node.id) && !isImage) && "exportAsync" in node && node.width > 0 && node.height > 0) {
          if (previews.length < 300 && imageBytes < 24 * 1024 * 1024) {
            try {
              const scale = Math.min(900 / node.width, 650 / node.height, 1);
              const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
              if (imageBytes + bytes.length <= 24 * 1024 * 1024) {
                imageBytes += bytes.length;
                previews.push({ id: node.id, name: node.name, page: page.name, ...pngDimensions(bytes, node.width * scale, node.height * scale), data: "data:image/png;base64," + figma.base64Encode(bytes), kind: isImage ? "image-layer" : "component" });
              } else {
                if (isImage) throw new Error("Image size limit reached. Select fewer frames so every image can be included.");
                previewWarnings.push("Preview omitted due to export size: " + node.name);
              }
            } catch (error) {
              if (isImage) throw new Error("Could not include picture for " + node.name + ". Select fewer layers or check that this image layer can be exported. " + (error instanceof Error ? error.message : ""));
              previewWarnings.push("Preview unavailable: " + node.name);
            }
          } else {
            if (isImage) throw new Error("Image limit reached. Export fewer frames at a time to include every picture.");
            previewWarnings.push("Preview omitted due to export limit: " + node.name);
          }
        }
        if ("children" in node) for (const child of node.children) await collect(child, owner, imagesOnly);
      }
      for (const [index, node] of roots.entries()) {
        figma.ui.postMessage({ type: "progress", message: "Capturing images for screen " + (index + 1) + " of " + roots.length });
        await collect(node, node.id, true);
      }
      for (const node of roots) await collect(node, node.id, false);
      const payload = {
        previews,
        imageAssets,
        previewWarnings,
        scope: { mode: scopeMode, pageName: page.name, selectedCount: selection.length, frameNames: roots.map((node) => node.name), expanded: roots.some((node) => !selection.includes(node)) },
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
