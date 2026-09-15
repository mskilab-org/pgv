import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import PanelResizeHandle from "./index";

// Data: controlled finite pixel height/bounds; drag is absent or a pointer ID,
// initial Y/height, and capture target. Template: guard start; save snapshot;
// match moves and clamp snapshot + delta; clear on end/cancel/blur/unmount;
// branch on resizing keys; render the supplied height, never a local height.
// Examples: 640 + 100 = 740, extreme deltas reach bounds, other IDs do nothing.

// Legacy jsdom has no PointerEvent constructor. Preserve actual DOM dispatch
// while explicitly supplying the pointer fields consumed by the component.
function pointer(target, type, overrides = {}) {
  const { pointerId = 7, isPrimary = true, ...init } = overrides;
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
    clientY: 100,
    ...init,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: isPrimary },
  });
  fireEvent(target, event);
  return event;
}

function setup(extra = {}) {
  const props = { height: 640, onHeightChange: jest.fn(), ...extra };
  const ui = render(<PanelResizeHandle {...props} />);
  const handle = ui.getByRole("separator");
  const captured = new Set();
  handle.setPointerCapture = jest.fn(id => captured.add(id));
  handle.hasPointerCapture = jest.fn(id => captured.has(id));
  handle.releasePointerCapture = jest.fn(id => captured.delete(id));
  return { ...ui, props, handle };
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test("renders a focusable horizontal separator with controlled pixel height and default limits", () => {
  const { handle, props } = setup();
  expect(handle.getAttribute("aria-label")).toBe("Resize panel height");
  expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
  expect(handle.getAttribute("aria-valuemin")).toBe("140");
  expect(handle.getAttribute("aria-valuemax")).toBe("1600");
  expect(handle.getAttribute("aria-valuenow")).toBe("640");
  expect(handle.getAttribute("aria-valuetext")).toBe("640 pixels");
  expect(handle.getAttribute("aria-disabled")).toBe("false");
  expect(handle.tabIndex).toBe(0);
  expect(props.onHeightChange).not.toHaveBeenCalled();
});

test("captures and focuses the grip; drag emits snapshot plus delta without owning height", () => {
  const { handle, props } = setup();
  const down = pointer(handle, "pointerdown");
  expect(down.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(handle);
  expect(handle.setPointerCapture).toHaveBeenCalledWith(7);
  expect(props.onHeightChange).not.toHaveBeenCalled();
  pointer(window, "pointermove", { clientY: 200 });
  pointer(window, "pointermove", { clientY: 250 });
  pointer(window, "pointermove", { clientY: 50 });
  expect(props.onHeightChange.mock.calls).toEqual([[740], [790], [590]]);
  expect(handle.getAttribute("aria-valuenow")).toBe("640");
  pointer(window, "pointerup");
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
  pointer(window, "pointermove", { clientY: 400 });
  expect(props.onHeightChange).toHaveBeenCalledTimes(3);
});

test.each([
  [-10000, 140],
  [10000, 1600],
  [-500, 140],
  [960, 1600],
])("clamps a pointer delta of %s to %s", (delta, expected) => {
  const { handle, props } = setup();
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 100 + delta });
  expect(props.onHeightChange).toHaveBeenCalledWith(expected);
});

test("honors custom limits and label, including a pinned maximum", () => {
  const { handle, props } = setup({ minHeight: 200, maxHeight: 700, label: "Resize tree panel" });
  expect(handle.getAttribute("aria-label")).toBe("Resize tree panel");
  expect(handle.getAttribute("aria-valuemin")).toBe("200");
  expect(handle.getAttribute("aria-valuemax")).toBe("700");
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 300 });
  pointer(window, "pointermove", { clientY: -1000 });
  expect(props.onHeightChange.mock.calls).toEqual([[700], [200]]);
});

