import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    min-height: ${(props) => props.minHeight}px;
  }
  .ant-card-body {
    display: ${(props) => (props.visible ? "block" : "none")};
  }
`;

export default Wrapper;
