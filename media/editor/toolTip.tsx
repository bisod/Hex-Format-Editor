import React, { useEffect, useRef, useState } from "react";
import { useRecoilState } from "recoil";
import { inputModalState } from "./state";
import _style from "./toolTip.css";
import { throwOnUndefinedAccessInDev } from "./util";

const style = throwOnUndefinedAccessInDev(_style);

export interface TooltipProps {
  isVisible: boolean;
  text: string[];
  position: { left: number; top: number };
}

export const ToolTip: React.FC<TooltipProps> = ({ isVisible, text, position }) => {
  return (
    <>
      {isVisible && (
        <div
          className={style.toolTip}
          style={{
            left: position.left + 10,
            top: position.top + 10,
          }}
        >
          {text.map((line, index) => (
            <React.Fragment key={index}>
              <p>{line}</p>
              {index === 0 && text.length > 1 && <hr />}
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};

export interface MenuItem {
  label: string;
  onClick: () => void;
  subItems?: MenuItem[];
}

export interface ContextMenuProps {
  isVisible: boolean;
  items: MenuItem[];
  onClose: () => void;
  position: { left: number; top: number };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  items,
  onClose,
  position,
}) => {
  const [subMenuIndex, setSubMenuIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose]);

  useEffect(() => {
    if (isVisible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const bottomSpace = window.innerHeight - rect.bottom;

      if (bottomSpace < 0) {
        menuRef.current.style.top = `${position.top + bottomSpace}px`;
      }
    }
  }, [isVisible, position]);

  const handleItemClick = (onClick: () => void) => {
    onClick();
    onClose();
  };

  const handleSubMenuClick = (index: number) => {
    setSubMenuIndex(index === subMenuIndex ? null : index);
  };

  return (
    <>
      {isVisible && (
        <div
          ref={menuRef}
          className={style.contextMenu}
          style={{
            left: position.left + 10,
            top: position.top + 10,
          }}
        >
          {items.map((item, index) => (
            <div key={index} style={{ position: "relative" }}>
              <div
                className={style.item}
                onClick={() => {
                  if (item.subItems) {
                    handleSubMenuClick(index);
                  } else {
                    handleItemClick(item.onClick);
                  }
                }}
              >
                {item.label}
              </div>
              {item.subItems && index === subMenuIndex && (
                <div
                  className={style.subItem}
                  style={{
                    left: "100%",
                    top: 0,
                  }}
                >
                  {item.subItems.map((subItem, subIndex) => (
                    <div
                      className={style.item}
                      key={subIndex}
                      onClick={() => handleItemClick(subItem.onClick)}
                    >
                      {subItem.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export const InputModal: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const [modalState, setModalState] = useRecoilState(inputModalState);

  if (!modalState.isVisible) return null;

  const handleSubmit = () => {
    modalState.onSubmit(inputValue);
    setModalState({ isVisible: false, onSubmit: () => {} });
    setInputValue("");
  };

  const handleCancel = () => {
    setModalState({ isVisible: false, onSubmit: () => {} });
    setInputValue("");
  };

  return (
    <div className={style.modal}>
      <div className={style.modalContent}>
        <h3>请输入格式名称：</h3>
        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} />
        <button onClick={handleSubmit}>确认</button>
        <button onClick={handleCancel}>取消</button>
      </div>
    </div>
  );
};
