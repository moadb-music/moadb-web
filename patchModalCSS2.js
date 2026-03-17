const fs = require('fs');
let c = fs.readFileSync('src/App.css', 'utf8');

const oldCSS = `news-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:10000;
  background:rgba(0,0,0,0.88);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  backdrop-filter:blur(6px);
  animation:fadeIn .2s ease;
}

.news-modal{
  position:relative;
  background:#111;
  border:1px solid rgba(139,0,0,0.3);
  width:100%;
  max-width:1100px;
  max-height:90vh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  animation:fadeInDown .2s ease;
}

.news-modal-close{
  position:absolute;
  top:12px;
  right:12px;
  background:rgba(0,0,0,0.7);
  border:none;
  color:#fff;
  font-size:1.6rem;
  width:38px;
  height:38px;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:2;
  border-radius:2px;
}

.news-modal-close:hover{color:var(--red);}

.news-modal-inner{
  display:flex;
  flex-direction:row;
  height:100%;
  max-height:90vh;
  overflow:hidden;
}

.news-modal-video{
  position:relative;
  flex:0 0 60%;
  aspect-ratio:16/9;
  background:#000;
  align-self:center;
}

.news-modal-video iframe{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  border:none;
}

.news-modal-img{
  flex:0 0 60%;
  display:block;
  object-fit:cover;
  max-height:90vh;
}

.news-modal-body{
  flex:1;
  padding:32px 28px 32px;
  display:flex;
  flex-direction:column;
  gap:14px;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:rgba(139,0,0,0.4) transparent;
}

.news-modal-title{
  margin:0;
  font-family:Oswald,sans-serif;
  font-size:clamp(1.3rem,2.5vw,1.9rem);
  text-transform:uppercase;
  letter-spacing:1px;
  color:#fff;
}

.news-modal-text{
  color:rgba(255,255,255,0.8);
  line-height:1.7;
  font-size:.95rem;
  margin:0;
}

@media(max-width:700px){
  .news-modal-inner{flex-direction:column;}
  .news-modal-video,.news-modal-img{flex:none;width:100%;aspect-ratio:16/9;}
  .news-modal-body{padding:20px 16px 24px;}
}`;

const newCSS = `news-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:10000;
  background:rgba(0,0,0,0.88);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  backdrop-filter:blur(6px);
  animation:fadeIn .2s ease;
}

.news-modal{
  position:relative;
  background:#111;
  border:1px solid rgba(139,0,0,0.3);
  width:100%;
  max-width:1000px;
  height:min(600px,85vh);
  overflow:hidden;
  animation:fadeInDown .2s ease;
}

.news-modal-close{
  position:absolute;
  top:10px;
  right:10px;
  background:rgba(0,0,0,0.75);
  border:none;
  color:#fff;
  font-size:1.5rem;
  width:36px;
  height:36px;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:10;
  border-radius:2px;
}

.news-modal-close:hover{color:var(--red);}

.news-modal-inner{
  display:flex;
  flex-direction:row;
  height:100%;
}

.news-modal-video{
  position:relative;
  flex:0 0 58%;
  background:#000;
}

.news-modal-video iframe{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  border:none;
}

.news-modal-img{
  flex:0 0 58%;
  display:block;
  width:58%;
  height:100%;
  object-fit:cover;
}

.news-modal-body{
  flex:1;
  min-width:0;
  padding:28px 24px 28px;
  display:flex;
  flex-direction:column;
  gap:12px;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:rgba(139,0,0,0.4) transparent;
}

.news-modal-title{
  margin:0;
  font-family:Oswald,sans-serif;
  font-size:clamp(1.1rem,2vw,1.6rem);
  text-transform:uppercase;
  letter-spacing:1px;
  color:#fff;
  padding-right:30px;
}

.news-modal-text{
  color:rgba(255,255,255,0.8);
  line-height:1.7;
  font-size:.9rem;
  margin:0;
}

@media(max-width:650px){
  .news-modal{height:auto;max-height:90vh;}
  .news-modal-inner{flex-direction:column;}
  .news-modal-video{flex:none;width:100%;aspect-ratio:16/9;position:relative;}
  .news-modal-img{flex:none;width:100%;height:220px;}
  .news-modal-body{padding:18px 16px 22px;}
  .news-modal-title{padding-right:0;}
}`;

if (!c.includes(oldCSS)) { console.error('NOT FOUND'); process.exit(1); }
fs.writeFileSync('src/App.css', c.replace(oldCSS, newCSS));
console.log('OK');
