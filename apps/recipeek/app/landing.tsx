import {ArrowUpRight,BookOpen,Camera,ChefHat,Check,Lock} from 'lucide-react';

export default function Landing(){
  return <main className="landing">
    <header className="landing-nav"><a className="brand" href="/" aria-label="Recipeek, pagina iniziale">recipeek<span>✳</span></a><nav aria-label="Navigazione"><a className="landing-how-link" href="#come-funziona">Come funziona</a><a className="button primary" href="/account">Accedi<ArrowUpRight size={16}/></a></nav></header>
    <section className="landing-hero">
      <div className="landing-copy"><p className="eyebrow">PICCOLI RITUALI, GRANDI SAPORI</p><h1>Le ricette che ami.<br/>Un posto dove<br/><em>ritrovarle.</em></h1><p>Il piatto di famiglia, l’idea da provare, quella cena riuscita bene. Raccogli le tue ricette e portale con te, dal primo ingrediente all’ultimo assaggio.</p><a className="button primary" href="/account">Entra nella tua cucina<ArrowUpRight size={18}/></a><span className="landing-login-note">Accedi con Google oppure con email e password.</span><div className="landing-privacy"><Lock size={15}/><span>Il tuo ricettario è privato. Scegli tu cosa condividere.</span></div></div>
      <div className="landing-visual"><img src="/images/pasta.jpg" alt="Pasta con pomodorini e verdure" fetchPriority="high"/><span className="landing-photo-caption">L’ispirazione di oggi</span><div className="landing-recipe-note"><span className="eyebrow">DA PROVARE, POI DA RIFARE</span><h2>Pasta, pomodorini<br/>e un po’ di fantasia.</h2><span>Un’idea semplice per la tua cucina.</span></div><span className="landing-star" aria-hidden="true">✳</span></div>
    </section>
    <section className="landing-flow" id="come-funziona"><div className="landing-section-heading"><p className="eyebrow">DAL QUADERNO AI FORNELLI</p><h2>Meno ricette sparse.<br/><em>Più voglia di cucinare.</em></h2></div><div className="landing-features">
      <article><Camera size={24} strokeWidth={1.4}/><span className="eyebrow">01 · RACCOGLI</span><h3>Un ricettario che ti somiglia.</h3><p>Scrivi ingredienti e procedimento, aggiungi le tue foto e conserva il link o il riferimento alla fonte.</p></article>
      <article><BookOpen size={24} strokeWidth={1.4}/><span className="eyebrow">02 · RITROVA</span><h3>Quella ricetta, proprio quella.</h3><p>Cerca per ingrediente, organizza le raccolte e ritrova le preferite. Anche quando hai poco tempo.</p></article>
      <article><ChefHat size={24} strokeWidth={1.4}/><span className="eyebrow">03 · CUCINA</span><h3>Un passaggio alla volta.</h3><p>Adatta le dosi alle persone o alla teglia. Poi entra in modalità cooking: un procedimento alla volta, con ingredienti e timer a portata di mano.</p></article>
    </div></section>
    <section className="landing-invite"><div><p className="eyebrow">LA TUA PROSSIMA RICETTA PARTE DA QUI</p><h2>Le cose buone<br/><em>si tengono vicine.</em></h2></div><div><p>Uno spazio personale da aprire sul telefono, sul tablet o sul computer. Le tue ricette restano tue.</p><a className="button primary" href="/account">Comincia con Recipeek<ArrowUpRight size={18}/></a><span className="landing-small"><Check size={14}/>Per creare un nuovo account puoi usare Google.</span></div></section>
    <footer className="landing-footer"><a className="brand" href="/">recipeek<span>✳</span></a><p>Una ricetta alla volta. Un po’ più tua.</p><a href="/account">Accedi al tuo ricettario<ArrowUpRight size={14}/></a></footer>
  </main>;
}
