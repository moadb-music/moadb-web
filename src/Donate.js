import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import logoPng from "./assets/logo.png";
import pixPng from "./assets/pix.png";
import PixPanel from "./components/PixPanel";
import StripeWidget from "./components/StripeWidget";
import "./App.css";
import "./Donate.css";

function FlagBR(props) {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" {...props}>
      <rect width="28" height="18" fill="#009b3a" />
      <polygon points="14,2 26,9 14,16 2,9" fill="#ffdf00" />
      <circle cx="14" cy="9" r="4" fill="#002776" />
      <path d="M10 8.5c1.8-.8 5.4-.8 8 .1" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function FlagUK(props) {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" {...props}>
      <rect width="28" height="18" fill="#012169" />
      <path d="M0 0L28 18M28 0L0 18" stroke="#fff" strokeWidth="5" />
      <path d="M0 0L28 18M28 0L0 18" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M14 0v18M0 9h28" stroke="#fff" strokeWidth="6" />
      <path d="M14 0v18M0 9h28" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

function formatCurrency(val) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-").map(Number);
  if (!y) return str;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPeriod(start, end, isPt) {
  if (!start && !end) return null;
  const fmt = (s) => {
    if (!s) return "";
    const [y, m] = s.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(isPt ? "pt-BR" : "en-US", { month: "long", year: "numeric" });
  };
  if (start && end) return fmt(start) + " - " + fmt(end);
  if (start) return (isPt ? "A partir de " : "From ") + fmt(start);
  return (isPt ? "Ate " : "Until ") + fmt(end);
}

function applyBg(bg) {
  if (!bg) return {};
  const c01 = (n) => Math.max(0, Math.min(1, parseFloat(n) || 0));
  const aHex = (c, op) =>
    /^#[0-9a-fA-F]{6}$/.test(c)
      ? c + Math.round(c01(op) * 255).toString(16).padStart(2, "0")
      : c || "#000000";
  const gradOn = bg.gradientEnabled !== false;
  const imgOn  = bg.imageEnabled !== false && bg.imageUrl;
  const angle  = Math.max(0, Math.min(360, parseFloat(bg.gradientAngle) || 180));
  const from   = gradOn ? aHex(bg.gradientFrom || "#000000", bg.gradientFromOpacity != null ? bg.gradientFromOpacity : bg.gradientOpacity != null ? bg.gradientOpacity : 1) : "transparent";
  const to     = gradOn ? aHex(bg.gradientTo   || "#000000", bg.gradientToOpacity   != null ? bg.gradientToOpacity   : bg.gradientOpacity != null ? bg.gradientOpacity : 1) : "transparent";
  return {
    "--bg-gradient":      gradOn ? "linear-gradient(" + angle + "deg, " + from + ", " + to + ")" : "none",
    "--bg-image":         imgOn  ? "url('" + bg.imageUrl + "')" : "none",
    "--bg-image-opacity": imgOn  ? c01(bg.imageOpacity != null ? bg.imageOpacity : 0.35) : 0,
  };
}

export default function Donate() {
  const [data,           setData]           = useState(null);
  const [pagesBg,        setPagesBg]        = useState(null);
  const [costsOpen,      setCostsOpen]      = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [lang,           setLang]           = useState("pt-BR");
  const [langOpen,       setLangOpen]       = useState(false);
  const [supportOpen,    setSupportOpen]    = useState(false);
  const [supportClosing, setSupportClosing] = useState(false);
  const [supportView,    setSupportView]    = useState(null);
  const langRef = useRef(null);

  const isPt = lang === "pt-BR";

  const openSupport  = () => { setSupportClosing(false); setSupportOpen(true); };
  const closeSupport = () => {
    setSupportClosing(true);
    setTimeout(() => { setSupportOpen(false); setSupportClosing(false); setSupportView(null); }, 250);
  };
  const toggleSupport = () => { if (supportOpen && !supportClosing) closeSupport(); else openSupport(); };

  useEffect(() => {
    if (!langOpen) return;
    function onDocClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [langOpen]);

  useEffect(() => {
    if (!supportOpen || supportClosing) return;
    function onDocClick(e) {
      if (!e.target.closest(".support-panel") && !e.target.closest(".support-fab") && !e.target.closest(".donate-support-btn")) {
        closeSupport();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportOpen, supportClosing]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteData", "moadb_donate"), (snap) => {
      setData(snap.exists() ? snap.data() : {});
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteData", "moadb_pages"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const content = d && d.content ? d.content : d;
        const bgs = content && content.backgroundsBySection ? content.backgroundsBySection : {};
        setPagesBg(bgs.main || null);
      }
    });
    return unsub;
  }, []);

  const goal      = parseFloat(data && data.goal) || 0;
  const raised    = parseFloat(data && data.raised) || 0;
  const progress  = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
  const title     = (data && (isPt ? data.title : (data.titleEn || data.title))) || (isPt ? "APOIE O PROJETO" : "SUPPORT THE PROJECT");
  const desc      = (data && (isPt ? data.description : (data.descriptionEn || data.description))) || (isPt ? "Cada contribuicao ajuda a manter o projeto vivo." : "Every contribution helps keep the project alive.");
  const donations = Array.isArray(data && data.donations) ? data.donations : [];
  const costs     = Array.isArray(data && data.costs) ? data.costs : [];
  const period    = formatPeriod(data && data.periodStart, data && data.periodEnd, isPt);

  const SupportBtn = () => (
    <button type="button" className="donate-support-btn" onClick={toggleSupport} aria-expanded={supportOpen && !supportClosing}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      {isPt ? "APOIAR O PROJETO" : "SUPPORT THE PROJECT"}
    </button>
  );

  return (
    <div className="app-container donate-page">
      <div className="bg-layer" aria-hidden="true" style={applyBg(pagesBg)} />

      <nav className="top-nav" aria-label={isPt ? "Navegacao" : "Navigation"}>
        <a className="nav-logo-wrap" href="/" aria-label={isPt ? "Voltar ao inicio" : "Back to home"}>
          <img className="nav-logo" src={logoPng} alt="Mind of a Dead Body" />
        </a>

        <div className="nav-links nav-links--desktop">
          <a href="/">{isPt ? "INICIO" : "HOME"}</a>
          <a href="/#sobre">{isPt ? "SOBRE" : "ABOUT"}</a>
          <a href="/#loja">{isPt ? "LOJA" : "STORE"}</a>
          <a href="/#noticias">{isPt ? "NOTICIAS" : "NEWS"}</a>
          <a href="/#discografia">{isPt ? "DISCOGRAFIA" : "DISCOGRAPHY"}</a>
          <a href="/#contato">{isPt ? "CONTATO" : "CONTACT"}</a>
        </div>

        <div className="lang-dropdown lang-dropdown--desktop" ref={langRef}>
          <button
            className="lang-dropdown-toggle"
            type="button"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            onClick={() => setLangOpen((o) => !o)}
          >
            <span className="lang-flag" aria-hidden="true">
              {isPt ? <FlagBR /> : <FlagUK />}
            </span>
            <span className="lang-arrow" aria-hidden="true">v</span>
          </button>
          {langOpen && (
            <ul className="lang-dropdown-menu" role="menu" aria-label={isPt ? "Selecionar idioma" : "Select language"}>
              <li>
                <button type="button" className={"lang-dropdown-item" + (isPt ? " active" : "")} role="menuitem"
                  onClick={() => { setLang("pt-BR"); setLangOpen(false); }}>
                  <span className="lang-flag" aria-hidden="true"><FlagBR /></span>
                  <span>Portugues</span>
                </button>
              </li>
              <li>
                <button type="button" className={"lang-dropdown-item" + (!isPt ? " active" : "")} role="menuitem"
                  onClick={() => { setLang("en"); setLangOpen(false); }}>
                  <span className="lang-flag" aria-hidden="true"><FlagUK /></span>
                  <span>English</span>
                </button>
              </li>
            </ul>
          )}
        </div>

        <button
          className={"nav-hamburger" + (menuOpen ? " is-open" : "")}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>

        {menuOpen && (
          <div className="nav-mobile-menu" style={{ display: "flex" }} onClick={() => setMenuOpen(false)}>
            <a href="/">{isPt ? "INICIO" : "HOME"}</a>
            <a href="/#sobre">{isPt ? "SOBRE" : "ABOUT"}</a>
            <a href="/#loja">{isPt ? "LOJA" : "STORE"}</a>
            <a href="/#noticias">{isPt ? "NOTICIAS" : "NEWS"}</a>
            <a href="/#discografia">{isPt ? "DISCOGRAFIA" : "DISCOGRAPHY"}</a>
            <a href="/#contato">{isPt ? "CONTATO" : "CONTACT"}</a>
            <div className="nav-mobile-lang" onClick={(e) => e.stopPropagation()}>
              <button type="button" className={"nav-mobile-lang-btn" + (isPt ? " active" : "")}
                onClick={() => { setLang("pt-BR"); setMenuOpen(false); }}>
                <span className="lang-flag"><FlagBR /></span> PT
              </button>
              <button type="button" className={"nav-mobile-lang-btn" + (!isPt ? " active" : "")}
                onClick={() => { setLang("en"); setMenuOpen(false); }}>
                <span className="lang-flag"><FlagUK /></span> EN
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="donate-main">
        <div className="donate-hero">
          <h1 className="donate-hero-title">{title}</h1>
          {period && <p className="donate-hero-period">{period}</p>}
          <p className="donate-hero-desc">{desc}</p>
        </div>

        {goal > 0 ? (
          <div className="donate-goal-card">
            <div className="donate-goal-labels">
              <span className="donate-goal-raised">{formatCurrency(raised)}</span>
              <span className="donate-goal-target">{isPt ? "meta mensal:" : "monthly goal:"} {formatCurrency(goal)}</span>
            </div>
            <div className="donate-progress-track">
              <div className="donate-progress-fill" style={{ width: progress + "%" }} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} />
            </div>
            <p className="donate-goal-pct">{Math.round(progress)}% {isPt ? "da meta atingida" : "of goal reached"}</p>

            {costs.length > 0 && (
              <div className="donate-costs">
                {costsOpen && (
                  <ul className="donate-costs-list">
                    {costs.map((c, i) => (
                      <li key={i} className="donate-costs-item">
                        <span className="donate-costs-label">{c.label}</span>
                        <span className="donate-costs-amount">{formatCurrency(c.amount)}</span>
                      </li>
                    ))}
                    <li className="donate-costs-item donate-costs-total">
                      <span className="donate-costs-label">{isPt ? "Total mensal" : "Monthly total"}</span>
                      <span className="donate-costs-amount">{formatCurrency(goal)}</span>
                    </li>
                  </ul>
                )}
                <button type="button" className="donate-costs-toggle" onClick={() => setCostsOpen((o) => !o)} aria-expanded={costsOpen}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ transform: costsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
                  <span>{costsOpen ? (isPt ? "Ocultar detalhes" : "Hide details") : (isPt ? "Ver detalhes dos custos" : "View cost details")}</span>
                </button>
              </div>
            )}

            <div className="donate-goal-cta">
              <SupportBtn />
            </div>
          </div>
        ) : (
          <div className="donate-goal-cta donate-goal-cta--standalone">
            <SupportBtn />
          </div>
        )}

        {donations.length > 0 && (
          <div className="donate-list-card">
            <h2 className="donate-list-title">{isPt ? "Contribuicoes recentes" : "Recent contributions"}</h2>
            <ul className="donate-list">
              {donations.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20).map((d, i) => (
                <li key={i} className="donate-list-item">
                  <div className="donate-list-left">
                    <span className="donate-list-name">{d.name || (isPt ? "Anonimo" : "Anonymous")}</span>
                    {d.message && <span className="donate-list-msg">"{d.message}"</span>}
                  </div>
                  <div className="donate-list-right">
                    <span className="donate-list-amount">{formatCurrency(d.amount)}</span>
                    <span className="donate-list-date">{formatDate(d.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <div className="support-float">
        {supportOpen && (
          <div className={"support-panel" + (supportClosing ? " support-panel--out" : "") + (supportView === "stripe" ? " support-panel--wide" : "")}>
            {supportView === null && (
              <>
                <div className="support-panel-title">{isPt ? "APOIE O PROJETO" : "SUPPORT THE PROJECT"}</div>
                <button className="support-opt support-opt--pix" onClick={() => setSupportView("pix")}>
                  <img className="contact-pix-icon" src={pixPng} alt="" aria-hidden="true" />
                  PIX
                </button>
                <button className="support-opt support-opt--stripe" onClick={() => setSupportView("stripe")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                  {isPt ? "CARTAO & OUTROS" : "CARD & MORE"}
                </button>
                <a className="support-opt support-opt--bmc" href="#" onClick={(e) => { e.preventDefault(); const btn = document.querySelector("#bmc-wbtn"); if (btn) { btn.style.pointerEvents = "auto"; btn.click(); btn.style.pointerEvents = "none"; } }}>
                  <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" width="20" height="20" />
                  BUY ME A COFFEE
                </a>
              </>
            )}
            {supportView === "pix" && (
              <PixPanel isPt={isPt} onBack={() => setSupportView(null)} onClose={closeSupport} />
            )}
            {supportView === "stripe" && (
              <>
                <button className="support-back" onClick={() => setSupportView(null)} aria-label={isPt ? "Voltar" : "Back"}>&#8249;</button>
                <button className="support-close" onClick={closeSupport} aria-label={isPt ? "Fechar" : "Close"}>&#x2715;</button>
                <div className="support-panel-title">{isPt ? "CARTAO & OUTROS" : "CARD & MORE"}</div>
                <StripeWidget onBack={() => setSupportView(null)} />
              </>
            )}
          </div>
        )}
        <button className="support-fab" onClick={toggleSupport} aria-label={isPt ? "Apoiar o projeto" : "Support the project"} aria-expanded={supportOpen && !supportClosing}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>
    </div>
  );
}