import { ArrowUpRight, Lock } from 'lucide-react';
import LandingAuth from './landing-auth';
import './landing.css';

export default function Landing() {
  return (
    <main className="landing landing-notebook">
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="Recipeek, pagina iniziale">recipeek<span>✳</span></a>
        <nav aria-label="Navigazione">
          <a className="landing-nav-how" href="#come-funziona">Come funziona</a>
          <a className="landing-nav-login" href="#landing-login">Accedi<ArrowUpRight size={16} /></a>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">IL TUO RICETTARIO PERSONALE</p>
          <h1 id="landing-title">Il tuo ricettario,<br /><em>sempre con te.</em></h1>
          <p>Raccogli le ricette che ami. Ritrovale quando cucini.</p>
          <p className="landing-privacy"><Lock size={16} /><span>Le tue ricette restano private finché decidi di condividerle.</span></p>
        </div>

        <div className="landing-auth-wrap" id="landing-login">
          <LandingAuth />
        </div>
      </section>

      <section className="landing-flow" id="come-funziona" aria-labelledby="landing-flow-title">
        <div className="landing-section-heading">
          <p className="eyebrow">DAL LINK AI FORNELLI</p>
          <h2 id="landing-flow-title">Il tuo quaderno, <em>pronto in cucina.</em></h2>
        </div>
        <div className="landing-features">
          <article>
            <span className="landing-feature-number">01</span>
            <h3>Raccogli</h3>
            <p>Conserva ricette, foto e appunti in un unico posto.</p>
          </article>
          <article>
            <span className="landing-feature-number">02</span>
            <h3>Organizza</h3>
            <p>Cerca per ingrediente e crea le tue raccolte.</p>
          </article>
          <article>
            <span className="landing-feature-number">03</span>
            <h3>Cucina</h3>
            <p>Adatta le dosi e segui ogni passaggio con calma.</p>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="brand" href="/" aria-label="Recipeek, pagina iniziale">recipeek<span>✳</span></a>
        <p>Una ricetta alla volta.</p>
      </footer>
    </main>
  );
}
