import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    min-height: 400px;
  }
  .annotated {
    fill-opacity: 0.33;
    stroke: #A020F0 !important;
    stroke-width: 2 !important;
    opacity: 1 !important;
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
