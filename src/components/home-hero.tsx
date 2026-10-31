import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home-hero.module.css";

export default function HomeHero() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <Image
          src="/images/hero-butterfly-v2.jpg"
          alt="Female swimmer performing butterfly in a white Prime Swim cap"
          fill
          priority
          sizes="100vw"
          className={styles.photo}
        />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.content}>
          <span className={styles.eyebrow}>Prime Swim Academy</span>
          <h1 id="home-hero-title">Better Technique.<br />Stronger Swimmers.</h1>
          <p>Structured coaching. Individual development.<br />A pathway to competitive swimming.</p>
          <div className={styles.actions}>
            <Link className={styles.tryout} href="/tryout">Schedule a Tryout <ArrowRight aria-hidden="true" /></Link>
            <a className={styles.programs} href="#programs">Explore Programs <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>
      <div className={styles.affiliations} aria-label="Club affiliations and team store">
        <a href="https://www.usaswimming.org/" target="_blank" rel="noopener noreferrer">
          <span className={styles.affiliationName}>USA Swimming</span>
          <span className={styles.affiliationDetail}>Member Club</span>
        </a>
        <a href="https://www.pns.org/" target="_blank" rel="noopener noreferrer">
          <span className={styles.affiliationName}>Pacific Northwest Swimming</span>
          <span className={styles.affiliationDetail}>PNS</span>
        </a>
        <a href="https://www.swimoutlet.com/collections/psa" target="_blank" rel="noopener noreferrer">
          <span className={styles.affiliationName}>SwimOutlet</span>
          <span className={styles.affiliationDetail}>Team Store</span>
        </a>
      </div>
    </>
  );
}
