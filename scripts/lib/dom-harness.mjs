// Minimal DOM harness so the public interface can be rendered and inspected in Node
// without a browser or a third-party DOM dependency. It records every write that
// app.js makes to innerHTML and textContent, which is what the rendered page shows.

import fs from "node:fs/promises";
import path from "node:path";

class StubElement {
  constructor(selector, harness) {
    this.selector = selector;
    this.harness = harness;
    this.dataset = {};
    this.hidden = false;
    this.value = "";
    this.listeners = new Map();
    this._innerHTML = "";
    this._textContent = "";
    this.classList = {
      toggle: () => {},
      add: () => {},
      remove: () => {},
      contains: () => false,
    };
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.harness.record(this.selector, this._innerHTML);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.harness.record(this.selector, this._textContent);
  }

  get textContent() {
    return this._textContent;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, event) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }

  querySelector(selector) {
    return this.harness.element(`${this.selector} ${selector}`);
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  showModal() {
    this.harness.opened.add(this.selector);
  }

  close() {}
}

export class DomHarness {
  constructor({ dataRoot, baseHref = "https://kkailab.github.io/ferroscope/" }) {
    this.dataRoot = dataRoot;
    this.baseHref = baseHref;
    this.elements = new Map();
    this.writes = [];
    this.opened = new Set();
    this.fetched = [];
  }

  record(selector, html) {
    this.writes.push({ selector, html });
  }

  element(selector) {
    if (!this.elements.has(selector)) this.elements.set(selector, new StubElement(selector, this));
    return this.elements.get(selector);
  }

  // Everything rendered into a container matching one of the given selectors.
  htmlFor(...selectors) {
    const wanted = new Set(selectors);
    return this.writes.filter((write) => wanted.has(write.selector)).map((write) => write.html).join("\n");
  }

  allHtml() {
    return this.writes.map((write) => write.html).join("\n");
  }

  // Everything rendered outside the given selectors.
  htmlExcept(...selectors) {
    const excluded = new Set(selectors);
    return this.writes.filter((write) => !excluded.has(write.selector)).map((write) => write.html).join("\n");
  }

  install() {
    const harness = this;
    globalThis.location = { href: this.baseHref };
    globalThis.document = {
      querySelector: (selector) => harness.element(selector),
      querySelectorAll: () => [],
      createElement: () => new StubElement("created", harness),
      body: new StubElement("body", harness),
    };
    globalThis.fetch = async (resource) => {
      const relative = String(resource).replace(/^\.\//, "");
      harness.fetched.push(relative);
      const file = path.join(harness.dataRoot, relative);
      try {
        const text = await fs.readFile(file, "utf8");
        return { ok: true, status: 200, statusText: "OK", json: async () => JSON.parse(text) };
      } catch (error) {
        return {
          ok: false,
          status: 404,
          statusText: `not found (${error.code || error.message})`,
          json: async () => {
            throw error;
          },
        };
      }
    };
    return this;
  }

  uninstall() {
    delete globalThis.document;
    delete globalThis.fetch;
    delete globalThis.location;
  }
}

export const cjkPattern = /[㐀-鿿぀-ヿ가-힯]/u;

// Report the CJK runs found in a blob of rendered HTML, with a little context
// so a failing test points at the offending string rather than the whole page.
export function cjkFindings(html, limit = 8) {
  const findings = [];
  const matcher = /[㐀-鿿぀-ヿ가-힯][^<>]{0,40}/gu;
  for (const match of html.matchAll(matcher)) {
    const start = Math.max(0, match.index - 60);
    findings.push(`…${html.slice(start, match.index + match[0].length).replace(/\s+/g, " ")}…`);
    if (findings.length >= limit) break;
  }
  return findings;
}
