import styled from "styled-components";

const Grip = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  height: 24px;
  margin-top: 8px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  color: #8c8c8c;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;

  &::after {
    content: "";
    width: 36px;
    height: 5px;
    border-top: 1px solid currentColor;
    border-bottom: 1px solid currentColor;
  }

  &:hover:not([aria-disabled="true"]),
  &:active:not([aria-disabled="true"]) {
    background: #e6f7ff;
    color: #1890ff;
  }

  &:focus {
    outline: 2px solid #1890ff;
    outline-offset: -2px;
  }

  &[aria-disabled="true"] {
    cursor: default;
    touch-action: auto;
    opacity: 0.45;
  }
`;

export default Grip;
