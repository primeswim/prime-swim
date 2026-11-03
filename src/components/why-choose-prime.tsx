import { ChartNoAxesCombined, Target, Trophy, Waves } from "lucide-react";
import styles from "./why-choose-prime.module.css";

const reasons = [
  { icon: Waves, title: "Technique-First Coaching", description: "Strong fundamentals and proper stroke mechanics." },
  { icon: ChartNoAxesCombined, title: "Structured Development", description: "A clear pathway for every swimmer." },
  { icon: Target, title: "Individual Attention", description: "Coaching focused on each swimmer." },
  { icon: Trophy, title: "Competitive Pathway", description: "Preparing athletes for competition." },
];

export default function WhyChoosePrime() {
  return (
    <section className={styles.section} aria-labelledby="why-prime-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <h2 id="why-prime-title">Our Training Approach</h2>
          <p>More Than Swimming. Building Better Athletes.</p>
        </div>
        <div className={styles.grid}>
          {reasons.map(({ icon: Icon, title, description }) => (
            <article className={styles.card} key={title}>
              <div className={styles.icon}><Icon aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
