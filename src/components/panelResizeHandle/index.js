import React, { Component } from "react";
import Grip from "./index.style";

// Controlled bottom-edge grip for an existing panel, not a panel container.
// Heights/bounds are finite CSS pixels with minHeight <= maxHeight. The parent
// owns height; a drag stores only its pointer identity and initial Y/height.
class PanelResizeHandle extends Component {
  static defaultProps = {
    minHeight: 140,
    maxHeight: 1600,
    label: "Resize panel height",
    disabled: false,
  };

  drag = null;

  componentDidUpdate() {
    if (this.props.disabled) this.stopDrag();
  }

  componentWillUnmount() {
    this.stopDrag();
  }

  stopDrag = () => {
    const drag = this.drag;
    if (!drag) return;
    // Clear before releasing capture: lostpointercapture can arrive immediately.
    this.drag = null;
    const { target, view, pointerId } = drag;
    view.removeEventListener("pointermove", this.onPointerMove);
    view.removeEventListener("pointerup", this.onPointerEnd);
    view.removeEventListener("pointercancel", this.onPointerEnd);
    view.removeEventListener("blur", this.stopDrag);
    try {
      if (target.releasePointerCapture &&
          (!target.hasPointerCapture || target.hasPointerCapture(pointerId))) {
        target.releasePointerCapture(pointerId);
      }
    } catch (error) {
      // The browser may already have released a cancelled or detached pointer.
    }
  };

  onPointerDown = event => {
    if (this.props.disabled || this.drag || event.button !== 0 ||
        event.isPrimary === false || event.pointerId == null) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const view = target.ownerDocument.defaultView;
    target.focus({ preventScroll: true });
    this.drag = {
      target,
      view,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: this.props.height,
    };
    // Window listeners also keep dragging outside the grip when capture is not
    // available. They exist only for the lifetime of this particular gesture.
    view.addEventListener("pointermove", this.onPointerMove);
    view.addEventListener("pointerup", this.onPointerEnd);
    view.addEventListener("pointercancel", this.onPointerEnd);
    view.addEventListener("blur", this.stopDrag);
    try {
      if (target.setPointerCapture) target.setPointerCapture(event.pointerId);
    } catch (error) {
      // Capture may fail if the pointer ceased being active before this handler.
    }
  };

  onPointerMove = event => {
    const drag = this.drag;
    if (!drag || this.props.disabled || event.pointerId !== drag.pointerId ||
        event.isPrimary === false) return;
    event.preventDefault();
    const { minHeight, maxHeight, onHeightChange } = this.props;
    const height = drag.startHeight + event.clientY - drag.startY;
    onHeightChange(Math.max(minHeight, Math.min(maxHeight, height)));
  };

  onPointerEnd = event => {
    if (this.drag && event.pointerId === this.drag.pointerId) this.stopDrag();
  };

  onKeyDown = event => {
    const { disabled, height, minHeight, maxHeight, onHeightChange } = this.props;
    if (disabled) return;
    let nextHeight;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft":
        nextHeight = height - 16;
        break;
      case "ArrowDown":
      case "ArrowRight":
        nextHeight = height + 16;
        break;
      case "Home":
        nextHeight = minHeight;
        break;
      case "End":
        nextHeight = maxHeight;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.stopDrag();
    onHeightChange(Math.max(minHeight, Math.min(maxHeight, nextHeight)));
  };

  render() {
    const { height, minHeight, maxHeight, label, disabled } = this.props;
    // Focusable separators have ARIA range values; the legacy lint role map
    // predates that support. Keep the actual separator semantics for readers.
    return (
      // eslint-disable-next-line jsx-a11y/role-supports-aria-props
      <Grip
        className="panel-resize-handle"
        role="separator"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={minHeight}
        aria-valuemax={maxHeight}
        aria-valuenow={height}
        aria-valuetext={`${height} pixels`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        title={label}
        onPointerDown={this.onPointerDown}
        onLostPointerCapture={this.onPointerEnd}
        onBlur={this.stopDrag}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}

export default PanelResizeHandle;
