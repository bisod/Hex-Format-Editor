import ListSelection from "@vscode/codicons/src/icons/list-selection.svg";
import TriangleDown from "@vscode/codicons/src/icons/triangle-down.svg";
import TriangleRight from "@vscode/codicons/src/icons/triangle-right.svg";
import React, { useEffect, useState } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { MessageType } from "../../shared/protocol";
import { Range } from "../../shared/util/range";
import { useDisplayContext } from "./dataDisplayContext";
import { IFormat, formatManager } from "./dataInspectorProperties";
import _style from "./segmentMenu.css";
import * as select from "./state"; // 导入状态管理相关的模块
import { MenuItem } from "./toolTip";
import { throwOnUndefinedAccessInDev } from "./util";

const style = throwOnUndefinedAccessInDev(_style);

function areListsNotEqual<T>(list1: T[], list2: T[]): boolean {
  // 如果两个列表长度不相等，则它们肯定不相等
  if (list1.length !== list2.length) {
    return true;
  }

  // 比较每个元素是否相等
  for (let i = 0; i < list1.length; i++) {
    if (list1[i] !== list2[i]) {
      return true;
    }
  }

  // 如果以上条件都不满足，则列表相等
  return false;
}
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
  format: string;
  isArrayItem: boolean;
  // arrayFormat?: string;
  belongStruct: number[];
  // locationInStruct: number[];

  constructor(
    name: string,
    start: number,
    end: number,
    // format:string = "raw",
    belongStruct: number[],
    // locationInStruct: number[] = [],
    displayFormat: string = "raw",
    isArrayItem: boolean = false,
  ) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.length = this.end - this.start + 1;
    this.subSegments = []; // 初始化子分段数组
    this.displayFormat = displayFormat; // 设置默认显示格式
    if (formatManager.getUserFormatByLabel(displayFormat) !== undefined) {
      this.format = "struct";
    } else {
      this.format = this.displayFormat;
    }

    this.isArrayItem = isArrayItem;
    this.belongStruct = belongStruct;
    // this.locationInStruct = locationInStruct;
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

  // isInUserFormats = (): boolean => {
  //   return formatManager.getUserFormats().some(format => format.label === this.format);
  // };

  // subSegmentsToIFormat(): IFormat[] {
  //   const iFormats: IFormat[] = [];
  //   // 遍历子分段
  //   this.subSegments.forEach(subSegment => {
  //     // 如果子分段有子结构，则将其转换为 IFormat
  //     // const subStructures = subSegment.subSegmentsToIFormat();

  //     // 构建当前分段的 IFormat
  //     const iFormat: IFormat = {
  //       label: subSegment.displayFormat,
  //       minBytes: subSegment.length,
  //       isArray: subSegment.format === "array",
  //       arrayItemFormat:
  //         subSegment.format === "array" ? subSegment.subSegments[0].displayFormat : undefined,
  //       arrayLength: subSegment.format === "array" ? subSegment.subSegments.length : undefined,
  //       subStructures:
  //         subSegment.format === "array" || subSegment.format === "struct"
  //           ? undefined
  //           : subSegment.subSegments.length > 0
  //             ? subSegment.subSegmentsToIFormat()
  //             : undefined,
  //     };

  //     iFormats.push(iFormat);
  //   });
  //   return iFormats;
  // }
  createStructByFormat(format: string, indices: number[]) {
    this.format = "struct";
    this.displayFormat = format;
    const setBelongStruct = (segments: Segment[]) => {
      segments.forEach(segment => {
        if (segment.format === "struct") {
          segment.belongStruct = indices;
        } else {
          segment.belongStruct = indices;
          setBelongStruct(segment.subSegments);
        }
      });
    };
    setBelongStruct(this.subSegments);
  }

  setFormat(format: string) {
    this.format = format;
  }

  // 设置显示格式
  setDisplayFormat(format: string, isarray: boolean = false) {
    this.format = isarray ? `array` : format;

    this.displayFormat = isarray ? `Array<${format}>[${this.subSegments.length}]` : format;
  }

  clearDisplayFormat = () => {
    if (this.subSegments.length > 0) {
      this.subSegments.length = 0;
    }
    this.displayFormat = "raw";
  };
  // 添加子分段
  addSubSegment(subSegment: Segment) {
    this.subSegments.push(subSegment);
  }

  // 添加子分段
  addSubSegments(subSegments: Segment[]) {
    this.subSegments.push(...subSegments);
  }

  setArrayByFormat(format: string, splitLength: number) {
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
      const subSegment = new Segment(subSegmentName, start, end, this.belongStruct, format, true);
      this.subSegments.push(subSegment);
    }
    this.setDisplayFormat(format, true);
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
  showToolTip: (showText: string[], mouseX: number, mouseY: number) => void;
  hideToolTip: () => void;
  openContextMenu: (myitems: MenuItem[], mouseX: number, mouseY: number) => void;
  splitSegmentByFormat: (segmentIndices: number[], format: string, splitLength: number) => void;
  getSegmentByIndices: (indices: number[]) => Segment;
  // findIndicesBySegment: (mysegment: Segment) => number[];
  setFormatBySegment: (formatSegment: Segment, targetSegment: Segment) => void;
  updateFormatByIndices: (indices: number[]) => void;
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
  getSegmentByIndices,
  // findIndicesBySegment,
  setFormatBySegment,
  updateFormatByIndices,
}) => {
  const [isEditName, setIsEditName] = useState(false);
  const [newName, setNewName] = useState(segment.name);
  const [isSubSegmentsExpanded, setIsSubSegmentsExpanded] = useState(true); // 控制子分段展开与折叠
  const setInputModalState = useSetRecoilState(select.inputModalState);

  const getAllName = () => {
    const names = indices.map(
      (value, index) => getSegmentByIndices(indices.slice(0, index + 1)).name,
    );
    return names.join(" \\ ");
  };
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const text: string[] = [];

    text.push(
      getAllName(),
      `偏移：${segment.startHex}-${segment.endHex}`,
      `长度：${segment.length}B`,
      `格式：${segment.displayFormat}`,
    );
    if (segment.belongStruct.length > 0) {
      text.push(
        `所属结构体：${getSegmentByIndices(segment.belongStruct).displayFormat}([${segment.belongStruct}])`,
      );
    }
    showToolTip(text, e.clientX, e.clientY - 10);
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

    // 不是数组中的元素，可以修改格式，否则只能重命名
    if (!segment.isArrayItem) {
      // 已经规定格式
      if (segment.displayFormat !== "raw") {
        newitems.push({
          label: "清除格式",
          onClick: () => {
            if (segment.format === "struct") {
              formatManager.removeLocationByLabel(segment.displayFormat, indices);
            }
            segment.clearDisplayFormat();
            updateFormat();
          },
        });

        if (segment.displayFormat === "undefStruct" && segment.belongStruct.length === 0) {
          // 创建格式功能：读取用户输入的名称，检测是否重名，不重名则修改格式并添加入格式管理器
          newitems.push({
            label: "定义结构体",
            onClick: () => handleCreateFormat(segment),
          });
        }

        if (segment.subSegments.length === 0) {
          // 添加规定格式选项
          const formatOptions = formatManager
            .getBaseFormats()
            .filter(type => segment.length >= type.minBytes && 0 === segment.length % type.minBytes)
            .map(type => ({
              label:
                segment.length > type.minBytes
                  ? `${type.label}数组(${type.minBytes}B/段 共${segment.length / type.minBytes}段)`
                  : type.label,
              onClick: () => {
                segment.length > type.minBytes
                  ? segment.setArrayByFormat(type.label, type.minBytes)
                  : segment.setDisplayFormat(type.label);
                updateFormat();
              },
            }));
          formatOptions.push(
            ...formatManager.getTextFormats().map(type => ({
              label: type.label,
              onClick: () => {
                segment.setDisplayFormat(type.label);
                updateFormat();
              },
            })),
          );
          if (segment.belongStruct.length === 0) {
            formatOptions.push(
              ...formatManager
                .getUserFormats()
                .filter(type => segment.length === type.minBytes)
                .map(type => ({
                  label: type.label,
                  onClick: () => {
                    const a = formatManager.getFormatByLabel(type.label);
                    if (a !== undefined) {
                      setFormatBySegment(getSegmentByIndices(a.locations[0]), segment);
                    }
                  },
                })),
            );
          }
          if (formatOptions.length > 0) {
            newitems.push({
              label: "修改格式",
              onClick: () => {},
              subItems: formatOptions,
            });
          }
        }
      } else {
        // 不具备子结构的单元格式，可以设置格式
        if (segment.subSegments.length === 0) {
          // 添加规定格式选项
          const formatOptions = formatManager
            .getBaseFormats()
            .filter(type => segment.length >= type.minBytes && 0 === segment.length % type.minBytes)
            .map(type => ({
              label:
                segment.length > type.minBytes
                  ? `${type.label}数组(${type.minBytes}B/段 共${segment.length / type.minBytes}段)`
                  : type.label,
              onClick: () => {
                segment.length > type.minBytes
                  ? segment.setArrayByFormat(type.label, type.minBytes)
                  : segment.setDisplayFormat(type.label);
                updateFormat();
              },
            }));
          formatOptions.push(
            ...formatManager.getTextFormats().map(type => ({
              label: type.label,
              onClick: () => {
                segment.setDisplayFormat(type.label);
                updateFormat();
              },
            })),
          );
          if (segment.belongStruct.length === 0) {
            formatOptions.push(
              ...formatManager
                .getUserFormats()
                .filter(type => segment.length === type.minBytes)
                .map(type => ({
                  label: type.label,
                  onClick: () => {
                    const a = formatManager.getFormatByLabel(type.label);
                    if (a !== undefined) {
                      setFormatBySegment(getSegmentByIndices(a.locations[0]), segment);
                    }
                    // formatManager.addLocationByLabel(type.label, indices);
                  },
                })),
            );
          }
          if (formatOptions.length > 0) {
            newitems.push({
              label: "设置显示格式",
              onClick: () => {},
              subItems: formatOptions,
            });
          }
          // 不具备子结构的单元格式
          const formatSplit = formatManager
            .getBaseFormats()
            .filter(type => segment.length > type.minBytes && 0 === segment.length % type.minBytes)
            .map(type => ({
              label: `${type.label}(${type.minBytes}B/段 共${segment.length / type.minBytes}段)`,
              onClick: () => splitSegmentByFormat(indices, type.label, type.minBytes),
            }));
          if (formatSplit.length > 0) {
            newitems.push({
              label: "划分当前分段",
              onClick: () => {},
              subItems: formatSplit,
            });
          }
        }

        // 未归定格式，可以随意合并
        if (indices[indices.length - 1]) {
          const previousSegmentIndices = [...indices.slice(0, -1), indices[indices.length - 1] - 1];
          const previousSegment = getSegmentByIndices(previousSegmentIndices);
          if (previousSegment.displayFormat === "raw" && previousSegment.subSegments.length === 0) {
            newitems.push({ label: "向上合并", onClick: () => handleMergeUp() });
          }
        }

        if (!isLastSegment) {
          const nextSegmentIndices = [...indices.slice(0, -1), indices[indices.length - 1] + 1];
          const nextSegment = getSegmentByIndices(nextSegmentIndices);
          if (nextSegment.displayFormat === "raw" && nextSegment.subSegments.length === 0) {
            newitems.push({ label: "向下合并", onClick: () => handleMergeDown() });
          }
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
    openContextMenu(newitems, e.clientX, e.clientY);
  };

  const handleCreateFormat = (segment: Segment) => {
    setInputModalState({
      isVisible: true,
      onSubmit: (formatName: string) => {
        const existingFormats = formatManager.getAllFormats();
        if (existingFormats.some(format => format.label === formatName)) {
          showWarningMessage("格式名称重复，请使用其他名称。");
          return;
        } else {
          const newFormat: IFormat = {
            label: formatName,
            minBytes: segment.length,
            locations: [indices],
          };

          formatManager.addFormat(newFormat);
          segment.createStructByFormat(formatName, indices);
        }
      },
    });
  };

  const updateFormat = () => {
    updateFormatByIndices(indices);
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
        style={{ marginLeft: `${(indices.length - 1) * 10}px` }} // 根据索引序列缩进
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
              showToolTip={showToolTip}
              hideToolTip={hideToolTip}
              openContextMenu={openContextMenu}
              splitSegmentByFormat={splitSegmentByFormat}
              getSegmentByIndices={getSegmentByIndices}
              // findIndicesBySegment={findIndicesBySegment}
              setFormatBySegment={setFormatBySegment}
              updateFormatByIndices={updateFormatByIndices}
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
  setMenuItems: React.Dispatch<React.SetStateAction<Segment[]>>;
  showToolTip: (showText: string[], mouseX: number, mouseY: number) => void;
  hideToolTip: () => void;
  openContextMenu: (myitems: MenuItem[], mouseX: number, mouseY: number) => void;
}> = ({ showToolTip, hideToolTip, openContextMenu, menuItems, setMenuItems }) => {
  const ctx = useDisplayContext();
  const [selectedSegmentIndices, setSelectedSegmentIndices] = useState<number[]>([]); // 选中的分段索引序列
  const [nameIndex, setNameIndex] = useState(1);
  const [offset, setOffset] = useRecoilState(select.offset);
  const dimensions = useRecoilValue(select.dimensions);
  const columnWidth = useRecoilValue(select.columnWidth);

  const handleMenuItemClick = (indices: number[]) => {
    const segment = getSegmentByIndices(indices);
    ctx.setSelectionRanges([Range.inclusive(segment.start, segment.end)]); // 更新选中的内容
    if (!select.isByteVisible(dimensions, columnWidth, offset, segment.start)) {
      setOffset(
        Math.max(
          0,
          select.startOfRowContainingByte(
            segment.start + 1 - select.getDisplayedBytes(dimensions, columnWidth) / 3,
            columnWidth,
          ),
        ),
      );
    }
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

      // 如果选中内容在一个现有分段中
      if (segmentIndices.length) {
        // 处理选中内容在单个分段中的情况
        // 处理选中内容在单个分段中的情况

        handleSingleSegment(selectedRange, segmentIndices);
        updateFormatByIndices(segmentIndices);
        // 更新菜单项
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

  const findIndicesBySegment = (
    targetsegment: Segment,
    menuItems: Segment[],
    indices: number[] = [],
  ) => {
    return menuItems.reduce((acc: number[], segment, index) => {
      if (targetsegment.start >= segment.start && targetsegment.end <= segment.end) {
        if (segment === targetsegment) {
          acc.push(...indices, index);
        } else {
          // 递归搜索子分段
          acc.push(
            ...findIndicesBySegment(targetsegment, segment.subSegments, [...indices, index]),
          );
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
  const handleSingleSegment = (selectedRange: Range, segmentIndices: number[]) => {
    const handleSegment = getSegmentByIndices(segmentIndices, menuItems);
    if (handleSegment.format !== "raw") {
      showWarningMessage("选中内容必须在raw中，请清除格式后重试");
      return;
    }
    if (selectedRange.start === handleSegment.start && selectedRange.end === handleSegment.end) {
      // 如果选中内容与当前分段完全重合，无需拆分
      showWarningMessage("选中内容与分段完全重合，无需拆分");
      return;
    }

    let newHandleSegments: Segment[]; // 新的子分段列表
    let change = 0;
    // 如果选中内容的开始与当前分段的开始相同
    if (selectedRange.start === handleSegment.start) {
      // 在选中内容的开始处拆分分段，并获取更新后的子分段列表
      newHandleSegments = splitSegmentAtStart(selectedRange, handleSegment);
    }
    // 如果选中内容的结束与当前分段的结束相同
    else if (selectedRange.end === handleSegment.end) {
      // 在选中内容的结束处拆分分段，并获取更新后的子分段列表
      newHandleSegments = splitSegmentAtEnd(selectedRange, handleSegment);
      change = 2;
    }
    // 其他情况，在选中内容中间位置拆分分段，并获取更新后的子分段列表
    else {
      newHandleSegments = splitSegmentInMiddle(selectedRange, handleSegment);
      change = 1;
    }

    setMenuItems(replaceSegmentAtIndex(newHandleSegments, segmentIndices));
    segmentIndices[segmentIndices.length - 1] += change;
    setSelectedSegmentIndices(segmentIndices);
    if (segmentIndices.length > 1) {
      updateFormatByIndices(segmentIndices.slice(0, -1));
    }
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
        showWarningMessage("分段索引超出范围");
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
        showWarningMessage("分段索引超出范围");
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
    const newItem1 = new Segment(
      `分段${nameIndex}`,
      selectedRange.start,
      selectedRange.end,
      handleSegment.belongStruct,
    );
    let newItem2: Segment;
    if (isNewName) {
      newItem2 = new Segment(
        `分段${nameIndex + 1}`,
        selectedRange.end + 1,
        handleSegment.end,
        handleSegment.belongStruct,
      );
      setNameIndex(prevIndex => prevIndex + 2);
    } else {
      newItem2 = new Segment(
        handleSegment.name,
        selectedRange.end + 1,
        handleSegment.end,
        handleSegment.belongStruct,
      );
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
    const newItem1 = new Segment(
      `分段${nameIndex}`,
      selectedRange.start,
      selectedRange.end,
      handleSegment.belongStruct,
    );
    let newItem2: Segment;
    if (isNewName) {
      newItem2 = new Segment(
        `分段${nameIndex + 1}`,
        handleSegment.start,
        selectedRange.start - 1,
        handleSegment.belongStruct,
      );
      setNameIndex(prevIndex => prevIndex + 2);
    } else {
      newItem2 = new Segment(
        handleSegment.name,
        handleSegment.start,
        selectedRange.start - 1,
        handleSegment.belongStruct,
      );
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
    const newItem1 = new Segment(
      `分段${nameIndex}`,
      handleSegment.start,
      selectedRange.start - 1,
      handleSegment.belongStruct,
    );
    // const newItem3 = new Segment(`分段${nameIndex + 1}`, selectedRange.end + 1, handleSegment.end);
    let newItem2: Segment;
    let newItem3: Segment;
    if (isNewName) {
      newItem2 = new Segment(
        `分段${nameIndex + 1}`,
        selectedRange.start,
        selectedRange.end,
        handleSegment.belongStruct,
      );
      newItem3 = new Segment(
        `分段${nameIndex + 2}`,
        selectedRange.end + 1,
        handleSegment.end,
        handleSegment.belongStruct,
      );
      setNameIndex(prevIndex => prevIndex + 3);
    } else {
      newItem2 = new Segment(
        handleSegment.name,
        selectedRange.start,
        selectedRange.end,
        handleSegment.belongStruct,
      );
      newItem3 = new Segment(
        `分段${nameIndex + 1}`,
        selectedRange.end + 1,
        handleSegment.end,
        handleSegment.belongStruct,
      );
      setNameIndex(prevIndex => prevIndex + 2);
    }

    // 返回更新后的子分段列表
    return [newItem1, newItem2, newItem3];
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
        currentSegment.belongStruct,
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
        currentSegment.belongStruct,
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
    if (segmentIndices.length > 1) {
      updateFormatByIndices(segmentIndices.slice(0, -1));
    }
  };

  // 向下合并分段
  const mergeSegmentsDown = (segmentIndices: number[]) => {
    const index = segmentIndices[segmentIndices.length - 1]; // 获取最低层级分段的索引
    if (segmentIndices.length === 1) {
      if (index < menuItems.length - 1) {
        const currentSegment = menuItems[index];
        const nextSegment = menuItems[index + 1];
        const mergedSegment = new Segment(
          nextSegment.name,
          currentSegment.start,
          nextSegment.end,
          currentSegment.belongStruct,
        );
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
        const mergedSegment = new Segment(
          nextSegment.name,
          currentSegment.start,
          nextSegment.end,
          currentSegment.belongStruct,
        );

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
    if (segmentIndices.length > 1) {
      updateFormatByIndices(segmentIndices.slice(0, -1));
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
        if (parentSegment.format !== "raw") {
          showWarningMessage("选中内容必须在raw中，请清除格式后重试");
          return;
        }
        // 如果选中内容与当前分段完全重合，无需拆分
        if (
          selectedRange.start === parentSegment.start &&
          selectedRange.end === parentSegment.end
        ) {
          showWarningMessage("选中内容与分段完全重合，无需拆分");
          return menuItems; // 返回原始菜单项列表
        }

        let newSubSegments: Segment[]; // 新的子分段列表
        let change = 0;
        // 如果选中内容的开始与当前分段的开始相同
        if (selectedRange.start === parentSegment.start) {
          // 在选中内容的开始处拆分分段，并获取更新后的子分段列表
          newSubSegments = splitSegmentAtStart(selectedRange, parentSegment, true);
        }
        // 如果选中内容的结束与当前分段的结束相同
        else if (selectedRange.end === parentSegment.end) {
          // 在选中内容的结束处拆分分段，并获取更新后的子分段列表
          newSubSegments = splitSegmentAtEnd(selectedRange, parentSegment, true);
          change = 2;
        }
        // 其他情况，在选中内容中间位置拆分分段，并获取更新后的子分段列表
        else {
          newSubSegments = splitSegmentInMiddle(selectedRange, parentSegment, true);
          change = 1;
        }
        // 将新创建的子分段添加到父分段中
        parentSegment.addSubSegments(newSubSegments);
        parentSegment.setDisplayFormat("undefStruct");

        // 更新菜单项
        setMenuItems([...menuItems]);
        segmentIndices.push(change);
        setSelectedSegmentIndices(segmentIndices);
        if (segmentIndices.length > 1) {
          updateFormatByIndices(segmentIndices.slice(0, -1));
        }
      } else {
        showWarningMessage("选中内容跨越多个分段，无法处理");
      }
    } else {
      showWarningMessage("无选中内容");
    }
  };

  const splitSegmentByFormat = (segmentIndices: number[], format: string, splitLength: number) => {
    const currentSegment = getSegmentByIndices(segmentIndices);
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
    const newHandleSegments: Segment[] = [];
    // 根据拆分后的数量创建子分段
    for (let i = 0; i < numSegments; i++) {
      const start = currentSegment.start + i * splitLength;
      const end = start + splitLength - 1;
      // const subSegmentName = `${currentSegment.name}_${format}_${i + 1}`;
      const newHandleSegment = new Segment(
        `${currentSegment.name}_${format}_${i + 1}`,
        start,
        end,
        currentSegment.belongStruct,
        format,
      );
      newHandleSegments.push(newHandleSegment);
    }
    setMenuItems(replaceSegmentAtIndex(newHandleSegments, segmentIndices));
    setSelectedSegmentIndices([]); // 更新选中分段的索引序列
  };

  const setFormatBySegment = (formatSegment: Segment, targetSegment: Segment) => {
    const location = findIndicesBySegment(targetSegment, menuItems);
    if (targetSegment.format === "struct") {
      formatManager.removeLocationByLabel(targetSegment.displayFormat, location);
      formatManager.addLocationByLabel(targetSegment.displayFormat, location);
    }
    targetSegment.format = formatSegment.format;
    targetSegment.displayFormat = formatSegment.displayFormat;
    targetSegment.subSegments = []; // 清空当前分段的子分段

    const parentStart = targetSegment.start;

    const createSubSegmentRecursively = (
      parent: Segment,
      parentLocation: number[],
      thisIndex: number,
      subSegment: Segment,
    ) => {
      const newStart = parentStart + subSegment.start - formatSegment.start;
      const newEnd = parentStart + subSegment.end - formatSegment.start;
      const thisIndices = [...parentLocation];
      thisIndices.push(thisIndex);
      const belongStruct =
        parent.format === "struct"
          ? parentLocation
          : parent.belongStruct.length > 0
            ? [...parent.belongStruct]
            : [];
      const newSubSegment = new Segment(
        subSegment.name,
        newStart,
        newEnd,
        belongStruct,
        subSegment.displayFormat,
        subSegment.isArrayItem,
      );
      newSubSegment.subSegments = subSegment.subSegments.map((subSeg, index) => {
        return createSubSegmentRecursively(newSubSegment, thisIndices, index, subSeg);
      });

      // 如果新创建的子分段是 struct 类型，更新其下的子分段的 belongStruct
      if (newSubSegment.format === "struct") {
        formatManager.addLocationByLabel(newSubSegment.displayFormat, thisIndices);
      }

      return newSubSegment;
    };

    targetSegment.subSegments = formatSegment.subSegments.map((subSeg, index) => {
      return createSubSegmentRecursively(targetSegment, location, index, subSeg);
    });
  };

  const updateFormatByIndices = (indices: number[]) => {
    const segment = getSegmentByIndices(indices);
    if (segment.belongStruct.length > 0) {
      const changeIndices = [...indices];
      const changeLocation = changeIndices.slice(segment.belongStruct.length);
      formatManager
        .getFormatByLabel(getSegmentByIndices(segment.belongStruct).displayFormat)
        ?.locations.forEach(value => {
          const targetIndices = [...value, ...changeLocation];
          if (areListsNotEqual(targetIndices, changeIndices)) {
            const targetSegment = getSegmentByIndices(targetIndices);
            setFormatBySegment(segment, targetSegment);
          }
        });
    }
  };

  // const exportToFile = () => {
  //   const userFormats = formatManager.getUserFormats();

  //   // 处理 segments 递归函数
  //   const processSegment = (segment: Segment): any => {
  //     if (segment.format === "struct") {
  //       return {
  //         name: segment.name,
  //         format: segment.format,
  //         structLabel: segment.displayFormat,
  //         subSegments: segment.subSegments.map(subSeg => processSegmentName(subSeg)),
  //       };
  //     } else if (segment.format === "array") {
  //       return {
  //         name: segment.name,
  //         format: segment.format,
  //         arrayFormat: segment.arrayFormat,
  //         subSegmentsName: segment.subSegments.map(subSeg => processSegmentName(subSeg)),
  //       };
  //     } else {
  //       return {
  //         name: segment.name,
  //         format: segment.displayFormat,
  //         length: segment.length,
  //         subSegments: segment.subSegments.map(subSeg => processSegment(subSeg)),
  //       };
  //     }
  //   };

  //   // 处理 segments 名称的递归函数
  //   const processSegmentName = (segment: Segment): any => {
  //     return {
  //       name: segment.name,
  //       subSegmentsName: segment.subSegments.map(subSeg => processSegmentName(subSeg)),
  //     };
  //   };

  //   const processedSegments = menuItems.map(item => processSegment(item));

  //   // 处理 userFormats 的 subFormat
  //   const processUserFormatSubSegments = (segment: Segment): any => {
  //     if (segment.format === "struct") {
  //       return {
  //         format: segment.format,
  //         length: segment.length,
  //         structLabel: segment.displayFormat,
  //       };
  //     } else if (segment.format === "array") {
  //       return {
  //         format: segment.format,
  //         arrayFormat: segment.arrayFormat,
  //         arrayLength: segment.subSegments.length,
  //       };
  //     } else if (segment.subSegments.length > 0) {
  //       return {
  //         format: segment.displayFormat,
  //         length: segment.length,
  //         subFormats: segment.subSegments.map(subSeg => processUserFormatSubSegments(subSeg)),
  //       };
  //     } else {
  //       return {
  //         format: segment.displayFormat,
  //         length: segment.length,
  //       };
  //     }
  //   };

  //   const processedUserFormats = userFormats.map(format => {
  //     const correspondingFormat = formatManager.getUserFormatByLabel(format.label);
  //     if (correspondingFormat !== undefined) {
  //       const correspondingSegment = getSegmentByIndices(correspondingFormat.locations[0]);
  //       const subFormat = correspondingSegment
  //         ? processUserFormatSubSegments(correspondingSegment)
  //         : null;
  //       return {
  //         label: format.label,
  //         length: format.minBytes,
  //         locations: format.locations,
  //         subFormat,
  //       };
  //     }
  //     // 假设有个函数可以通过 label 找到对应的 segment
  //   });

  //   // 创建要导出的数据对象
  //   const exportData = {
  //     userFormats: processedUserFormats,
  //     segments: processedSegments,
  //   };

  //   // 序列化为 JSON 字符串
  //   const jsonData = JSON.stringify(exportData, null, 2);

  //   // 创建一个 Blob 对象来保存 JSON 数据
  //   const blob = new Blob([jsonData], { type: "application/json" });

  //   // 创建一个链接元素，用于触发下载
  //   const link = document.createElement("a");
  //   link.href = URL.createObjectURL(blob);
  //   link.download = "formats_and_segments.json";

  //   // 触发下载
  //   link.click();

  //   // 释放 URL 对象
  //   URL.revokeObjectURL(link.href);
  // };

  const exportToFile = () => {
    // 获取用户自定义格式
    const userFormats = formatManager.getUserFormats();

    // 获取分段信息
    const segments = menuItems.map((item, index) => ({
      segment: item,
      indices: [index],
    }));

    // 创建要导出的数据对象
    const exportData = {
      userFormats,
      segments,
    };

    // 序列化为 JSON 字符串
    const jsonData = JSON.stringify(exportData, null, 2);

    // 创建一个 Blob 对象来保存 JSON 数据
    const blob = new Blob([jsonData], { type: "application/json" });

    // 创建一个链接元素，用于触发下载
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "formats_and_segments.json";

    // 触发下载
    link.click();

    // 释放 URL 对象
    URL.revokeObjectURL(link.href);
  };

  const importFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = e.target?.result as string;
        const importData = JSON.parse(json);
        updateFormatsAndSegments(importData);
      } catch (error) {
        console.error("导入文件解析失败:", error);
      }
    };
    reader.readAsText(file);
  };

  const updateFormatsAndSegments = (importData: any) => {
    if (importData.userFormats && Array.isArray(importData.userFormats)) {
      formatManager.resetFormats();
      importData.userFormats.forEach((format: IFormat) => {
        formatManager.addFormat(format);
      });
    }

    if (importData.segments && Array.isArray(importData.segments)) {
      const createSegmentRecursively = (data: any): Segment => {
        const segment = new Segment(
          data.name,
          data.start,
          data.end,
          data.belongStruct,
          data.displayFormat,
          data.isArrayItem,
        );
        segment.setFormat(data.format);

        segment.subSegments = data.subSegments
          ? data.subSegments.map((subData: any) => createSegmentRecursively(subData))
          : [];
        return segment;
      };

      const newSegments = importData.segments.map((item: any) =>
        createSegmentRecursively(item.segment),
      );
      setSelectedSegmentIndices([]);
      setMenuItems(newSegments);
    }
  };

  return (
    <div className={style.segmentMenuContainer}>
      <button onClick={createSubSegment}>创建子分段</button>
      <button onClick={separateSelectedContent}>分隔选中内容</button>
      <button onClick={exportToFile}>导出格式和分段</button>
      <input type="file" accept=".json" onChange={importFromFile} />
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
          getSegmentByIndices={getSegmentByIndices}
          // findIndicesBySegment={findIndicesBySegment}
          setFormatBySegment={setFormatBySegment}
          updateFormatByIndices={updateFormatByIndices}
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
