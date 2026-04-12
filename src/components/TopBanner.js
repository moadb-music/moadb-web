import { useEffect, useState } from 'react';

const BANNER_H = 28; // px — altura da faixa

/**
 * TopBanner — faixa fina acima do nav com link para o site guarda-chuva.
 * Atualiza --header-h no :root para que o drawer mobile se posicione corretamente.
 * Props:
 *   lang  {string}  'pt-BR' | 'en'
 */
export default function TopBanner({ lang }) {
  const [dismissed, setDismissed] = useState(false);

  // Atualiza a variável CSS conforme o banner aparece/some
  useEffect(() => {
    const navH = 52; // altura aproximada do nav
    document.documentElement.style.setProperty(
      '--header-h',
      `${navH + (dismissed ? 0 : BANNER_H)}px`
    );
  }, [dismissed]);

  if (dismissed) return null;

  const isPt = String(lang || '').toLowerCase().startsWith('pt');

  return (
    <div className="top-banner">
      <a
        className="top-banner-link"
        href="https://mindplacemusic.com.br"
        target="_blank"
        rel="noreferrer"
      >
        {isPt
          ? <>Um projeto de <strong>mindplacemusic.com.br</strong> →</>
          : <>A project by <strong>mindplacemusic.com.br</strong> →</>
        }
      </a>
      <button
        className="top-banner-close"
        type="button"
        aria-label={isPt ? 'Fechar aviso' : 'Dismiss'}
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
