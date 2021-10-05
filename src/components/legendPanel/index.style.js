import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    .brush-container .selection {
      stroke: #FF7F0E;
      stroke-width: 1.3;
      fill-opacity: .125;
      shape-rendering: crispEdges;
    }
    text {
      user-select: none;
    }
    .brush .selection {
      stroke: steelblue;
      fill-opacity: .125;
      shape-rendering: crispEdges;
    }
    .highlighted .selection {
      stroke: orange;
      stroke-width: 2;
    }
  }
  .ant-card-extra {
    font-size: 14px !important;
  }
  .ant-card-body {
    padding-top: 4px !important;
    padding-bottom: 2px !important;
  }
`;

export default Wrapper;