test("parent updates change ARIA and callbacks but never rebase an active drag", () => {
  const { handle, props, rerender } = setup();
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 200 });
  const onHeightChange = jest.fn();
  rerender(<PanelResizeHandle {...props} height={740} onHeightChange={onHeightChange} />);
  expect(handle.getAttribute("aria-valuenow")).toBe("740");
  pointer(window, "pointermove", { clientY: 250 });
  expect(onHeightChange).toHaveBeenLastCalledWith(790);
  expect(props.onHeightChange.mock.calls).toEqual([[740]]);
  rerender(<PanelResizeHandle {...props} height={740} maxHeight={760} onHeightChange={onHeightChange} />);
  pointer(window, "pointermove", { clientY: 300 });
  expect(onHeightChange).toHaveBeenLastCalledWith(760);
  pointer(window, "pointerup");
  pointer(handle, "pointerdown", { clientY: 500 });
  pointer(window, "pointermove", { clientY: 480 });
  expect(onHeightChange).toHaveBeenLastCalledWith(720);
});

test.each([
  { button: 1 },
  { button: 2 },
  { button: 5 },
  { isPrimary: false },
])("ignores a nonprimary pointer/button: %j", init => {
  const { handle, props } = setup();
  const down = pointer(handle, "pointerdown", init);
  pointer(window, "pointermove", { clientY: 200 });
  pointer(window, "pointerup");
  expect(down.defaultPrevented).toBe(false);
  expect(handle.setPointerCapture).not.toHaveBeenCalled();
  expect(props.onHeightChange).not.toHaveBeenCalled();
});

test("ignores other pointer IDs and cannot replace the active snapshot", () => {
  const { handle, props } = setup();
  pointer(handle, "pointerdown");
  pointer(handle, "pointerdown", { pointerId: 9, clientY: 900 });
  pointer(window, "pointermove", { pointerId: 9, clientY: 1000 });
  pointer(window, "pointerup", { pointerId: 9 });
  pointer(window, "pointercancel", { pointerId: 9 });
  pointer(handle, "lostpointercapture", { pointerId: 9 });
  pointer(window, "pointermove", { isPrimary: false, clientY: 500 });
  expect(props.onHeightChange).not.toHaveBeenCalled();
  pointer(window, "pointermove", { clientY: 200 });
  expect(props.onHeightChange.mock.calls).toEqual([[740]]);
  expect(handle.setPointerCapture).toHaveBeenCalledTimes(1);
});

test.each(["pointerup", "pointercancel", "lostpointercapture", "grip blur", "window blur"])(
  "%s ends the drag, releases capture, and permits a fresh snapshot",
  ending => {
    const { handle, props } = setup();
    pointer(handle, "pointerdown");
    if (ending === "grip blur") fireEvent.blur(handle);
    else if (ending === "window blur") fireEvent(window, new Event("blur"));
    else pointer(ending === "lostpointercapture" ? handle : window, ending);
    expect(handle.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
    pointer(window, "pointermove", { clientY: 200 });
    pointer(window, "pointerup");
    expect(props.onHeightChange).not.toHaveBeenCalled();
    pointer(handle, "pointerdown", { pointerId: 8, clientY: 300 });
    pointer(window, "pointermove", { pointerId: 8, clientY: 400 });
    expect(props.onHeightChange.mock.calls).toEqual([[740]]);
  }
);

test("unmount removes every drag listener and releases capture without late callbacks", () => {
  const { handle, props, unmount } = setup();
  const add = jest.spyOn(window, "addEventListener");
  const remove = jest.spyOn(window, "removeEventListener");
  pointer(handle, "pointerdown");
  const dragListeners = add.mock.calls.filter(([type]) =>
    ["pointermove", "pointerup", "pointercancel", "blur"].includes(type)
  );
  expect(dragListeners.map(([type]) => type).sort()).toEqual(["blur", "pointercancel", "pointermove", "pointerup"]);
  unmount();
  dragListeners.forEach(([type, listener]) => {
    expect(remove.mock.calls.some(args => args[0] === type && args[1] === listener)).toBe(true);
    // Even an already-queued native move cannot notify after unmount.
    if (type === "pointermove") listener({ pointerId: 7, clientY: 500 });
  });
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
  pointer(window, "pointermove", { clientY: 500 });
  pointer(window, "pointerup");
  fireEvent(window, new Event("blur"));
  expect(props.onHeightChange).not.toHaveBeenCalled();
});

test.each(["absent", "throws"])("window fallback works when pointer capture is %s", mode => {
  const { handle, props, unmount } = setup();
  if (mode === "absent") {
    handle.setPointerCapture = undefined;
    handle.releasePointerCapture = undefined;
  } else {
    handle.setPointerCapture.mockImplementation(() => { throw new Error("Pointer no longer active"); });
  }
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 200 });
  expect(props.onHeightChange).toHaveBeenCalledWith(740);
  expect(() => unmount()).not.toThrow();
  pointer(window, "pointermove", { clientY: 300 });
  expect(props.onHeightChange).toHaveBeenCalledTimes(1);
});

