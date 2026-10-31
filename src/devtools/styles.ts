export const devtoolsStyles = `
:host { all: initial; }
.pps { position: fixed; top: 0; bottom: 0; z-index: 2147483000; display: flex; flex-direction: column;
  background: #1b1d23; color: #e6e8ee; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  box-shadow: 0 0 24px rgba(0,0,0,.45); }
.pps.right { right: 0; border-left: 1px solid #343846; }
.pps.left { left: 0; border-right: 1px solid #343846; }
.pps * { box-sizing: border-box; }
.pps-fab { position: fixed; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 999px; padding: 8px 12px;
  background: #1b1d23; color: #42d392; font: 600 12px ui-monospace, monospace; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.pps-fab.right { right: 16px; } .pps-fab.left { left: 16px; }
.pps-fab.has-errors { color: #ff6b6b; }
.pps-header { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #343846; }
.pps-title { font-weight: 700; color: #42d392; flex: 1; }
.pps-bar { display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #343846; flex-wrap: wrap; }
.pps select, .pps input, .pps button { background: #272a33; color: inherit; border: 1px solid #3d4252; border-radius: 4px;
  padding: 3px 6px; font: inherit; }
.pps button { cursor: pointer; } .pps button:hover { background: #313644; }
.pps button.active { background: #42d392; color: #10131a; border-color: #42d392; }
.pps input { flex: 1; min-width: 90px; }
.pps-body { flex: 1; overflow: auto; padding: 6px 10px 16px; }
.pps-entry { border-bottom: 1px solid #2b2f3b; padding: 3px 0; }
.pps button.pps-row { display: flex; gap: 6px; align-items: baseline; width: 100%; text-align: left; border: 0; background: none; padding: 2px 0; }
.pps button.pps-row:hover { background: #272a33; }
.pps-seq { color: #7c8294; min-width: 34px; }
.pps-badge { border-radius: 3px; padding: 0 4px; font-size: 10px; background: #3d4252; }
.pps-badge.server { background: #8e6bff; color: #fff; } .pps-badge.client { background: #2f7de1; color: #fff; }
.pps-error { color: #ff6b6b; }
.pps-children { margin-left: 14px; border-left: 1px solid #343846; padding-left: 8px; }
.pps-muted { color: #7c8294; }
.pps-tree { margin-left: 12px; } .pps-tree > summary { cursor: pointer; }
.pps-key { color: #9ecbff; } .pps-str { color: #a5d6a7; } .pps-num { color: #ffcc80; }
.pps-notice { color: #ffcc80; padding: 4px 0; }
`
