// Keep primary-button gestures free; Command gating applies only to wheel zoom.
export function allowPlotNavigation(event, zoomedByCmd) {
  return (
    !event.button &&
    (event.type !== "wheel" || !zoomedByCmd || !!event.metaKey)
  );
}
