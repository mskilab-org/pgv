import styled from "styled-components";

const Wrapper = styled.div`
  .ant-wrapper {
    background: white;
    padding: 0px;
  }
  .phylogeny-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
  .phylogeny-control-groups { display: flex; flex-wrap: wrap; gap: 12px; }
  .phylogeny-control-group { min-width: 0; padding: 8px 12px 10px; border: 1px solid #e8e8e8; border-radius: 3px; background: #fafafa; }
  .phylogeny-display-group { flex: 1.6 1 560px; }
  .phylogeny-selection-group { flex: 1 1 320px; }
  .phylogeny-group-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; margin-bottom: 8px; }
  .phylogeny-group-title { color: #666; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
  .phylogeny-group-counts { color: #666; font-size: 11px; }
  .phylogeny-display-rows { display: flex; flex-direction: column; gap: 8px; }
  .phylogeny-display-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 4px 12px; align-items: start; }
  .phylogeny-row-label { padding-top: 2px; color: #666; font-size: 12px; line-height: 20px; }
  .phylogeny-row-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
  .phylogeny-row-controls > * { max-width: 100%; min-width: 0; }
  .phylogeny-tree-select { width: 260px; max-width: 100%; min-width: 0; }
  .phylogeny-selection-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
  .phylogeny-control { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; max-width: 100%; font-size: 12px; }
  .phylogeny-control .ant-select { max-width: 100%; min-width: 0; }
  .phylogeny-control-group .ant-space, .phylogeny-control-group .ant-space-item { min-width: 0; max-width: 100%; }
  .phylogeny-control-group .ant-btn { max-width: 100%; height: auto; min-height: 24px; white-space: normal; }
  .phylogeny-control-group .ant-checkbox-wrapper { font-size: 12px; }
  @media (max-width: 575px) {
    .phylogeny-display-row { grid-template-columns: minmax(0, 1fr); }
  }
  .phylogeny-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .phylogeny-gesture-help { font-size: 11px; line-height: 1.6; }
  .phylogeny-load-status { padding: 4px 0; font-size: 12px; }
  .phylogeny-load-status button { margin-left: 12px; }
  .phylogeny-warnings { font-size: 12px; padding: 4px; margin-bottom: 8px; background: #fffbe6; }
  .phylogeny-warnings ul { max-height: 120px; overflow: auto; }
  &.phylogeny-linked-panel .ant-card-head-title { min-width: 0; white-space: normal; }
  .tooltip-box {
    .header {
      font-size: 16px;
      font-weight: 600;
      text-align: left;
    }
    table.content {
      td {
        text-align: left;
        padding: 3px;
        padding-top: 2px;
        padding-bottom: 2px;
        min-width: 120px;
      }
    }
  }
`;

export default Wrapper;
