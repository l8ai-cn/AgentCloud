import "@testing-library/jest-dom/vitest";

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;

Element.prototype.scrollIntoView = () => {};
Element.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number) {
  if (typeof options === "object" && typeof options.top === "number") {
    this.scrollTop = options.top;
  }
};
