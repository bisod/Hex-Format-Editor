import React, { useState } from "react";
import { useRecoilValue } from "recoil";
import { Range } from "../../shared/util/range";
import { useDisplayContext } from "./dataDisplayContext";
import _style from "./segmentMenu.css";
import * as select from "./state"; // 导入状态管理相关的模块
import { throwOnUndefinedAccessInDev } from "./util";

const style = throwOnUndefinedAccessInDev(_style);

class Segment {
  name: string;
  start: number;
  end: number;
  length: number;

  constructor(name: string, start: number, end: number) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.length = this.end - this.start + 1;
  }

  get startHex(): string {
    return this.toHex(this.start);
  }

  get endHex(): string {
    return this.toHex(this.end);
  }

  private toHex(position: number): string {
    return position.toString(16).padStart(10, "0");
  }
}

const SegmentItem: React.FC<{ segment: Segment; selected: boolean; onClick: () => void }> = ({
  segment,
  selected,
  onClick,
}) => {
  const [mergeDropdownVisible, setMergeDropdownVisible] = useState(false);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`编辑分段: ${segment.name}`);
  };

  const handleMergeClick = () => {
    setMergeDropdownVisible(!mergeDropdownVisible);
  };

  const handleMerge = (direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`向${direction === "up" ? "上" : "下"}合并分段: ${segment.name}`);
    setMergeDropdownVisible(false);
  };

  return (
    <div
      className={`${style.segment} ${selected ? style.selected : ""}`}
      onClick={() => {
        onClick();
      }}
    >
      <div className={style.segmentName}>{segment.name}</div>
      <div>
        <p>{`${segment.startHex}-${segment.endHex}`}</p>
        <p>{`长度: ${segment.length}`}</p>
      </div>
      <div className={style.buttons}>
        <button onClick={handleEdit}>编辑</button>
        <div className={style.dropdown}>
          <button onClick={handleMergeClick}>合并</button>
          {mergeDropdownVisible && (
            <div className={style.dropdownContent}>
              <button onClick={e => handleMerge("up", e)}>向上合并</button>
              <button onClick={e => handleMerge("down", e)}>向下合并</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SegmentMenu: React.FC = () => {
  const ctx = useDisplayContext();
  const fileSize = useRecoilValue(select.fileSize) ?? 0; // 如果为undefined，则默认为0
  const [menuItems, setMenuItems] = useState([new Segment("全文", 0, fileSize - 1)]); // 第一个分段为全文
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [nameIndex, setNameIndex] = useState(1);

  const handleMenuItemClick = (segment: Segment, index: number) => {
    setSelectedSegmentIndex(index);
    console.log(segment);
  };

  const closeSelectedSegmentWindow = () => {
    setSelectedSegmentIndex(null);
  };

  // 分割选中的内容
  const separateSelectedContent = () => {
    // 获取第一个选中范围
    const originalRange = ctx.getSelectionRanges()[0];
    const selectedRange: Range = new Range(originalRange.start, originalRange.end - 1);
    console.log(selectedRange ? [selectedRange.start, selectedRange.end] : [null, null]);

    // 如果存在选中范围
    if (selectedRange) {
      // 查找当前选中内容在哪个现有分段中
      const segmentIndices = findSegmentIndices(selectedRange.start, selectedRange.end, menuItems);

      // 如果选中内容在一个现有分段中
      if (segmentIndices.length === 1) {
        // 处理选中内容在单个分段中的情况
        handleSingleSegment(selectedRange, segmentIndices[0]);
      }
      // 如果选中内容不在任何现有分段中
      else {
        // 处理选中内容跨越多个分段的情况
        handleMultipleSegments();
      }
    }
  };

  // 查找当前选中内容在哪个现有分段中的索引
  const findSegmentIndices = (start: number, end: number, menuItems: Segment[]): number[] => {
    return menuItems.reduce((acc: number[], segment, index) => {
      if (start >= segment.start && end <= segment.end) {
        acc.push(index);
      }
      return acc;
    }, []);
  };

  // 处理选中内容在单个分段中的情况
  const handleSingleSegment = (selectedRange: Range, segmentIndex: number) => {
    // 获取对应的分段
    const segment = menuItems[segmentIndex];

    // 如果选中内容与分段完全重合，无需拆分
    if (selectedRange.start === segment.start && selectedRange.end === segment.end) {
      console.error("选中内容与分段完全重合，无需拆分");
    }
    // 如果选中内容的开始与分段的开始相同
    else if (selectedRange.start === segment.start) {
      // 在选中内容的开始处拆分分段
      splitSegmentAtStart(selectedRange, segmentIndex);
    }
    // 如果选中内容的结束与分段的结束相同
    else if (selectedRange.end === segment.end) {
      // 在选中内容的结束处拆分分段
      splitSegmentAtEnd(selectedRange, segmentIndex);
    }
    // 其他情况，在选中内容中间位置拆分分段
    else {
      splitSegmentInMiddle(selectedRange, segmentIndex);
    }
  };

  // 处理选中内容跨越多个分段的情况
  const handleMultipleSegments = () => {
    console.error("选中内容跨越多个分段，无法处理");
  };

  // 在选中内容的开始处拆分分段
  const splitSegmentAtStart = (selectedRange: Range, segmentIndex: number) => {
    // 获取对应的分段
    const segment = menuItems[segmentIndex];
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, selectedRange.start, selectedRange.end);
    setNameIndex(prevIndex => prevIndex + 1);
    // 更新菜单项
    updateMenuItems([
      ...menuItems.slice(0, segmentIndex),
      newItem1,
      new Segment(segment.name, selectedRange.end + 1, segment.end),
      ...menuItems.slice(segmentIndex + 1),
    ]);
  };

  // 在选中内容的结束处拆分分段
  const splitSegmentAtEnd = (selectedRange: Range, segmentIndex: number) => {
    // 获取对应的分段
    const segment = menuItems[segmentIndex];
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, selectedRange.start, selectedRange.end);
    setNameIndex(prevIndex => prevIndex + 1);
    // 更新菜单项
    updateMenuItems([
      ...menuItems.slice(0, segmentIndex),
      new Segment(segment.name, segment.start, selectedRange.start - 1),
      newItem1,
      ...menuItems.slice(segmentIndex + 1),
    ]);
  };

  // 在选中内容的中间位置拆分分段
  const splitSegmentInMiddle = (selectedRange: Range, segmentIndex: number) => {
    // 获取对应的分段
    const segment = menuItems[segmentIndex];
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, segment.start, selectedRange.start - 1);
    const newItem2 = new Segment(segment.name, selectedRange.start, selectedRange.end);
    const newItem3 = new Segment(`分段${nameIndex + 1}`, selectedRange.end + 1, segment.end);
    setNameIndex(prevIndex => prevIndex + 2);
    // 更新菜单项
    updateMenuItems([
      ...menuItems.slice(0, segmentIndex),
      newItem1,
      newItem2,
      newItem3,
      ...menuItems.slice(segmentIndex + 1),
    ]);
  };

  // 更新菜单项
  const updateMenuItems = (newItems: Segment[]) => {
    setMenuItems(newItems);
  };

  return (
    <div className={style.segmentMenuContainer}>
      <button onClick={separateSelectedContent}>分隔选中内容</button>
      {menuItems.map((item, index) => (
        <SegmentItem
          key={index}
          segment={item}
          selected={index === selectedSegmentIndex}
          onClick={() => {
            handleMenuItemClick(item, index);
          }}
        />
      ))}
      {selectedSegmentIndex !== null && (
        <div className={style.selectedSegmentWindow}>
          <span>选中分段: {menuItems[selectedSegmentIndex].name}</span>
          <button onClick={closeSelectedSegmentWindow}>关闭</button>
        </div>
      )}
    </div>
  );
};
