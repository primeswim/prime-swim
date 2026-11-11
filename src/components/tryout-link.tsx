import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./tryout-link.module.css";

export default function TryoutLink({ className, onClick }: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link href="/tryout" prefetch={false} className={className ? `${styles.link} ${className}` : styles.link} onClick={onClick}>
      Schedule a Tryout <ArrowRight aria-hidden="true" />
    </Link>
  );
}
