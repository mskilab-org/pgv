import styled from "styled-components";

// Every selector is scoped to this child, never the legacy plot/card styles.
const Wrapper = styled.div`
  position: relative;
  width: 100%;
  background: white;
  .heatmap-axis-row { display: flex; align-items: stretch; gap: 12px; }
  .heatmap-axis { display: block; flex: 0 0 auto; }
  .mutation-axis-label { display: flex; align-items: center; justify-content: center; min-height: 36px; overflow: hidden; border-left: 1px solid #bbb; color: #555; font-size: 11px; white-space: nowrap; }
  .heatmap-scroll { position: relative; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
  .heatmap-scroll-content { position: relative; }
  .heatmap-columns { display: flex; align-items: flex-start; gap: 12px; position: sticky; top: 0; }
  .heatmap-canvas, .mutation-canvas { display: block; flex: 0 0 auto; touch-action: pan-y; outline-offset: -2px; }
  .mutation-canvas { position: sticky; left: 0; }
  .mutation-scroll-x { flex: 0 0 auto; overflow-x: auto; overflow-y: hidden; background: #fff; box-shadow: -1px 0 #bbb; }
  .heatmap-gutter-resize { position: absolute; top: 36px; width: 8px; margin-left: -4px; cursor: col-resize; z-index: 2; touch-action: none; border-left: 1px solid #bbb; }
  .heatmap-gutter-resize:focus { outline: 2px solid #1677ff; }
  .heatmap-tooltip { position: absolute; z-index: 4; pointer-events: none; padding: 8px; max-width: 300px; font-size: 12px; line-height: 1.5; color: #222; background: #fff; border: 1px solid #999; border-radius: 3px; box-shadow: 0 2px 8px #0002; overflow-wrap: anywhere; }
  .heatmap-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; min-height: 36px; padding: 3px 8px; font-size: 11px; line-height: 1.4; }
  .heatmap-legend-group { display: inline-flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .heatmap-swatch { width: 10px; height: 10px; display: inline-block; border: 1px solid #777; vertical-align: middle; }
  .heatmap-fit { border: 1px solid #aaa; border-radius: 2px; background: white; color: #333; cursor: pointer; }
  .heatmap-empty { position: absolute; top: 55px; left: 24px; padding: 8px; background: #fffffff2; pointer-events: none; }
  .heatmap-swatch-dot { border-radius: 50%; border-color: #555; }
  .heatmap-vaf-scale { display: inline-flex; flex-direction: column; width: 150px; gap: 1px; }
  .heatmap-vaf-gradient { height: 8px; border: 1px solid #777; background: linear-gradient(to right, #fff, #000); }
  .heatmap-vaf-ticks { display: flex; justify-content: space-between; font-size: 10px; line-height: 1.1; }
  .heatmap-count-scale { display: inline-flex; flex-direction: column; width: 150px; gap: 1px; }
  .heatmap-count-gradient { height: 8px; border: 1px solid #777; background: linear-gradient(to right, #0080ff, #ff8000); }
  .heatmap-count-ticks { position: relative; height: 12px; font-size: 10px; line-height: 1.1; }
  .heatmap-count-ticks > span { position: absolute; top: 0; }
  .heatmap-overlap-symbol { display: inline-flex; justify-content: center; align-items: center; width: 11px; height: 11px; border: 1px solid #555; border-radius: 50%; color: #555; background: white; font-style: normal; font-size: 10px; line-height: 1; vertical-align: middle; }
  .heatmap-accessible { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .heatmap-accessible:focus-within { clip: auto; width: min(320px, 95%); height: auto; max-height: 180px; overflow: auto; white-space: normal; margin: 0; top: 36px; left: 8px; z-index: 5; background: white; border: 1px solid #aaa; }
  .heatmap-accessible:focus-within button { display: block; width: 100%; text-align: left; }
`;

export default Wrapper;
