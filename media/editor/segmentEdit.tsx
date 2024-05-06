import React, { useState } from "react";
import _style from "./segmentEdit.css";
import { Segment } from "./segmentMenu";
import { throwOnUndefinedAccessInDev } from "./util";
const style = throwOnUndefinedAccessInDev(_style);

export const SegmentEdit: React.FC<{ segment: Segment; onClose: () => void }> = ({
  segment,
  onClose,
}) => {
  const [name, setName] = useState(segment.name);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 在这里执行更新分段名称的逻辑，例如调用一个函数来更新分段名称
    // updateSegmentName(segment.id, name);
    onClose(); // 关闭编辑框
  };

  return (
    <div className={style.segmentEdit}>
      <form onSubmit={handleSubmit}>
        <input type="text" value={name} onChange={handleChange} />
        <button type="submit">保存</button>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </form>
    </div>
  );
};
