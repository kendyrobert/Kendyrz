const PROJECT='kendy-57bcd',KEY='AIzaSyAWr9YM0YAG0mx0SEk3qNEhjeS1MOu_2lg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sz=n=>{n=+n||0;const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++}return (i?n.toFixed(1):n)+' '+u[i]};

module.exports=async(req,res)=>{
  const id=String(req.query.id||'').replace(/[^\w-]/g,'').slice(0,60);
  const host=req.headers['x-forwarded-host']||req.headers.host,origin='https://'+host;
  let ok=false,name='',size='',img='https://i.imgur.com/jq0k7Hj.png';
  try{
    const r=await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shares/${id}?key=${KEY}`);
    if(r.ok){
      const f=(await r.json()).fields||{};
      if(f.active&&f.active.booleanValue){
        ok=true;
        name=(f.name&&f.name.stringValue)||'Archivo';
        size=sz(f.size&&(f.size.integerValue||f.size.doubleValue));
        const u=f.url&&f.url.stringValue;
        if(u&&u.includes('/upload/')&&/\.(jpe?g|png|gif|webp)$/i.test(name))img=u.replace('/upload/','/upload/c_fill,w_1200,h_630,q_auto,f_jpg/');
      }
    }
  }catch(e){}
  const title=ok?`${name} · Storcloud`:'Storcloud · Almacenamiento de archivos en la nube';
  const desc=ok?`Archivo compartido en Storcloud · ${size}. Toca para verlo o descargarlo.`:'Guarda, organiza y comparte tus archivos desde cualquier lugar.';
  const url=`${origin}/s/${id}`,to=`/#/s/${id}`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Storcloud"><meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="https://i.imgur.com/jq0k7Hj.png"><meta http-equiv="refresh" content="0;url=${to}">
<script>location.replace(${JSON.stringify(to)})</script></head><body></body></html>`);
};
        
