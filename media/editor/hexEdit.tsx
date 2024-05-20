import React, { Suspense, useLayoutEffect, useMemo, useState } from "react";
import { render } from "react-dom";
import { RecoilRoot, useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { InspectorLocation } from "../../shared/protocol";
import { DataHeader } from "./dataDisplay";
import { DataDisplayContext, DisplayContext } from "./dataDisplayContext";
import { DataInspectorHover } from "./dataInspector";
import { FindWidget } from "./findWidget";
import _style from "./hexEdit.css";
import { useTheme } from "./hooks";
import { ReadonlyWarning } from "./readonlyWarning";
import { ScrollContainer } from "./scrollContainer";
import { Segment, SegmentMenu } from "./segmentMenu";
import { SettingsGear } from "./settings";
import * as select from "./state";
import { strings } from "./strings";
import { ContextMenu, ContextMenuProps, MenuItem, ToolTip, TooltipProps } from "./toolTip"; // 导入 Tooltip 组件
import { throwOnUndefinedAccessInDev } from "./util";
import { VsProgressIndicator } from "./vscodeUi";

const style = throwOnUndefinedAccessInDev(_style);

const Root: React.FC = () => {
  // 获取和设置窗口尺寸信息的状态钩子
  const setDimensions = useSetRecoilState(select.dimensions);
  // 获取主题样式的自定义钩子
  const theme = useTheme();

  // 当组件挂载或窗口尺寸改变时更新尺寸信息
  useLayoutEffect(() => {
    const applyDimensions = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        rowPxHeight: parseInt(theme["font-size"]) + 8,
      });

    window.addEventListener("resize", applyDimensions);
    applyDimensions();
    return () => window.removeEventListener("resize", applyDimensions);
  }, [theme]);

  return (
    <Suspense fallback={<VsProgressIndicator />}>
      {/* 主页面布局 */}
      <h1 style={{ textAlign: "center" }}>HEX-Format-Editor</h1>
      <div style={{ display: "flex", height: "100%" }}>
        {/* 右侧编辑器 */}
        <Editor />
      </div>
    </Suspense>
  );
};

const Editor: React.FC = () => {
  // 获取窗口尺寸信息的状态值
  const dimensions = useRecoilValue(select.dimensions);
  // 设置编辑状态的状态钩子
  const setEdit = useSetRecoilState(select.edits);
  // 获取只读状态的状态值
  const isReadonly = useRecoilValue(select.isReadonly);
  // 获取数据检查器位置的状态值
  const inspectorLocation = useRecoilValue(select.dataInspectorLocation);
  // 使用 useMemo 创建 DisplayContext 实例
  const ctx = useMemo(() => new DisplayContext(setEdit, isReadonly), []);

  // 获取是否是大文件的状态值
  const isLargeFile = useRecoilValue(select.isLargeFile);
  // 获取是否绕过大文件提示的状态值和设置该状态的状态钩子
  const [bypassLargeFilePrompt, setBypassLargeFile] = useRecoilState(select.bypassLargeFilePrompt);
  // const [segmentMenu, setSegmentMenu] = useState<Segment[]>(); // 第一个分段为全文
  const fileSize = useRecoilValue(select.fileSize) ?? 0; // 如果为undefined，则默认为0
  const [segmentMenu, setSegmentMenu] = useState([new Segment("全文", 0, fileSize - 1)]); // 第一个分段为全文
  // const [editSegment, setEditSegment] = useState<Segment | null>(null); // 控制是否显示编辑组件
  const [tooltipProps, setTooltipProps] = useState<TooltipProps>({
    isVisible: false,
    text: "",
    position: { left: 0, top: 0 },
  });

  const [contextMenuProps, setContextMenuProps] = useState<ContextMenuProps>({
    isVisible: false,
    items: [],
    onClose: () => {},
    position: { left: 0, top: 0 },
  });

  const showToolTip = (showText: string, mouseX: number, mouseY: number) => {
    const mousePosition = { left: mouseX, top: mouseY };
    setTooltipProps({ isVisible: true, text: showText, position: mousePosition });
  };

  const hideToolTip = () => {
    setTooltipProps({ isVisible: false, text: "", position: { left: 0, top: 0 } });
  };

  const openContextMenu = (myitems: MenuItem[], mouseX: number, mouseY: number) => {
    const mousePosition = { left: mouseX, top: mouseY };
    setContextMenuProps({
      isVisible: true,
      items: myitems,
      onClose: closeContextMenu,
      position: mousePosition,
    });
  };

  const closeContextMenu = () => {
    setContextMenuProps({
      isVisible: false,
      items: [],
      onClose: () => {},
      position: { left: 0, top: 0 },
    });
  };
  // 如果是大文件且未绕过大文件提示，则渲染提示信息
  if (isLargeFile && !bypassLargeFilePrompt) {
    return (
      <div>
        <p>
          {strings.openLargeFileWarning}{" "}
          <a id="open-anyway" role="button" onClick={() => setBypassLargeFile(true)}>
            {strings.openAnyways}
          </a>
        </p>
      </div>
    );
  }

  return (
    // 提供数据显示上下文的 Provider
    <DataDisplayContext.Provider value={ctx}>
      <ToolTip
        isVisible={tooltipProps.isVisible}
        text={tooltipProps.text}
        position={tooltipProps.position}
      />
      <ContextMenu
        isVisible={contextMenuProps.isVisible}
        items={contextMenuProps.items}
        onClose={contextMenuProps.onClose}
        position={contextMenuProps.position}
      />
      {/* 左侧菜单栏 */}
      {/* <SegmentMenu setEditSegment={setEditSegment} /> */}
      <SegmentMenu
        menuItems={segmentMenu}
        setMenuItems={setSegmentMenu}
        showToolTip={showToolTip}
        hideToolTip={hideToolTip}
        openContextMenu={openContextMenu}
      />
      <div
        className={style.container}
        style={{ "--cell-size": `${dimensions.rowPxHeight}px` } as React.CSSProperties}
      >
        {/* 数据查找组件 */}
        <FindWidget />
        {/* 设置按钮 */}
        <SettingsGear />
        {/* 数据头部信息 */}
        <DataHeader />
        {/* 数据滚动容器 */}
        <ScrollContainer segmentMenu={segmentMenu} />
        {/* {editSegment ? null : (
          <>

            <DataHeader />

            <ScrollContainer />
          </>
        )} */}
        {/* 如果 editSegment 存在，则渲染 SegmentEdit 组件 */}
        {/* {editSegment && <SegmentEdit segment={editSegment} onClose={() => setEditSegment(null)} />}
        {editSegment && <DataInspectorHover />} */}
        {/* 只读警告 */}
        <ReadonlyWarning />
        {/* 数据检查器悬停信息 */}
        {inspectorLocation === InspectorLocation.Hover && <DataInspectorHover />}
      </div>
    </DataDisplayContext.Provider>
  );
};

// 渲染根组件，并放入 RecoilRoot 提供状态管理功能
render(
  <RecoilRoot>
    <Root />
  </RecoilRoot>,
  document.body,
);
