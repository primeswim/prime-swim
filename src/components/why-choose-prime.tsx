import styles from "./why-choose-prime.module.css";

const reasons = [
  { icon: "🏊", title: "Technique-First Coaching", description: "Strong fundamentals and proper stroke mechanics." },
  { icon: "📈", title: "Structured Development", description: "A clear pathway for every swimmer." },
  { icon: "🎯", title: "Individual Attention", description: "Coaching focused on each swimmer." },
  { icon: "🏆", title: "Competitive Pathway", description: "Preparing athletes for competition." },
];

export default function WhyChoosePrime() {
  return (
    <section className={styles.section} aria-labelledby="why-prime-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <h2 id="why-prime-title">Why Choose Prime Swim Academy?</h2>
          <p>More Than Swimming. Building Better Athletes.</p>
        </div>
        <div className={styles.grid}>
          {reasons.map(({ icon, title, description }) => (
            <article className={styles.card} key={title}>
              <div className={styles.icon} aria-hidden="true">{icon}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
