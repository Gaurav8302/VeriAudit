import Image from "next/image";
import Link from "next/link";
import "./brand.css";

const SRC = "/brand/veriaudit-logo.png?v=20260914";
const ALT = "VeriAudit. Trust every audit.";

// The source asset is 1983x793. Nav renders it ~76px wide and the hero caps at
// 24rem, so the optimiser is told the real display widths rather than shipping
// the full 852 KB original on every page.
const SIZES = {
  hero: "384px",
  nav: "120px",
  compact: "96px",
} as const;

export function BrandMark({
  variant = "nav",
  href,
}: {
  variant?: "hero" | "nav" | "compact";
  href?: string;
}) {
  const image = (
    <Image
      src={SRC}
      alt={ALT}
      width={1983}
      height={793}
      sizes={SIZES[variant]}
      priority
      className={`brand-mark brand-mark-${variant}`}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="brand-mark-link" aria-label="VeriAudit home">
      {image}
    </Link>
  );
}
