import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { Range } from "../../shared/util/range"; // 导入Range类
import { DataDisplay } from "./dataDisplay"; // 导入数据展示组件
import _style from "./scrollContainer.css"; // 导入样式
import * as select from "./state"; // 导入状态管理相关的模块
import { throwOnUndefinedAccessInDev } from "./util"; // 导入工具函数
import { VirtualScrollContainer } from "./virtualScrollContainer"; // 导入虚拟滚动容器组件

const style = throwOnUndefinedAccessInDev(_style); // 使用工具函数处理样式

/**
 * "Overscroll" of data that the hex editor will try to load. For example, if
 * this is set to 2, then two additional window heights of data will be loaded
 * before and after the currently displayed data.
 */
const loadThreshold = 0.5; // 加载数据的超滚动量阈值

export const ScrollContainer: React.FC = () => {
  // 定义滚动容器组件
  // 使用Recoil钩子获取全局状态值
  const dimension = useRecoilValue(select.dimensions); // 获取维度信息
  const columnWidth = useRecoilValue(select.columnWidth); // 获取列宽度
  const fileSize = useRecoilValue(select.fileSize); // 获取文件大小
  const { scrollBeyondLastLine } = useRecoilValue(select.codeSettings); // 获取代码设置中的滚动超出最后一行设置
  const [bounds, setBounds] = useRecoilState(select.scrollBounds); // 获取并设置滚动边界
  const [offset, setOffset] = useRecoilState(select.offset); // 获取并设置偏移量
  const previousOffset = useRef<number>(); // 存储前一个偏移量的引用

  const [scrollTop, setScrollTop] = useState(0); // 存储和设置滚动位置的状态

  // 根据新的偏移量扩展滚动边界以确保加载数据时不会出现空白或重叠
  const expandBoundsToContain = useCallback(
    (newOffset: number) => {
      const windowSize = select.getDisplayedBytes(dimension, columnWidth); // 获取窗口大小

      // 扩展滚动边界
      setBounds(old => {
        if (newOffset - old.start < windowSize * loadThreshold && old.start > 0) {
          return new Range(Math.max(0, old.start - windowSize), old.end);
        } else if (old.end - newOffset < windowSize * (1 + loadThreshold)) {
          return new Range(old.start, Math.min(fileSize ?? Infinity, old.end + windowSize));
        } else {
          return old;
        }
      });
    },
    [dimension, columnWidth, fileSize],
  );

  useEffect(() => {
    // 如果前一个偏移量和当前偏移量相同，则不执行任何操作
    if (previousOffset.current === offset) {
      return;
    }

    // 根据当前偏移量扩展滚动边界并设置滚动位置
    expandBoundsToContain(offset);
    setScrollTop(dimension.rowPxHeight * (offset / columnWidth));
  }, [offset]);

  // 如果滚动速度较慢，一个单独的滚动事件可能无法移动到新的偏移量，因此需要存储“未使用”的滚动量
  const accumulatedScroll = useRef(0); // 存储累积的滚动值的引用

  // 处理滚动事件的回调函数
  const onScroll = useCallback(
    (scrollTop: number) => {
      // 在滚动时计算新的偏移量和滚动位置
      scrollTop += accumulatedScroll.current;
      const rowNumber = Math.floor(scrollTop / dimension.rowPxHeight);
      accumulatedScroll.current = scrollTop - rowNumber * dimension.rowPxHeight;
      const newOffset = rowNumber * columnWidth;
      const newScrollTop = rowNumber * dimension.rowPxHeight;
      previousOffset.current = newOffset;
      setOffset(newOffset);
      expandBoundsToContain(newOffset);
      setScrollTop(newScrollTop);
    },
    [dimension, columnWidth, expandBoundsToContain],
  );

  // 如果滚动超出最后一行，添加额外的滚动量
  const extraScroll = scrollBeyondLastLine ? dimension.height / 2 : 0;

  return (
    // 渲染虚拟滚动容器组件，并传入相应的属性和子组件
    <VirtualScrollContainer
      className={style.wrapper}
      scrollTop={scrollTop}
      scrollStart={dimension.rowPxHeight * (bounds.start / columnWidth)}
      scrollEnd={dimension.rowPxHeight * (Math.ceil(bounds.end / columnWidth) + 1) + extraScroll}
      onScroll={onScroll}
    >
      {/* 渲染数据展示组件 */}
      <DataDisplay />
    </VirtualScrollContainer>
  );
};
