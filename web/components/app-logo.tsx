import Image from "next/image";

type AppLogoProps = {
  size?: number;
  className?: string;
};

export function AppLogo({ size = 32, className = "" }: AppLogoProps) {
  return (
    <Image
      src="/images/logo.svg"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      priority
      aria-hidden
    />
  );
}
