import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    min-height: 400px;
  }
  .shape.highlighted {
    fill: white !important;
  }
  path.connection.highlighted {
    stroke-width: 3 !important;
    opacity: 1;
  }
  .phylogeny-annotated {
    fill-opacity: 0.33;
    stroke: #79b321 !important;
    stroke-width: 2 !important;
    opacity: 1 !important;
  }
  .annotated {
    fill-opacity: 0.33;
    stroke: #A020F0 !important;
    stroke-width: 2 !important;
    opacity: 1 !important;
  }
  .cross-annotated {
    stroke: url(#crossgrad) !important;
    stroke-width: 4 !important;
  }
`;

export default Wrapper;
