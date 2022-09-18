import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    min-height: 400px;
  }
  div.scatterplot canvas {
    margin: ${(props) => props.margins.gapY}px
      ${(props) => props.margins.gapX}px !important;
    padding: 0px !important;
  }
  svg.plot-container {
    position: absolute;
    top: 0px;
    user-select: none;
    /*pointer-events: none;*/
  }
`;

export default Wrapper;
