import React from "react";

interface CameraSwitchIconProps {
  className?: string;
}

export const CameraSwitchIcon: React.FC<CameraSwitchIconProps> = ({
  className,
}) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zM9 4h6l1.17 2H20v12H4V7h3.83L9 4z"
        fill="currentColor"
      />
      <path d="M15 11V8l4 4-4 4v-3H9v3l-4-4 4-4v3h6z" fill="currentColor" />
    </svg>
  );
};

export default CameraSwitchIcon;
