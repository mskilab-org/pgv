import styled from "styled-components";

const AppHolder = styled.div`
  .ant-full-layout {
    height: 100vh;
    box-sizing: border-box;

    .ant-full-content {
      position: relative;
      margin: 24px;
      flex: auto;
      min-height: 0;
    }

    .ant-full-footer {
      padding: 4px;
      text-align: center;
      border-top: 1px solid #ededed;
    }
  }
`;

export default AppHolder;
