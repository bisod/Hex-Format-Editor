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
