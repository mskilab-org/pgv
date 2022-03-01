import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    height: 400px;
  }
  .ant-card-body {
    display: ${(props) => (props.visible ? "block" : "none")};
  }
`;

export default Wrapper;
