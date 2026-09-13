import Link from "next/link";
import "./brand.css";

const SRC = "/brand/veriaudit-logo.png";
const ALT = "VeriAudit. Trust every audit.";

export function BrandMark({
  variant = "nav",
  href,
}: {
  variant?: "hero" | "nav" | "compact";
  href?: string;
}) {
  const image = (
    <img
      src={SRC}
      alt={ALT}
      width={1983}
      height={793}
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
