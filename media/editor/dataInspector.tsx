import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { Endianness } from "../../shared/protocol";
import { Range } from "../../shared/util/range";
import { FocusedElement, getDataCellElement, useDisplayContext } from "./dataDisplayContext";
import _style from "./dataInspector.css";
import { inspectableTypes } from "./dataInspectorProperties";
import { useFileBytes, usePersistedState } from "./hooks";
import * as select from "./state";
import { strings } from "./strings";
import { throwOnUndefinedAccessInDev } from "./util";
import { VsTooltipPopover } from "./vscodeUi";

const style = throwOnUndefinedAccessInDev(_style);

/** 当悬停在字节上时显示数据检查器的组件 */
export const DataInspectorHover: React.FC = () => {
  const ctx = useDisplayContext(); // 使用数据管理上下文
  const [inspected, setInspected] = useState<FocusedElement>(); // 当前被检查的字节
  const anchor = useMemo(() => inspected && getDataCellElement(inspected), [inspected]); // 锚点元素，用于定位数据检查器的位置
  const [lookahead, setLookahead] = useState<number>(0); // 选中内容的 lookahead
  const [started, setStarted] = useState<number | undefined>(); // 当前被检查的字节

  useEffect(() => {
    let hoverTimeout: NodeJS.Timeout | undefined;

    // 注册悬停事件的处理函数
    const disposable = ctx.onDidHover(target => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = undefined;
      }
      if (target && ctx.isSelecting === undefined) {
        setInspected(undefined);
        // 在一定时间后设置被检查的字节
        hoverTimeout = setTimeout(() => setInspected(target), 500);
      }
    });

    return () => disposable.dispose(); // 取消注册事件处理函数
  }, []);

  useEffect(() => {
    const updateLookahead = () => {
      const selectionRanges: Range[] = ctx.getSelectionRanges();
      if (selectionRanges.length > 0) {
        const originalRange: Range = selectionRanges[0];
        const length = originalRange.end - originalRange.start;
        setLookahead(length);
        setStarted(originalRange.start); // 将 first 设置为第一个 Range 的 start 属性
      } else {
        setLookahead(0); // 如果没有选择范围，将 lookahead 设置为 0
        setStarted(undefined); // 如果没有选择范围，将 first 设置为 undefined
      }
    };

    updateLookahead(); // 初始化

    const disposable = ctx.onDidSelection(() => {
      updateLookahead(); // 选择发生变化时更新 lookahead 和 started
    });

    return () => disposable.dispose();
  }, []);

  if (!anchor || started === undefined) {
    return null;
  }

  return (
    <VsTooltipPopover anchor={anchor} hide={() => setInspected(undefined)} visible={true}>
      {/* <h2>常规数据结构解析</h2> */}
      <Suspense fallback={null}>
        {/* 渲染数据检查器 */}
        <InspectorContents columns={2} offset={started} lookahead={lookahead} />
      </Suspense>
    </VsTooltipPopover>
  );
};

/** 数据检查器显示在编辑器右侧的组件 */
export const DataInspectorAside: React.FC<{ onInspecting?(isInspecting: boolean): void }> = ({
  onInspecting,
}) => {
  const ctx = useDisplayContext(); // 使用数据管理上下文
  const [inspected, setInspected] = useState<FocusedElement | undefined>(ctx.focusedElement); // 当前被检查的字节
  const [lookahead, setLookahead] = useState<number>(0); // 选中内容的 lookahead
  const [started, setStarted] = useState<number | undefined>(); // 当前被检查的字节

  useEffect(() => {
    // 注册焦点事件的处理函数
    const disposable = ctx.onDidFocus(focused => {
      if (!inspected) {
        onInspecting?.(true);
      }
      if (focused) {
        setInspected(focused);
      }
    });
    return () => disposable.dispose(); // 取消注册事件处理函数
  }, []);

  useEffect(() => {
    const updateLookahead = () => {
      const selectionRanges: Range[] = ctx.getSelectionRanges();
      if (selectionRanges.length > 0) {
        const originalRange: Range = selectionRanges[0];
        const length = originalRange.end - originalRange.start;
        setLookahead(length);
        setStarted(originalRange.start); // 将 inspected 设置为第一个 Range 的 start 属性
      } else {
        setLookahead(0); // 如果没有选择范围，将 lookahead 设置为 0
        setStarted(undefined); // 如果没有选择范围，将 inspected 设置为 undefined
      }
    };

    updateLookahead(); // 初始化

    const disposable = ctx.onDidSelection(() => {
      updateLookahead(); // 选择发生变化时更新 lookahead 和 inspected
    });

    return () => disposable.dispose();
  }, []);

  // 如果没有被检查的字节，则返回空
  if (!inspected || started === undefined) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {/* 渲染数据检查器 */}
      <InspectorContents columns={2} offset={started} lookahead={lookahead} />
    </Suspense>
  );
};

// 向前查看的字节数
// const lookahead = 8;

/** 数据检查器的内部内容，被悬停和右侧检查器共用 */
const InspectorContents: React.FC<{
  offset: number; // 字节的偏移量
  columns: number; // 列数
  lookahead: number;
}> = ({ offset, columns, lookahead }) => {
  // 获取默认字节序的状态值
  const defaultEndianness = useRecoilValue(select.editorSettings).defaultEndianness;
  // 获取和设置字节序的状态钩子
  const [endianness, setEndianness] = usePersistedState("endianness", defaultEndianness);
  // 获取待查看的文件字节信息
  const target = useFileBytes(offset, lookahead);
  // 创建 DataView 实例来处理字节数据
  const dv = new DataView(target.buffer);
  // 判断字节序是否为小端序
  const le = endianness === Endianness.Little;

  return (
    <>
      {/* 渲染数据检查器的类型和对应的值 */}
      <dl className={style.types} style={{ gridTemplateColumns: "max-content ".repeat(columns) }}>
        {inspectableTypes.map(({ label, convert, minBytes }) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>
              {target.length < minBytes ? (
                <span style={{ opacity: 0.8 }}>End of File</span>
              ) : (
                convert(dv, le)
              )}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      {/* 控制字节序的切换开关 */}
      <EndiannessToggle endianness={endianness} setEndianness={setEndianness} />
    </>
  );
};

/** 控制字节序的切换开关 */
const EndiannessToggle: React.FC<{
  endianness: Endianness; // 当前字节序
  setEndianness: (e: Endianness) => void; // 设置字节序的函数
}> = ({ endianness, setEndianness }) => (
  <div className={style.endiannessToggleContainer}>
    <input
      type="checkbox"
      id="endian-checkbox"
      checked={endianness === Endianness.Little}
      onChange={evt => setEndianness(evt.target.checked ? Endianness.Little : Endianness.Big)}
    />
    <label htmlFor="endian-checkbox">{strings.littleEndian}</label>
  </div>
);
