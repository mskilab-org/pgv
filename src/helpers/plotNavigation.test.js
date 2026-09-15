import fs from "fs";
import path from "path";
import { allowPlotNavigation } from "./plotNavigation";

// Event shape: { type, button, metaKey?, ctrlKey?, shiftKey? }; setting: boolean.
// Template: reject nonprimary buttons, then allow non-wheel gestures; only wheel
// navigation depends on the setting and Command modifier.
describe("allowPlotNavigation", () => {
  test.each([true, false])("plain drag and double-click work with zoomedByCmd=%s", (zoomedByCmd) => {
    for (const type of ["mousedown", "pointerdown", "dblclick"]) {
      expect(allowPlotNavigation({ type, button: 0, metaKey: false }, zoomedByCmd)).toBe(true);
      expect(allowPlotNavigation({ type, button: 0, metaKey: true }, zoomedByCmd)).toBe(true);
    }
  });

  test.each([
    [true, false, false],
    [true, true, true],
    [false, false, true],
    [false, true, true],
    [undefined, false, true],
  ])("wheel with setting=%s and Command=%s allows=%s", (zoomedByCmd, metaKey, expected) => {
    expect(allowPlotNavigation({ type: "wheel", button: 0, metaKey }, zoomedByCmd)).toBe(expected);
  });

  test("Control or Shift alone does not bypass Command-wheel gating", () => {
    for (const modifier of ["ctrlKey", "shiftKey"]) {
      expect(allowPlotNavigation({ type: "wheel", button: 0, [modifier]: true }, true)).toBe(false);
      expect(allowPlotNavigation({ type: "mousedown", button: 0, [modifier]: true }, true)).toBe(true);
    }
  });

  test.each([true, false])("secondary buttons are rejected even with Command and setting=%s", (zoomedByCmd) => {
    for (const type of ["mousedown", "pointerdown", "dblclick", "wheel"]) {
      for (const button of [1, 2]) {
        for (const metaKey of [true, false]) {
          expect(allowPlotNavigation({ type, button, metaKey }, zoomedByCmd)).toBe(false);
        }
      }
    }
  });

  test("the predicate does not mutate the event", () => {
    const event = Object.freeze({ type: "wheel", button: 0, metaKey: true });
    expect(allowPlotNavigation(event, true)).toBe(true);
    expect(event).toEqual({ type: "wheel", button: 0, metaKey: true });
  });
});

// Characterize every existing lifecycle/transform filter without constructing
// React plots or their WebGL renderers. Behavioral cases live above.
describe("linked detail plot navigation wiring", () => {
  test.each(["genomePlot", "walkPlot", "genesPlot", "scatterPlot", "bigwigPlot", "barPlot"])(
    "%s uses the shared predicate for setup, updates, and transforms",
    (component) => {
      const source = fs.readFileSync(path.join(__dirname, "../components", component, "index.js"), "utf8");
      expect(source).toMatch(/import\s+\{\s*allowPlotNavigation\s*\}\s+from\s+["']\.\.\/\.\.\/helpers\/plotNavigation["']/);
      const setupMethod = component === "genesPlot" ? "updateStage" : "componentDidMount";
      for (const method of [setupMethod, "componentDidUpdate"]) {
        const methodStart = source.indexOf(`  ${method}(`);
        expect(methodStart).toBeGreaterThan(-1);
        const methodEnd = source.indexOf("\n  }", methodStart);
        const body = source.slice(methodStart, methodEnd);
        expect(body.match(/panel\.zoom\.filter\(/g)).toHaveLength(2);
        expect(body.match(/panel\.zoom\.filter\(\s*\(event\)\s*=>\s*allowPlotNavigation\(event,\s*zoomedByCmd\)\s*\)/g)).toHaveLength(2);
        expect(body.match(/\)\.transform,/g)).toHaveLength(1);
      }
      expect(source.match(/panel\.zoom\.filter\(/g)).toHaveLength(4);
      expect(source).not.toContain("!zoomedByCmd || (!event.button && event.metaKey)");
      if (component === "genesPlot") {
        const mount = source.slice(source.indexOf("  componentDidMount("), source.indexOf("  componentDidUpdate("));
        expect(mount).toContain("this.updateStage()");
      }
    }
  );
});
