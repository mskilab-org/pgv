import styled from "styled-components";

const Wrapper = styled.g`
  .ant-wrapper {
    background: white;
  }
  .axis text, .y-axis-title {
    font: 12px sans-serif;
    fill: steelblue;
    pointer-events: none;
    user-select: none;
  }
    
  .axis--y g.tick line {
    stroke: #777;
    stroke-dasharray: 2,2;
    opacity: 0.33;
  }
  
  .axis--y .domain {
    stroke: transparent;
  }

  .chromo-separator line {
    stroke-width: 1.5;
    stroke-dasharray: 2,2;
  }
  .label-chromosome {
    font-size: 10px;
    font-weight: normal;
    pointer-events: none;
    user-select: none;
    text-anchor: middle;
  }
  .label-magnitude {
    font-size: 10px;
    fill: #333;
  }
  .line-magnitude {
    fill: transparent;
    stroke: #333;
    stroke-width: 1px;
  }
`;

export default Wrapper;
