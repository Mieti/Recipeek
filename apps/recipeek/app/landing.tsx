import { ArrowUpRight, BookOpen, Camera, ChefHat, Lock, Search } from 'lucide-react';
import './landing.css';

export default function Landing() {
  return (
    <main className="landing landing-notebook">
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="Recipeek, pagina iniziale">recipeek<span>✳</span></a>
        <nav aria-label="Navigazione">
          <a href="#come-funziona">Come funziona</a>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">IL TUO RICETTARIO PERSONALE</p>
          <h1 id="landing-title">Le ricette<br />che vuoi<br /><em>ritrovare.</em></h1>
          <p>Raccogli quelle di famiglia, gli appunti e le idee da provare. Ritrovale quando torni in cucina.</p>
          <a className="button primary" href="/account">Accedi al tuo ricettario<ArrowUpRight size={18} /></a>
          <p className="landing-privacy"><Lock size={16} /><span>Il tuo ricettario è privato. Scegli tu cosa condividere.</span></p>
        </div>

        <div className="landing-notebook-art" aria-hidden="true">
          <div className="landing-paper-shadow" />
          <div className="landing-paper">
            <div className="landing-paper-binding"><i /><i /><i /><i /></div>
            <div className="landing-paper-label"><BookOpen size={19} /><span>RICETTARIO</span></div>
            <div className="landing-paper-title">Il tuo<br />quaderno.</div>
            <div className="landing-paper-rule" />
            <div className="landing-paper-lines"><i /><i /><i /><i /></div>
            <span className="landing-paper-tab">RECIPEEK</span>
          </div>
        </div>
      </section>

      <section className="landing-flow" id="come-funziona" aria-labelledby="landing-flow-title">
        <div className="landing-section-heading">
          <p className="eyebrow">DAL QUADERNO AI FORNELLI</p>
          <h2 id="landing-flow-title">Le tue ricette,<br /><em>pronte quando servono.</em></h2>
        </div>
        <div className="landing-features">
          <article>
            <Camera size={22} strokeWidth={1.6} />
            <span className="eyebrow">01 · IMPORTA</span>
            <h3>Porta le ricette nel tuo quaderno.</h3>
            <p>Parti da un link, una foto o un testo. Rivedi la bozza e salvala.</p>
          </article>
          <article>
            <Search size={22} strokeWidth={1.6} />
            <span className="eyebrow">02 · RITROVA</span>
            <h3>Ogni ricetta al suo posto.</h3>
            <p>Cerca per ingrediente e organizza le ricette nelle tue raccolte.</p>
          </article>
          <article>
            <ChefHat size={22} strokeWidth={1.6} />
            <span className="eyebrow">03 · CUCINA</span>
            <h3>Un passaggio alla volta.</h3>
            <p>Adatta le dosi e segui il procedimento con ingredienti e timer a portata di mano.</p>
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
