import styled from "styled-components";

const AppHolder = styled.div`
  .ant-full-layout {
    min-height: 100vh;
    box-sizing: border-box;

    .ant-full-content {
      position: relative;
      margin-top: 0px;
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
