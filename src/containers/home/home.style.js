import styled from "styled-components";

const HomeWrapper = styled.div`
  .ant-home-header-container {
    margin: 0px;
    background: white;
    border: 1px solid rgb(235, 237, 240);
  }
  .ant-home-content-container {
    margin: 24px;
  }
  .phylogeny-aligned-panel .ant-card-body {
    padding-left: calc(12px + var(--phylogeny-gutter, 0px));
  }
  .phylogeny-track-label {
    position: absolute; left: 16px; top: 64px;
    width: max(0px, calc(var(--phylogeny-gutter, 0px) - 32px));
    overflow-wrap: anywhere; font-size: 12px; color: #555; z-index: 1;
  }
  .phylogeny-track-label small { display: block; margin-top: 4px; color: #888; }
  .ant-panel-container {
    margin-top: 24px;
    margin-bottom: 24px;
  }
`;

export default HomeWrapper;
