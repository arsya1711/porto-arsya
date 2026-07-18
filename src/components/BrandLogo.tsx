import type { ImgHTMLAttributes } from "react";

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src">;

export function BrandLogo({ alt = "AwExam", ...props }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} {...props} />;
}
