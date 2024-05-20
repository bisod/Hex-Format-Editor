import ListSelection from "@vscode/codicons/src/icons/list-selection.svg";
import TriangleDown from "@vscode/codicons/src/icons/triangle-down.svg";
import TriangleRight from "@vscode/codicons/src/icons/triangle-right.svg";
import React, { useEffect, useState } from "react";
import { MessageType } from "../../shared/protocol";
import { Range } from "../../shared/util/range";
import { useDisplayContext } from "./dataDisplayContext";
import { IFormat, formatManager } from "./dataInspectorProperties";
import _style from "./segmentMenu.css";
import * as select from "./state"; // 导入状态管理相关的模块
import { MenuItem } from "./toolTip";
import { throwOnUndefinedAccessInDev } from "./util";

const style = throwOnUndefinedAccessInDev(_style);

const showWarningMessage = (message: string) => {
  console.error(message);
  select.messageHandler.sendEvent({
    type: MessageType.ShowWarningMessage,
    warnning: message,
  });
};

export class Segment {
  name: string;
  start: number;
  end: number;
  length: number;
  subSegments: Segment[]; // 添加子分段属性
  displayFormat: string; // 添加显示格式属性

  constructor(name: string, start: number, end: number, displayFormat: string = "raw") {
    this.name = name;
    this.start = start;
    this.end = end;
    this.length = this.end - this.start + 1;
    this.subSegments = []; // 初始化子分段数组
    this.displayFormat = displayFormat; // 设置默认显示格式
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
  toIFormat(): IFormat {
    const iFormat: IFormat = {
      label: this.displayFormat,
      minBytes: this.length,
      useNumber: 1,
      subStructures: this.subSegments.map(subSegment => subSegment.toIFormat()),
    };
    return iFormat;
  }

  // 设置显示格式
  setDisplayFormat(format: string) {
    this.displayFormat = format;
  }
  // 添加子分段
  addSubSegment(subSegment: Segment) {
    this.subSegments.push(subSegment);
  }

  // 添加子分段
  addSubSegments(subSegments: Segment[]) {
    this.subSegments.push(...subSegments);
  }

  createSubSegmentByFormat(format: string, splitLength: number) {
    if (this.subSegments.length > 0) {
      showWarningMessage(`已经拥有分段格式，不可划分，请清除分段后再尝试`);
      return;
    }

    // 检查当前分段长度是否符合拆分要求
    if (this.length % splitLength !== 0) {
      showWarningMessage(`段长 (${this.length}) 无法整除数据格式长度 (${splitLength})`);
      return;
    }

    // 计算拆分后的子分段数量
    const numSegments = this.length / splitLength;

    // 根据拆分后的数量创建子分段
    for (let i = 0; i < numSegments; i++) {
      const start = this.start + i * splitLength;
      const end = start + splitLength - 1;
      const subSegmentName = `${this.name}_${format}_${i + 1}`;
      const subSegment = new Segment(subSegmentName, start, end, format);
      this.subSegments.push(subSegment);
    }
  }
}

export const SegmentItem: React.FC<{
  segment: Segment;
  indices: number[]; // 当前分段在菜单项中的索引序列
  selectedIndices: number[]; // 当前选中的分段索引序列
  isLastSegment: boolean;
  onClick: (indices: number[]) => void; // 点击事件处理函数
  mergeSegmentsUp: (indices: number[]) => void;
  mergeSegmentsDown: (indices: number[]) => void;
  showToolTip: (showText: string, mouseX: number, mouseY: number) => void;
  hideToolTip: () => void;
  openContextMenu: (myitems: MenuItem[], mouseX: number, mouseY: number) => void;
  splitSegmentByFormat: (segmentIndices: number[], format: string, splitLength: number) => void;
}> = ({
  segment,
  indices,
  selectedIndices,
  isLastSegment,
  onClick,
  mergeSegmentsUp,
  mergeSegmentsDown,
  showToolTip,
  hideToolTip,
  openContextMenu,
  splitSegmentByFormat,
}) => {
  const [isEditName, setIsEditName] = useState(false);
  const [newName, setNewName] = useState(segment.name);
  const [isSubSegmentsExpanded, setIsSubSegmentsExpanded] = useState(true); // 控制子分段展开与折叠

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    showToolTip(
      `偏移：${segment.startHex}-${segment.endHex}  格式：${segment.displayFormat}`,
      e.clientX,
      e.clientY - 10,
    );
  };
  const handleMouseLeave = () => {
    // 延迟隐藏 ToolTip
    setTimeout(() => {
      hideToolTip();
    }, 100);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const newitems: MenuItem[] = [];
    if (!isEditName) {
      newitems.push({ label: "重命名（F2）", onClick: () => handleRename() });
    }
    if (segment.subSegments.length > 0) {
      newitems.push({
        label: isSubSegmentsExpanded ? "折叠子分段" : "展开子分段",
        onClick: () => toggleSubSegments(),
      });
      newitems.push({
        label: "清空子分段",
        onClick: () => onClearSubSegments(),
      });
    }
    if (indices[indices.length - 1]) {
      newitems.push({ label: "向上合并", onClick: () => handleMergeUp() });
    }

    if (!isLastSegment) {
      newitems.push({ label: "向下合并", onClick: () => handleMergeDown() });
    }

    if (segment.subSegments.length === 0) {
      // 添加规定格式选项
      const formatOptions = formatManager
        .getFormats()
        .filter(type => segment.length >= type.minBytes && 0 === segment.length % type.minBytes)
        .map(type => ({
          label: type.label,
          onClick: () => {
            segment.setDisplayFormat(type.label);
          },
        }));
      if (formatOptions.length > 0) {
        newitems.push({
          label: "规定格式",
          onClick: () => {},
          subItems: formatOptions,
        });
      }

      if (segment.displayFormat === "raw") {
        // 添加划分格式选项
        const formatSplit = formatManager
          .getFormats()
          .filter(type => segment.length >= type.minBytes && 0 === segment.length % type.minBytes)
          .map(type => ({
            label: `${type.label}(${type.minBytes}B/段)`,
            onClick: () => {
              console.log("onclick");
              splitSegmentByFormat(indices, type.label, type.minBytes);
            },
          }));
        if (formatSplit.length > 0) {
          newitems.push({
            label: "批量分隔当前分段",
            onClick: () => {},
            subItems: formatSplit,
          });
        }

        // 添加划分格式选项
        const formatCreate = formatManager
          .getFormats()
          .filter(type => segment.length >= type.minBytes && 0 === segment.length % type.minBytes)
          .map(type => ({
            label: `${type.label}(${type.minBytes}B/段)`,
            onClick: () => {
              segment.createSubSegmentByFormat(type.label, type.minBytes);
            },
          }));
        if (formatCreate.length > 0) {
          newitems.push({
            label: "批量创建子分段",
            onClick: () => {},
            subItems: formatCreate,
          });
        }
      }
    }
    e.preventDefault();
    openContextMenu(newitems, e.clientX, e.clientY);
  };

