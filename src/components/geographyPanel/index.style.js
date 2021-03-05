import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
    width: 100%;
    height: 400px;
    .mapboxgl-popup-content {
      padding: inherit;
      .marker-popup {
        background: white;
        color: #3f618c;
        font-weight: 400;
        padding: 0px;
        border-radius: 2px;
        .ant-popover-title {
          min-width: 177px;
          min-height: 32px;
          margin: 0;
          padding: 5px 16px 4px;
          color: rgba(0,0,0,.85);
          font-weight: 600;
          border-bottom: 1px solid #f0f0f0;
        }
        .ant-popover-inner-content {
          padding: 12px 16px;
          color: rgba(0,0,0,.85);
        }
      }
    }
  }
`;

export default Wrapper;
