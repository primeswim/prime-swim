import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import HeroWater from "./hero-water";
import TryoutLink from "./tryout-link";
import styles from "./home-hero.module.css";

export default function HomeHero() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <Image
          src="/images/hero-butterfly-v2.jpg"
          alt="Female swimmer performing butterfly in a white Prime Swim cap"
          width={1672}
          height={941}
          priority
          sizes="100vw"
          className={styles.photo}
        />
        <HeroWater />
        <div className={styles.shade} aria-hidden="true" />
        <div className={`container mx-auto px-4 ${styles.content}`}>
          <span className={styles.eyebrow}>Prime Swim Academy</span>
          <h1 id="home-hero-title">Better Technique.<br />Stronger Swimmers.</h1>
          <p>Structured coaching. Individual development.<br />A pathway to competitive swimming.</p>
          <div className={styles.actions}>
            <TryoutLink />
            <a className={styles.programs} href="#programs">Explore Programs <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
        <svg className={styles.wave} viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path fill="#087ac0" d="M0 80C200-8 340 116 700 94S1190 8 1440 0V120H0Z" />
          <path fill="#19bce9" d="M0 100C230 22 390 130 760 100S1210 15 1440 18V120H0Z" />
          <path fill="#c4edff" d="M0 107C240 42 370 138 780 110S1220 28 1440 30V120H0Z" />
          <path fill="#ffffff" d="M0 111C240 46 400 136 800 115S1230 47 1440 48V120H0Z" />
        </svg>
      </section>
      <ul className={styles.benefits} aria-label="Prime Swim club affiliations">
        <li><a href="https://www.usaswimming.org/" target="_blank" rel="noopener noreferrer"><Trophy className={styles.benefitIcon} aria-hidden="true" /><span>USA Swimming<br />Club</span></a></li>
        <li><a href="https://www.pns.org/" target="_blank" rel="noopener noreferrer"><Image src="/images/pns-logo.JPG" alt="Pacific Northwest Swimming" width={76} height={56} className={styles.benefitLogo} /><span>PNS<br />Member</span></a></li>
      </ul>
    </>
  );
}
