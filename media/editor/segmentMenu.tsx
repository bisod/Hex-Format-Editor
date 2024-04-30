import React, { useState } from "react";
import { useRecoilValue } from "recoil";
import { useDisplayContext } from "./dataDisplayContext";
import _style from "./segmentMenu.css";
import * as select from "./state"; // 导入状态管理相关的模块
import { throwOnUndefinedAccessInDev } from "./util";

const style = throwOnUndefinedAccessInDev(_style);

class Segment {
  name: string;
  start: number;
  end: number;
  selected: boolean;
  length: number;

  constructor(name: string, start: number, end: number) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.selected = false;
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

const SegmentItem: React.FC<{ segment: Segment; onClick: () => void }> = ({ segment, onClick }) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`编辑分段: ${segment.name}`);
  };

  const handleMerge = (direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`向${direction === "up" ? "上" : "下"}合并分段: ${segment.name}`);
  };

  return (
    <div
      className={`${style.segment} ${segment.selected ? style.selected : ""}`}
      onClick={() => {
        onClick();
        segment.selected = true;
      }}
    >
      <div className={style.segmentName}>{segment.name}</div>
      <div>
        <p>{`${segment.startHex}-${segment.endHex}`}</p>
        <p>{`长度: ${segment.length}`}</p>
      </div>
      <div className={style.buttons}>
        <button onClick={handleEdit}>编辑</button>
        <button onClick={e => handleMerge("up", e)}>上合并</button>
        <button onClick={e => handleMerge("down", e)}>下合并</button>
      </div>
    </div>
  );
};

export const SegmentMenu: React.FC = () => {
  const ctx = useDisplayContext(); // 使用数据管理上下文
  // const [inspected, setInspected] = useState<Range[]>(Array.from(ctx.selection));

  const fileSize = useRecoilValue(select.fileSize) ?? 0; // 如果为undefined，则默认为0
  const [menuItems, setMenuItems] = useState([new Segment("全文", 0, fileSize - 1)]); // 第一个分段为全文
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  const handleMenuItemClick = (segment: Segment) => {
    setSelectedSegment(segment);
  };

  const closeSelectedSegmentWindow = () => {
    setSelectedSegment(null);
  };

  const splitSegment = (index: number) => {
    const segment = menuItems[index];
    const newItem = new Segment(`分段${menuItems.length + 1}`, segment.end + 1, segment.end + 100);
    const updatedMenuItems = [...menuItems];
    updatedMenuItems.splice(index + 1, 0, newItem);
    setMenuItems(updatedMenuItems);
    setSelectedSegment(newItem);
  };

  const separateSelectedContent = () => {
    const selectedRange = ctx.getSelectionRanges()[0];
    // setInspected(Array.from(ctx.selection));
    console.log("ctx.getSelectionRanges()[0];");
    console.log(selectedRange ? [selectedRange.start, selectedRange.end] : [null, null]);

    if (selectedRange) {
      const newItem = new Segment(
        `分段${menuItems.length + 1}`,
        selectedRange.start,
        selectedRange.end - 1,
      );

      console.log("selections[0][0],");
      // 修改原来的分段，以反映新的分段
      const updatedMenuItems = [...menuItems];
      updatedMenuItems.push(newItem);
      setMenuItems(updatedMenuItems);
    }
  };

  return (
    <div className={style.segmentMenuContainer}>
      <button onClick={separateSelectedContent}>分隔选中内容</button>
      {menuItems.map((item, index) => (
        <SegmentItem
          key={index}
          segment={item}
          onClick={() => {
            handleMenuItemClick(item);
          }}
        />
      ))}
      {selectedSegment && (
        <div className={style.selectedSegmentWindow}>
          <span>选中分段: {selectedSegment.name}</span>
          <button onClick={closeSelectedSegmentWindow}>关闭</button>
        </div>
      )}
    </div>
  );
};
