import React from "react";

export interface TooltipProps {
  isVisible: boolean;
  text: string;
  position: { left: number; top: number };
}

export const ToolTip: React.FC<TooltipProps> = ({ isVisible, text, position }) => {
  return (
    <>
      {isVisible && (
        <div
          style={{
            position: "absolute",
            left: position.left,
            top: position.top,
            background: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            zIndex: 9999,
          }}
        >
          {text}
        </div>
      )}
    </>
  );
};

export interface ContextMenuProps {
  isVisible: boolean;
  items: { label: string; onClick: () => void }[];
  onClose: () => void;
  position: { left: number; top: number };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  items,
  onClose,
  position,
}) => {
  const handleItemClick = (onClick: () => void) => {
    onClick();
    onClose();
  };

  return (
    <>
      {isVisible && (
        <div
          style={{
            position: "absolute",
            left: position.left,
            top: position.top,
            background: "#fff",
            boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)",
            borderRadius: "4px",
            zIndex: 9999,
          }}
        >
          {items.map((item, index) => (
            <div
              key={index}
              onClick={() => handleItemClick(item.onClick)}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
