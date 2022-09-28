import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
  }
  div.genome-plot canvas {
    margin: ${(props) => props.margins.gapY}px
      ${(props) => props.margins.gapX}px !important;
    padding: 0px !important;
    pointer-events: auto;
  }
  svg.plot-container {
    position: absolute;
    top: 0px;
    pointer-events: auto;
    g.labels-container {
      text {
        user-select: none;
        cursor: pointer;
      }
      text:hover {
        font-weight: bold;
      }
    }
    .weighted {
      fill: #cf2908;
    }
  }
`;

export default Wrapper;
