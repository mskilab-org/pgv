import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    min-height: 400px;
  }
  .konvajs-content canvas {
    padding: 0px !important;
  }
  .shape.highlighted {
    fill: white !important;
  }
  path.connection.highlighted {
    stroke-width: 3 !important;
    opacity: 1;
  }
`;

export default Wrapper;
