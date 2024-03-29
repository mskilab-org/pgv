import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    ${props => !props.empty && `height: ${props.minHeight}px`};
    .location-highlight {
      pointer-events: none;
    }
  }
`;

export default Wrapper;
