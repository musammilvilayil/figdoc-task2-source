"use strict";
(() => {
  // figma-plugin/firebase-config.js
  var firebaseConfig = {
    apiKey: "AIzaSyBWczqu7J2-i7jKet57tUrtFRmLFDTgkGg",
    authDomain: "figdoc-e0f98.firebaseapp.com",
    projectId: "figdoc-e0f98",
    appId: "1:165477980876:web:7f5ffb71ece569e2d9c069"
  };
  var loginUrl = "https://figdoc-e0f98.firebaseapp.com/";

  // figma-plugin/figdoc/code.ts
  var busy = false;
  var authRevision = 0;
  var signedIn = false;
  async function verifyGoogle(token) {
    if (typeof token !== "string" || token.length > 15e3) throw new Error("Sign in with Google to continue.");
    const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + firebaseConfig.apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
    const body = await response.json();
    const user = body.users?.[0];
    if (!response.ok || !user?.emailVerified || !user.providerUserInfo?.some((provider) => provider.providerId === "google.com")) throw new Error("Your Google session expired. Sign in again.");
    return user;
  }
  function selectionStatus() {
    figma.ui.postMessage({ type: "selection", count: figma.currentPage.selection.length, selection: figma.currentPage.id + ":" + figma.currentPage.selection.map((node) => node.id).sort().join(",") });
  }
  figma.on("selectionchange", selectionStatus);
  figma.ui.onmessage = async (message) => {
    if (message.type === "ready") return selectionStatus();
    if (message.type === "open-login") {
      if (typeof message.url === "string" && message.url.startsWith(loginUrl + "#") && message.url.length < 4e3) figma.openExternal(message.url);
      return;
    }
    if (message.type === "signout") {
      authRevision++;
      signedIn = false;
      return;
    }
    if (message.type === "authenticate") {
      const revision2 = ++authRevision;
      signedIn = false;
      try {
        const user = await verifyGoogle(message.token);
        if (revision2 !== authRevision) return;
        signedIn = true;
        figma.ui.postMessage({ type: "authenticated", email: user.email });
      } catch (error) {
        if (revision2 === authRevision) figma.ui.postMessage({ type: "auth-error", message: error instanceof Error ? error.message : "Google sign-in could not be verified." });
      }
      return;
    }
    if (message.type !== "export" || busy) return;
    busy = true;
    const revision = authRevision;
    try {
      try {
        if (!signedIn) throw new Error("Sign in with Google before preparing a document.");
        await verifyGoogle(message.token);
      } catch (error) {
        signedIn = false;
        figma.ui.postMessage({ type: "auth-error", message: error instanceof Error ? error.message : "Unable to verify your Google account. Try again." });
        return;
      }
      if (revision !== authRevision) return;
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
      const payload = {
        format: "figdoc-plugin",
        version: 1,
        file: { name: figma.root.name, document: { id: "document", type: "DOCUMENT", children: [
          { id: page.id, name: page.name, type: "CANVAS", children }
        ] } }
      };
      if (revision === authRevision) figma.ui.postMessage({ type: "result", selection: selectionKey, json: JSON.stringify(payload), name: figma.root.name });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : "Export failed. Try a smaller selection." });
    } finally {
      busy = false;
    }
  };
  figma.showUI(__html__, { width: 380, height: 560, themeColors: true });
  selectionStatus();
})();
