import type { ImgHTMLAttributes } from "react";

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src">;

export function BrandLogo({ alt = "AWExam", className, ...props }: BrandLogoProps) {
  return (
    <img
      src="/logo-white.png"
      alt={alt}
      className={["brand-logo-mark", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
