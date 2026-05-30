import mcpLogo from "@/assets/source-logos/mcp.svg";

interface McpSourceIconProps {
  className?: string;
}

export function McpSourceIcon({ className }: McpSourceIconProps) {
  return (
    <img
      src={mcpLogo}
      alt=""
      aria-hidden="true"
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
