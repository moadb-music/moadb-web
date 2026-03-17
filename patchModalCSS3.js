const fs = require('fs');
let c = fs.readFileSync('src/App.css', 'utf8');

const oldCSS = `.news-modal{
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

const newCSS = `.news-modal{
  position:relative;
  background:#111;
  border:1px solid rgba(139,0,0,0.25);
  width:92vw;
  max-width:1100px;
  height:min(620px,82vh);
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
  flex:0 0 62%;
  position:relative;
  background:#000;
  overflow:hidden;
}

.news-modal-video iframe{
  position:absolute;
  top:-1px;
  left:-1px;
  width:calc(100% + 2px);
  height:calc(100% + 2px);
  border:none;
  pointer-events:auto;
}

.news-modal-img{
  flex:0 0 62%;
  display:block;
  width:62%;
  height:100%;
  object-fit:cover;
}

.news-modal-body{
  flex:1;
  min-width:0;
  padding:32px 24px 28px;
  display:flex;
  flex-direction:column;
  gap:14px;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:rgba(139,0,0,0.4) transparent;
  border-left:1px solid rgba(139,0,0,0.2);
}

.news-modal-title{
  margin:0;
  font-family:Oswald,sans-serif;
  font-size:clamp(1.1rem,2vw,1.7rem);
  text-transform:uppercase;
  letter-spacing:1px;
  color:#fff;
  padding-right:30px;
}

.news-modal-text{
  color:rgba(255,255,255,0.75);
  line-height:1.75;
  font-size:.9rem;
  margin:0;
}

@media(max-width:650px){
  .news-modal{width:100%;height:auto;max-height:92vh;}
  .news-modal-inner{flex-direction:column;}
  .news-modal-video{flex:none;width:100%;aspect-ratio:16/9;position:relative;}
  .news-modal-img{flex:none;width:100%;height:220px;}
  .news-modal-body{padding:18px 16px 22px;border-left:none;border-top:1px solid rgba(139,0,0,0.2);}
  .news-modal-title{padding-right:0;}
}`;

if (!c.includes(oldCSS)) { console.error('NOT FOUND'); process.exit(1); }
fs.writeFileSync('src/App.css', c.replace(oldCSS, newCSS));
console.log('OK');
