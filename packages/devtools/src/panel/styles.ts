export const devtoolsStyles = `
:host { all: initial; }
.pps { position: fixed; top: 0; bottom: 0; z-index: 2147483000; display: flex; flex-direction: column;
  background: #1b1d23; color: #e6e8ee; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  box-shadow: 0 0 24px rgba(0,0,0,.45); max-height: 100vh; max-height: 100dvh; overflow: hidden; }
.pps.right { right: var(--pps-gutter, 0px); border-left: 1px solid #343846; }
.pps.left { left: 0; border-right: 1px solid #343846; }
.pps * { box-sizing: border-box; }
.pps-fab { position: fixed; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 999px; padding: 8px 14px; display: flex; align-items: center; gap: 6px;
  background: #1b1d23; color: #42d392; font: 600 12px ui-monospace, monospace; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.pps-icon { width: 16px; height: 16px; fill: currentColor; }
.pps-fab.right { right: calc(16px + var(--pps-gutter, 0px)); } .pps-fab.left { left: 16px; }
.pps-fab.right:hover { filter: drop-shadow(1px 1px 29px #90ee90d4); }
.pps-fab.has-errors { color: #ff6b6b; }
.pps-header { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #343846; }
.pps-title { font-weight: 700; color: #42d392; flex: 1; }
.pps-bar { display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #343846; flex-wrap: wrap; }
.pps select, .pps input, .pps button { min-width: 0; max-width: 100%; background: #272a33; color: inherit; border: 1px solid #3d4252; border-radius: 4px;
  padding: 3px 6px; font: inherit; }
.pps button { cursor: pointer; } .pps button:hover { background: #313644; }
.pps button.active { background: #42d392; color: #10131a; border-color: #42d392; }
.pps input { flex: 1; min-width: 90px; }
.pps-body { flex: 1 1 0; min-height: 0; overflow-x: hidden; overflow-y: scroll; overscroll-behavior: contain; padding: 6px 10px 16px;
  scrollbar-width: auto; scrollbar-color: #5a6075 #272a33; }
.pps-body::-webkit-scrollbar { width: 12px; }
.pps-body::-webkit-scrollbar-track { background: #272a33; }
.pps-body::-webkit-scrollbar-thumb { background: #5a6075; border-radius: 6px; border: 2px solid #272a33; }
.pps-entry { border-bottom: 1px solid #2b2f3b; padding: 3px 0; }
.pps button.pps-row { display: flex; gap: 6px; align-items: baseline; width: 100%; text-align: left; border: 0; background: none; padding: 2px 0; }
.pps button.pps-row:hover { background: #272a33; }
.pps button.pps-static { cursor: default; }
.pps button.pps-event { flex-direction: column; gap: 2px; align-items: stretch; }
.pps-meta { display: flex; gap: 6px; align-items: center; }
.pps-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.pps-caret { color: #7c8294; width: 10px; }
.pps-chip { border-radius: 3px; padding: 0 5px; font-size: 10px; font-weight: 700; color: #10131a; cursor: help; }
.pps-chip.p { background: #42d392; } .pps-chip.e { background: #ff6b6b; }
.pps-badge { border-radius: 3px; padding: 0 4px; font-size: 10px; background: #3d4252; }
.pps-badge.server { background: #8e6bff; color: #fff; } .pps-badge.client { background: #2f7de1; color: #fff; }
.pps-error { color: #ff6b6b; }
.pps-children { margin-left: 14px; border-left: 1px solid #343846; padding-left: 8px; }
.pps-muted { color: #7c8294; }
.pps-tree { margin-left: 12px; } .pps-tree > summary { cursor: pointer; }
.pps-key { color: #9ecbff; } .pps-str { color: #a5d6a7; } .pps-num { color: #ffcc80; }
.pps-notice { color: #ffcc80; padding: 4px 0; }
`
