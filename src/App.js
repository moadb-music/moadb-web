import './App.css';

function App() {
  return (
    <div className="app-container">
      <div className="bg-layer" aria-hidden="true" />

      <nav className="top-nav">
        <a className="brand" href="#home">MIND OF A DEAD BODY</a>
        <div className="nav-links">
          <a href="#home">HOME</a>
          <a href="#about">ABOUT</a>
          <a href="#music">MUSIC</a>
          <a href="#contact">CONTACT</a>
        </div>
      </nav>

      <main>
        <section id="home" className="section visible">
          <div className="section-content content-block">
            <h1 className="giant-title">MIND OF A DEAD BODY</h1>
            <p className="muted">Projeto recriado do zero. Edite esta seção.</p>
          </div>
        </section>

        <section id="about" className="section">
          <div className="section-content content-block">
            <h2 className="section-title">ABOUT</h2>
            <p className="muted">Conteúdo em construção.</p>
          </div>
        </section>

        <section id="music" className="section">
          <div className="section-content content-block">
            <h2 className="section-title">MUSIC</h2>
            <p className="muted">Conteúdo em construção.</p>
          </div>
        </section>

        <section id="contact" className="section">
          <div className="section-content content-block">
            <h2 className="section-title">CONTACT</h2>
            <p className="muted">Conteúdo em construção.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>© {new Date().getFullYear()} MIND OF A DEAD BODY</div>
      </footer>
    </div>
  );
}

export default App;
