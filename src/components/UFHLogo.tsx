import React from "react";

interface UFHLogoProps {
  className?: string;
}

export const UFHLogo = ({ className = "w-8 h-8" }: UFHLogoProps) => (
  <img src="/FHLogo.png" alt="UFH Logo" className={`${className} object-contain`} />
);

export default UFHLogo;