test("capture release failure cannot prevent listener cleanup", () => {
  const { handle, props } = setup();
  handle.releasePointerCapture.mockImplementation(() => { throw new Error("Pointer already released"); });
  pointer(handle, "pointerdown");
  expect(() => pointer(window, "pointercancel")).not.toThrow();
  pointer(window, "pointermove", { clientY: 300 });
  expect(props.onHeightChange).not.toHaveBeenCalled();
});

test.each([
  ["ArrowUp", 624],
  ["ArrowDown", 656],
  ["ArrowLeft", 624],
  ["ArrowRight", 656],
  ["Home", 140],
  ["End", 1600],
])("%s emits %s using the controlled height", (key, expected) => {
  const { handle, props } = setup();
  expect(fireEvent.keyDown(handle, { key })).toBe(false);
  expect(props.onHeightChange.mock.calls).toEqual([[expected]]);
  expect(handle.getAttribute("aria-valuenow")).toBe("640");
});

test.each([
  [145, "ArrowUp", 140],
  [1595, "ArrowDown", 1600],
  [140, "ArrowUp", 140],
  [1600, "ArrowDown", 1600],
])("keyboard movement clamps height %s with %s to %s", (height, key, expected) => {
  const { handle, props } = setup({ height });
  fireEvent.keyDown(handle, { key });
  expect(props.onHeightChange).toHaveBeenCalledWith(expected);
});

test("keyboard uses updated height and bounds, ignoring unrelated keys and cancelling an old drag", () => {
  const { handle, props, rerender } = setup();
  expect(fireEvent.keyDown(handle, { key: "Tab" })).toBe(true);
  expect(fireEvent.keyDown(handle, { key: "Enter" })).toBe(true);
  expect(props.onHeightChange).not.toHaveBeenCalled();
  rerender(<PanelResizeHandle {...props} height={400} minHeight={300} maxHeight={500} />);
  pointer(handle, "pointerdown");
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  fireEvent.keyDown(handle, { key: "Home" });
  fireEvent.keyDown(handle, { key: "End" });
  pointer(window, "pointermove", { clientY: 200 });
  expect(props.onHeightChange.mock.calls).toEqual([[416], [300], [500]]);
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
});

test("disabled grip is not tabbable and ignores pointer and keyboard input", () => {
  const { handle, props } = setup({ disabled: true });
  expect(handle.getAttribute("aria-disabled")).toBe("true");
  expect(handle.tabIndex).toBe(-1);
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 200 });
  expect(fireEvent.keyDown(handle, { key: "ArrowDown" })).toBe(true);
  expect(fireEvent.keyDown(handle, { key: "End" })).toBe(true);
  expect(handle.setPointerCapture).not.toHaveBeenCalled();
  expect(props.onHeightChange).not.toHaveBeenCalled();
});

test("disabling during a drag releases capture and re-enabling cannot resume it", () => {
  const { handle, props, rerender } = setup();
  pointer(handle, "pointerdown");
  rerender(<PanelResizeHandle {...props} disabled />);
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
  pointer(window, "pointermove", { clientY: 200 });
  rerender(<PanelResizeHandle {...props} />);
  pointer(window, "pointermove", { clientY: 300 });
  expect(props.onHeightChange).not.toHaveBeenCalled();
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(props.onHeightChange).toHaveBeenCalledWith(656);
});

test("fixed min/max is a valid bounded separator", () => {
  const { handle, props } = setup({ height: 400, minHeight: 400, maxHeight: 400 });
  pointer(handle, "pointerdown");
  pointer(window, "pointermove", { clientY: 200 });
  fireEvent.keyDown(handle, { key: "Home" });
  fireEvent.keyDown(handle, { key: "End" });
  expect(props.onHeightChange.mock.calls).toEqual([[400], [400], [400]]);
});
