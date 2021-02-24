import styled from "styled-components";

const Wrapper = styled.div`
  .ant-pro-setting-drawer-title {
    font-size: 14px;
    line-height: 22px;
    font-weight: 600;
  }
  .ant-list{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    color: rgba(0,0,0,.85);
    font-size: 14px;
    font-variant: tabular-nums;
    line-height: 1.5715;
    list-style: none;
    font-feature-settings: "tnum","tnum";
    position: relative ;
  }
  .ant-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    color: rgba(0,0,0,.85);
    border: none;
}
`;

export default Wrapper;