  const handleMergeUp = () => {
    mergeSegmentsUp(indices);
  };

  const handleMergeDown = () => {
    mergeSegmentsDown(indices);
  };

  const handleItemClick = () => {
    onClick(indices); // 点击当前分段时更新选中分段索引序列
  };

  const onClearSubSegments = () => {
    segment.subSegments = [];
  };

  const handleRename = () => {
    if (isEditName) {
      segment.name = newName;
      setIsEditName(false);
    } else {
      setIsEditName(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        if (selectedIndices.join(",") === indices.join(",") && !isEditName) {
          handleRename();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndices, indices, isEditName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isEditName && e.key === "Enter") {
      handleRename();
    }
  };

  const toggleSubSegments = () => {
    setIsSubSegmentsExpanded(!isSubSegmentsExpanded);
  };

  return (
    <div>
      <div
        className={`${style.segment} ${selectedIndices.join(",") === indices.join(",") ? style.selected : ""}`}
        onClick={handleItemClick} // 修改点击事件处理函数
        style={{ marginLeft: `${(indices.length - 1) * 20}px` }} // 根据索引序列缩进
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            // backgroundColor: "#9d1414",
          }}
        >
          {segment.subSegments.length > 0 ? (
            <div onClick={toggleSubSegments} style={{ marginRight: "4px" }}>
              {isSubSegmentsExpanded ? <TriangleDown /> : <TriangleRight />}
            </div>
          ) : (
            <ListSelection style={{ marginRight: "2px" }} />
          )}
          <div style={{ flexGrow: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {isEditName ? (
                <input
                  style={{ width: "100%" }}
                  type="text"
                  value={newName}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <div className={style.segmentName}>{segment.name}</div>
              )}
              <div className={style.segmentLength}>{`${segment.length}B`}</div>
            </div>
          </div>
        </div>
      </div>
      {/* 递归渲染子分段 */}
      {isSubSegmentsExpanded && segment.subSegments.length > 0 && (
        <div className={style.subSegments}>
          {segment.subSegments.map((subSegment, index) => (
            <SegmentItem
              key={index}
              segment={subSegment}
              indices={[...indices, index]} // 更新子分段的索引序列
              isLastSegment={index + 1 === segment.subSegments.length}
              selectedIndices={selectedIndices} // 传递父级的选中分段索引序列
              onClick={onClick} // 透传点击事件处理函数
              mergeSegmentsUp={mergeSegmentsUp}
              mergeSegmentsDown={mergeSegmentsDown}
              // clearSubSegments={clearSubSegments}
              // renameSegment={renameSegment}
              // onEditSegment={() => {}}
              showToolTip={showToolTip}
              hideToolTip={hideToolTip}
              openContextMenu={openContextMenu}
              splitSegmentByFormat={splitSegmentByFormat}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// interface SegmentMenuProps {
//   setEditSegment: (segment: Segment | null) => void; // 定义 props
// }

export const SegmentMenu: React.FC<{
  menuItems: Segment[];
  // setMenuItems: (newItems: Segment[]) => void;
  setMenuItems: React.Dispatch<React.SetStateAction<Segment[]>>;
  showToolTip: (showText: string, mouseX: number, mouseY: number) => void;
  hideToolTip: () => void;
  openContextMenu: (myitems: MenuItem[], mouseX: number, mouseY: number) => void;
}> = ({ showToolTip, hideToolTip, openContextMenu, menuItems, setMenuItems }) => {
  const ctx = useDisplayContext();
  // const fileSize = useRecoilValue(select.fileSize) ?? 0; // 如果为undefined，则默认为0
  // const [menuItems, setMenuItems] = useState([new Segment("全文", 0, fileSize - 1)]); // 第一个分段为全文
  const [selectedSegmentIndices, setSelectedSegmentIndices] = useState<number[]>([]); // 选中的分段索引序列
  const [nameIndex, setNameIndex] = useState(1);

  const handleMenuItemClick = (indices: number[]) => {
    const segment = getSegmentByIndices(indices);
    ctx.setSelectionRanges([Range.inclusive(segment.start, segment.end)]); // 更新选中的内容
    setSelectedSegmentIndices(indices); // 更新选中分段的索引序列
  };

  const closeSelectedSegmentWindow = () => {
    setSelectedSegmentIndices([]);
  };

  // 定义一个函数来设置编辑状态
  // const handleEditSegment = (segment: Segment) => {
  //   setEditSegment(segment);
  // };

  // 分割选中的内容
  const separateSelectedContent = () => {
    // 获取第一个选中范围
    const selectionRanges: Range[] = ctx.getSelectionRanges();
    if (selectionRanges.length > 0) {
      const originalRange: Range = selectionRanges[0];
      // const originalRange = ctx.getSelectionRanges()[0];
      const selectedRange: Range = new Range(originalRange.start, originalRange.end - 1);

      // 如果存在选中范围

      // 查找当前选中内容在哪个现有分段中
      const segmentIndices = findSegmentIndices(selectedRange.start, selectedRange.end, menuItems);
      console.log(segmentIndices);

      // 如果选中内容在一个现有分段中
      if (segmentIndices.length) {
        // 处理选中内容在单个分段中的情况
        // 处理选中内容在单个分段中的情况
        const newMenuItems = handleSingleSegment(selectedRange, segmentIndices);
        // 更新菜单项
        updateMenuItems(newMenuItems);
      }
      // 如果选中内容不在任何现有分段中
      else {
        // 处理选中内容跨越多个分段的情况
        showWarningMessage("选中内容跨越多个分段，无法处理");
      }
    } else {
      showWarningMessage("无选中内容");
    }
  };

  // 查找当前选中内容在哪个现有分段中的索引序列，如位于第1分段的第2子分段的第0子分段，返回[1,2,0]
  const findSegmentIndices = (
    start: number,
    end: number,
    menuItems: Segment[],
    indices: number[] = [],
  ): number[] => {
    return menuItems.reduce((acc: number[], segment, index) => {
      if (start >= segment.start && end <= segment.end) {
        if (segment.subSegments.length === 0) {
          acc.push(...indices, index);
        } else {
          // 递归搜索子分段
          acc.push(...findSegmentIndices(start, end, segment.subSegments, [...indices, index]));
        }
      }
      return acc;
    }, []);
  };

  // 根据索引序列获取分段
  const getSegmentByIndices = (indices: number[], segments: Segment[] = menuItems): Segment => {
    let currentSegment = segments[indices[0]]; // 获取根分段

    // 根据索引序列逐级获取嵌套的子分段
    for (let i = 1; i < indices.length; i++) {
      currentSegment = currentSegment.subSegments[indices[i]]; // 获取当前层级的分段
    }

    return currentSegment;
  };

  // 处理选中内容在单个分段中的情况
  const handleSingleSegment = (selectedRange: Range, segmentIndices: number[]): Segment[] => {
    const handleSegment = getSegmentByIndices(segmentIndices, menuItems);

    // 如果选中内容与当前分段完全重合，无需拆分
    if (selectedRange.start === handleSegment.start && selectedRange.end === handleSegment.end) {
      showWarningMessage("选中内容与分段完全重合，无需拆分");
      return menuItems; // 返回原始菜单项列表
    }

    let newHandleSegments: Segment[]; // 新的子分段列表

    // 如果选中内容的开始与当前分段的开始相同
    if (selectedRange.start === handleSegment.start) {
      // 在选中内容的开始处拆分分段，并获取更新后的子分段列表
      newHandleSegments = splitSegmentAtStart(selectedRange, handleSegment);
    }
    // 如果选中内容的结束与当前分段的结束相同
    else if (selectedRange.end === handleSegment.end) {
      // 在选中内容的结束处拆分分段，并获取更新后的子分段列表
      newHandleSegments = splitSegmentAtEnd(selectedRange, handleSegment);
    }
    // 其他情况，在选中内容中间位置拆分分段，并获取更新后的子分段列表
    else {
      newHandleSegments = splitSegmentInMiddle(selectedRange, handleSegment);
    }

    return replaceSegmentAtIndex(newHandleSegments, segmentIndices); // 返回最高层次的分段列表
  };

  const replaceSegmentAtIndex = (
    newSegments: Segment[],
    segmentIndices: number[],
    segments: Segment[] = menuItems,
  ): Segment[] => {
    // 如果分段索引序列为空或新的分段列表为空，则直接返回原始分段列表
    if (segmentIndices.length === 0 || newSegments.length === 0) {
      return segments;
    }

    // 如果分段索引的长度为1，说明要替换的是最顶层的分段
    if (segmentIndices.length === 1) {
      const segmentIndex = segmentIndices[0];
      // 如果分段索引超出了原分段列表的范围，则直接返回原始分段列表
      if (segmentIndex < 0 || segmentIndex >= segments.length) {
        console.error("分段索引超出范围");
        return segments;
      }
      // 创建新的分段列表
      const newSegmentsList = [...segments];
      // 将newSegments中的所有项替换目标分段
      newSegmentsList.splice(segmentIndex, 1, ...newSegments);
      return newSegmentsList;
    } else {
      // 获取父分段索引序列
      const parentIndices = segmentIndices.slice(0, -1);
      const parentSegment = getSegmentByIndices(parentIndices, segments); // 获取父分段
      const segmentIndex = segmentIndices[segmentIndices.length - 1]; // 获取要替换的分段在父分段的子分段列表中的索引

      // 如果父分段不存在或子分段索引超出范围，则直接返回原始分段列表
      if (!parentSegment || segmentIndex < 0 || segmentIndex >= parentSegment.subSegments.length) {
        console.error("分段索引超出范围");
        return segments;
      }

      // 创建新的子分段列表
      const newSubSegmentsList = [...parentSegment.subSegments];
      // 将newSegments中的所有项替换目标分段
      newSubSegmentsList.splice(segmentIndex, 1, ...newSegments);
      parentSegment.subSegments = newSubSegmentsList; // 更新父分段的子分段列表

      return segments;
    }
  };

  // 在选中内容的开始处拆分分段，返回当前层次的分段列表
  const splitSegmentAtStart = (
    selectedRange: Range,
    handleSegment: Segment,
    isNewName: boolean = false,
  ): Segment[] => {
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, selectedRange.start, selectedRange.end);
    let newItem2: Segment;
    if (isNewName) {
      newItem2 = new Segment(`分段${nameIndex + 1}`, selectedRange.end + 1, handleSegment.end);
      setNameIndex(prevIndex => prevIndex + 2);
    } else {
      newItem2 = new Segment(handleSegment.name, selectedRange.end + 1, handleSegment.end);
      setNameIndex(prevIndex => prevIndex + 1);
    }
    return [newItem1, newItem2];
  };

  // 在选中内容的结束处拆分分段，返回当前层次的分段列表
  const splitSegmentAtEnd = (
    selectedRange: Range,
    handleSegment: Segment,
    isNewName: boolean = false,
  ): Segment[] => {
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, selectedRange.start, selectedRange.end);
    let newItem2: Segment;
    if (isNewName) {
      newItem2 = new Segment(`分段${nameIndex + 1}`, handleSegment.start, selectedRange.start - 1);
      setNameIndex(prevIndex => prevIndex + 2);
    } else {
      newItem2 = new Segment(handleSegment.name, handleSegment.start, selectedRange.start - 1);
      setNameIndex(prevIndex => prevIndex + 1);
    }
    // 返回更新后的子分段列表
    return [newItem2, newItem1];
  };

  // 在选中内容的中间位置拆分分段，返回当前层次的分段列表
  const splitSegmentInMiddle = (
    selectedRange: Range,
    handleSegment: Segment,
    isNewName: boolean = false,
  ): Segment[] => {
    // 创建新的分段
    const newItem1 = new Segment(`分段${nameIndex}`, handleSegment.start, selectedRange.start - 1);
    // const newItem3 = new Segment(`分段${nameIndex + 1}`, selectedRange.end + 1, handleSegment.end);
    let newItem2: Segment;
    let newItem3: Segment;
    if (isNewName) {
      newItem2 = new Segment(`分段${nameIndex + 1}`, selectedRange.start, selectedRange.end);
      newItem3 = new Segment(`分段${nameIndex + 2}`, selectedRange.end + 1, handleSegment.end);
      setNameIndex(prevIndex => prevIndex + 3);
    } else {
      newItem2 = new Segment(handleSegment.name, selectedRange.start, selectedRange.end);
      newItem3 = new Segment(`分段${nameIndex + 1}`, selectedRange.end + 1, handleSegment.end);
      setNameIndex(prevIndex => prevIndex + 2);
    }

    // 返回更新后的子分段列表
    return [newItem1, newItem2, newItem3];
  };

  // 更新菜单项
  const updateMenuItems = (newItems: Segment[]) => {
    setMenuItems(newItems);
  };

  // 向上合并分段
  const mergeSegmentsUp = (segmentIndices: number[]) => {
    const index = segmentIndices[segmentIndices.length - 1]; // 获取最低层级分段的索引
    if (segmentIndices.length === 1 && index > 0) {
      const currentSegment = menuItems[index];
      const previousSegment = menuItems[index - 1];
      const mergedSegment = new Segment(
        previousSegment.name,
        previousSegment.start,
        currentSegment.end,
      );

      const updatedMenuItems = [
        ...menuItems.slice(0, index - 1),
        mergedSegment,
        ...menuItems.slice(index + 1),
      ];

      setMenuItems(updatedMenuItems);
      setSelectedSegmentIndices([index - 1]); // 更新选中分段的索引序列
    } else if (segmentIndices.length > 1) {
      const parentIndices = segmentIndices.slice(0, -1); // 获取父分段的索引序列
      const parentSegment = getSegmentByIndices(parentIndices, menuItems); // 获取父分段
      const currentSegment = parentSegment.subSegments[index]; // 获取当前分段

      // 向上合并分段
      const previousSegment = parentSegment.subSegments[index - 1];
      const mergedSegment = new Segment(
        previousSegment.name,
        previousSegment.start,
        currentSegment.end,
      );

      // 更新父分段的子分段列表
      const updatedSubSegments = [
        ...parentSegment.subSegments.slice(0, index - 1),
        mergedSegment,
        ...parentSegment.subSegments.slice(index + 1),
      ];

      parentSegment.subSegments = updatedSubSegments;
      setSelectedSegmentIndices([...parentIndices, index - 1]); // 更新选中分段的索引序列
    }
  };

  // 向下合并分段
  const mergeSegmentsDown = (segmentIndices: number[]) => {
    const index = segmentIndices[segmentIndices.length - 1]; // 获取最低层级分段的索引
    if (segmentIndices.length === 1) {
      if (index < menuItems.length - 1) {
        const currentSegment = menuItems[index];
        const nextSegment = menuItems[index + 1];
        const mergedSegment = new Segment(nextSegment.name, currentSegment.start, nextSegment.end);
        const updatedMenuItems = [
          ...menuItems.slice(0, index),
          mergedSegment,
          ...menuItems.slice(index + 2),
        ];
        setMenuItems(updatedMenuItems);
        setSelectedSegmentIndices([index]); // 更新选中分段的索引序列
      }
    } else if (segmentIndices.length > 1) {
      const parentIndices = segmentIndices.slice(0, -1); // 获取父分段的索引序列
      const parentSegment = getSegmentByIndices(parentIndices, menuItems); // 获取父分段

      if (index < parentSegment.subSegments.length - 1) {
        const currentSegment = parentSegment.subSegments[index]; // 获取当前分段

        // 向下合并分段
        const nextSegment = parentSegment.subSegments[index + 1];
        const mergedSegment = new Segment(nextSegment.name, currentSegment.start, nextSegment.end);

        // 更新父分段的子分段列表
        const updatedSubSegments = [
          ...parentSegment.subSegments.slice(0, index),
          mergedSegment,
          ...parentSegment.subSegments.slice(index + 2),
        ];

        parentSegment.subSegments = updatedSubSegments;
        setSelectedSegmentIndices([...parentIndices, index]); // 更新选中分段的索引序列
      }
    }
  };

  // 创建子分段
  const createSubSegment = () => {
    const selectionRanges: Range[] = ctx.getSelectionRanges();
    if (selectionRanges.length > 0) {
      const originalRange: Range = selectionRanges[0];
      const selectedRange: Range = new Range(originalRange.start, originalRange.end - 1);

      // 如果存在选中范围

      // 查找当前选中内容在哪个现有分段中
      const segmentIndices = findSegmentIndices(selectedRange.start, selectedRange.end, menuItems);

      // 如果选中内容在一个现有分段中
      if (segmentIndices.length) {
        // 获取当前分段
        const parentSegment = getSegmentByIndices(segmentIndices, menuItems);
        // 如果选中内容与当前分段完全重合，无需拆分
        if (
          selectedRange.start === parentSegment.start &&
          selectedRange.end === parentSegment.end
        ) {
          showWarningMessage("选中内容与分段完全重合，无需拆分");
          return menuItems; // 返回原始菜单项列表
        }

        let newSubSegments: Segment[]; // 新的子分段列表

        // 如果选中内容的开始与当前分段的开始相同
        if (selectedRange.start === parentSegment.start) {
          // 在选中内容的开始处拆分分段，并获取更新后的子分段列表
          newSubSegments = splitSegmentAtStart(selectedRange, parentSegment, true);
        }
        // 如果选中内容的结束与当前分段的结束相同
        else if (selectedRange.end === parentSegment.end) {
          // 在选中内容的结束处拆分分段，并获取更新后的子分段列表
          newSubSegments = splitSegmentAtEnd(selectedRange, parentSegment, true);
        }
        // 其他情况，在选中内容中间位置拆分分段，并获取更新后的子分段列表
        else {
          newSubSegments = splitSegmentInMiddle(selectedRange, parentSegment, true);
        }
        // 将新创建的子分段添加到父分段中
        parentSegment.addSubSegments(newSubSegments);

        // 更新菜单项
        updateMenuItems([...menuItems]);
      } else {
        showWarningMessage("选中内容跨越多个分段，无法处理");
      }
    } else {
      showWarningMessage("无选中内容");
    }
  };

  const splitSegmentByFormat = (segmentIndices: number[], format: string, splitLength: number) => {
    const index = segmentIndices[segmentIndices.length - 1];
    if (segmentIndices.length === 1) {
      const currentSegment = menuItems[index];
      if (currentSegment.subSegments.length > 0) {
        showWarningMessage(`已经拥有分段格式，不可划分，请清除分段后再尝试`);
        return;
      }
      // 检查当前分段长度是否符合拆分要求
      if (currentSegment.length % splitLength !== 0) {
        showWarningMessage(`段长 (${currentSegment.length}) 无法整除数据格式长度 (${splitLength})`);
        return;
      }

      const numSegments = currentSegment.length / splitLength;
      const newItems: Segment[] = [];
      // 根据拆分后的数量创建子分段
      for (let i = 0; i < numSegments; i++) {
        const start = currentSegment.start + i * splitLength;
        const end = start + splitLength - 1;
        const subSegmentName = `${currentSegment.name}_${format}_${i + 1}`;
        const subSegment = new Segment(subSegmentName, start, end, format);
        newItems.push(subSegment);
      }

      setMenuItems([...menuItems.slice(0, index), ...newItems, ...menuItems.slice(index + 1)]);
      setSelectedSegmentIndices([]); // 更新选中分段的索引序列
    } else {
      const parentIndices = segmentIndices.slice(0, -1); // 获取父分段的索引序列
      const parentSegment = getSegmentByIndices(parentIndices, menuItems); // 获取父分段
      // parentSegment.createSubSegmentByFormat(format, splitLength);
      const currentSegment = getSegmentByIndices(segmentIndices, menuItems);
      if (currentSegment.subSegments.length > 0) {
        showWarningMessage(`已经拥有分段格式，不可划分，请清除分段后再尝试`);
        return;
      }
      // 检查当前分段长度是否符合拆分要求
      if (currentSegment.length % splitLength !== 0) {
        showWarningMessage(`段长 (${currentSegment.length}) 无法整除数据格式长度 (${splitLength})`);
        return;
      }

      const numSegments = currentSegment.length / splitLength;
      const newItems: Segment[] = [];
      // 根据拆分后的数量创建子分段
      for (let i = 0; i < numSegments; i++) {
        const start = currentSegment.start + i * splitLength;
        const end = start + splitLength - 1;
        const subSegmentName = `${currentSegment.name}_${format}_${i + 1}`;
        const subSegment = new Segment(subSegmentName, start, end, format);
        newItems.push(subSegment);
      }
      parentSegment.subSegments = [
        ...menuItems.slice(0, index),
        ...newItems,
        ...menuItems.slice(index + 1),
      ];
      setSelectedSegmentIndices([]); // 更新选中分段的索引序列
    }
  };

  return (
    <div className={style.segmentMenuContainer}>
      <button onClick={createSubSegment}>创建子分段</button>
      <button onClick={separateSelectedContent}>分隔选中内容</button>
      <hr />
      {menuItems.map((item, index) => (
        <SegmentItem
          key={index}
          segment={item}
          indices={[index]} // 根分段的索引序列是其在菜单项中的索引
          isLastSegment={index + 1 === menuItems.length}
          selectedIndices={selectedSegmentIndices} // 传递选中分段的索引序列
          onClick={(clickedIndices: number[]) => handleMenuItemClick(clickedIndices)}
          mergeSegmentsUp={(indices: number[]) => mergeSegmentsUp(indices)}
          mergeSegmentsDown={(indices: number[]) => mergeSegmentsDown(indices)}
          showToolTip={showToolTip}
          hideToolTip={hideToolTip}
          openContextMenu={openContextMenu}
          splitSegmentByFormat={splitSegmentByFormat}
        />
      ))}
      {selectedSegmentIndices.length > 0 && (
        <div className={style.selectedSegmentWindow}>
          <span>选中分段: {selectedSegmentIndices}</span>
          <button onClick={closeSelectedSegmentWindow}>关闭</button>
        </div>
      )}
    </div>
  );
};
