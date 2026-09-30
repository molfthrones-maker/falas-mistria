const OWNER='molfthrones-maker',REPO='falas-mistria',BRANCH='main';
const API='https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents';
let edits=JSON.parse(localStorage.getItem('fom_edits_v1')||'{}');
let groups=[]; let currentId=null; let season='todas'; let context=null; let q=''; let modalMode='ok';
window.FOM_ITEMS=window.FOM_ITEMS||{};
function token(){return localStorage.getItem('fom_gh_token')||''}
function setToken(t){localStorage.setItem('fom_gh_token',t.trim())}
function saveLocal(){localStorage.setItem('fom_edits_v1',JSON.stringify(edits));document.getElementById('count').textContent=Object.keys(edits).length+' alteradas'}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]})}
function pretty(s){return String(s||'').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase()})}
function showModal(t,b,m){modalMode=m||'ok';document.getElementById('modalTitle').textContent=t;document.getElementById('modalBody').textContent=b;document.getElementById('tokenBox').classList.toggle('hidden',modalMode!=='token');if(modalMode==='token')document.getElementById('tokenInput').value=token();document.getElementById('modal').classList.remove('hidden')}
function hideModal(){document.getElementById('modal').classList.add('hidden')}
async function ghH(){var t=token();if(!t)throw new Error('NO_TOKEN');return{Authorization:'Bearer '+t,Accept:'application/vnd.github+json'}}
async function ghGet(path){var r=await fetch(API+'/'+path+'?ref=main',{headers:await ghH()});if(r.status===404)return null;if(!r.ok)throw new Error('GET '+r.status);return r.json()}
async function ghPut(path,text,message){var ex=await ghGet(path);var body={message:message,content:btoa(unescape(encodeURIComponent(text))),branch:'main'};if(ex&&ex.sha)body.sha=ex.sha;var r=await fetch(API+'/'+path,{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},await ghH()),body:JSON.stringify(body)});if(!r.ok)throw new Error('PUT '+r.status);return r.json()}
function seasonOf(k){var s=k.toLowerCase();
if(/spring|primavera/.test(s))return 'primavera';
if(/summer|verao|verão/.test(s))return 'verao';
if(/\bfall\b|autumn|harvest|outono/.test(s))return 'outono';
if(/winter|inverno/.test(s))return 'inverno';
if(/festival/.test(s))return 'festival';
return 'geral';}
function parseLine(it){
  var p=it.k.split('/');
  var prompt=-1, node='init';
  if(p[p.length-2]==='prompts'){prompt=parseInt(p[p.length-1],10);p=p.slice(0,-2);}
  node=p[p.length-1]; p=p.slice(0,-1);
  var conv=p[p.length-1]||'conversa';
  var cat=p[3]||'Linhas';
  var ctx;
  if(p[4]==='Marriage'||p[4]==='Relationship') ctx=(p[5]||p[4]);
  else ctx=p[4]||cat;
  return {it:it,cat:cat,ctx:ctx,conv:conv,node:node,prompt:prompt,season:seasonOf(it.k+' '+ctx+' '+conv)};
}
function nodeOrd(n){if(n==='init')return 0; var x=parseInt(n,10); return isNaN(x)?100+n.charCodeAt(0):1+x;}
function grouped(items){
  return items.map(parseLine).sort(function(a,b){
    return a.cat.localeCompare(b.cat)||a.ctx.localeCompare(b.ctx)||a.conv.localeCompare(b.conv)||nodeOrd(a.node)-nodeOrd(b.node)||a.prompt-b.prompt;
  });
}
function currentItems(){return window.FOM_ITEMS[currentId]||[]}
function buildNav(f){
  var nav=document.getElementById('nav'); nav.innerHTML='';
  var by={};
  groups.forEach(function(m){if(f&&!(m.s+' '+m.n).toLowerCase().includes(f.toLowerCase()))return;(by[m.s]=by[m.s]||[]).push(m)});
  Object.keys(by).forEach(function(sec){
    var h=document.createElement('div'); h.className='sec'; h.textContent=sec; nav.appendChild(h);
    by[sec].forEach(function(m){
      var el=document.createElement('div');
      el.className='nav-item'+(m.i===currentId?' active':'');
      el.innerHTML='<span>'+esc(m.n)+'</span><span class="n">'+m.c+'</span>';
      el.onclick=function(){loadGroup(m.i)};
      nav.appendChild(el);
    });
  });
}
function seasonChips(parsed){
  var counts={todas:parsed.length,geral:0,primavera:0,verao:0,outono:0,inverno:0,festival:0};
  parsed.forEach(function(x){counts[x.season]=(counts[x.season]||0)+1});
  var labels={todas:'Todas',geral:'Geral',primavera:'Primavera',verao:'Verão',outono:'Outono',inverno:'Inverno',festival:'Festival'};
  var box=document.getElementById('seasons'); box.innerHTML='';
  ['todas','geral','primavera','verao','outono','inverno','festival'].forEach(function(id){
    if(id!=='todas' && !counts[id]) return;
    var b=document.createElement('button');
    b.type='button'; b.className='chip'+(season===id?' on':'');
    b.textContent=labels[id]+' '+counts[id];
    b.onclick=function(){season=id; context=null; renderAll()};
    box.appendChild(b);
  });
}
function contextList(parsed){
  var box=document.getElementById('contexts'); box.innerHTML='';
  var by={};
  parsed.forEach(function(x){
    if(season!=='todas' && x.season!==season) return;
    by[x.ctx]=(by[x.ctx]||0)+1;
  });
  var keys=Object.keys(by).sort();
  if(!keys.length){box.innerHTML='<span class="hint">Nenhum contexto nesta estação.</span>'; return parsed;}
  if(!context || !by[context]) context=keys[0];
  keys.forEach(function(k){
    var b=document.createElement('button');
    b.type='button'; b.className='chip ctx'+(context===k?' on':'');
    b.textContent=pretty(k)+' '+by[k];
    b.onclick=function(){context=k; renderAll()};
    box.appendChild(b);
  });
  return parsed;
}
function renderConvs(parsed){
  var list=document.getElementById('list');
  var qn=q.trim().toLowerCase();
  var convs={};
  parsed.forEach(function(x){
    if(season!=='todas' && x.season!==season) return;
    if(context && x.ctx!==context) return;
    if(qn && !(x.it.o+' '+x.it.k+' '+(edits[x.it.k]||'')).toLowerCase().includes(qn)) return;
    var id=x.cat+'/'+x.ctx+'/'+x.conv;
    (convs[id]=convs[id]||[]).push(x);
  });
  var ids=Object.keys(convs);
  if(!ids.length){list.innerHTML='<p class="empty">Nada neste recorte. Se for personagem sem data.bin, o texto ainda não está no repo.</p>'; return;}
  list.innerHTML=ids.map(function(id){
    var lines=convs[id];
    var head=pretty(lines[0].conv)+' · '+pretty(lines[0].cat);
    var body=lines.map(function(x){
      var dirty=Object.prototype.hasOwnProperty.call(edits,x.it.k);
      var val=dirty?edits[x.it.k]:x.it.o;
      var who=x.prompt>=0?'você':'npc';
      var tag=x.prompt>=0?'resposta':'fala';
      var lab=x.prompt>=0?('Sua resposta '+(x.prompt+1)):('Fala '+(x.node==='init'?'inicial':x.node));
      return '<div class="line '+who+(dirty?' dirty':'')+'">'
        +'<div class="row-top"><span class="tag '+tag+'">'+lab+'</span></div>'
        +'<div class="orig">'+esc(x.it.o)+'</div>'
        +'<textarea class="novo" data-key="'+esc(x.it.k)+'">'+esc(val)+'</textarea></div>';
    }).join('');
    return '<article class="conv"><h3>'+esc(head)+'</h3>'+body+'</article>';
  }).join('');
}
function renderAll(){
  var parsed=grouped(currentItems());
  seasonChips(parsed);
  contextList(parsed);
  renderConvs(parsed);
  var meta=groups.find(function(x){return x.i===currentId});
  document.getElementById('title').textContent=meta?meta.n:'—';
  document.getElementById('meta').textContent=currentItems().length+' linhas neste personagem';
}
function loadGroup(id){
  currentId=id; season='todas'; context=null;
  buildNav(document.getElementById('navFilter').value);
  renderAll();
}
function onInput(e){
  var ta=e.target.closest('textarea.novo'); if(!ta) return;
  var k=ta.getAttribute('data-key');
  var orig=(currentItems().find(function(x){return x.k===k})||{}).o;
  if(ta.value===orig) delete edits[k]; else edits[k]=ta.value;
  saveLocal();
}
async function needToken(){if(token())return true;showModal('Token GitHub','Token classic com scope repo.','token');return false}
async function salvar(){if(!(await needToken()))return;try{showModal('Salvando','alteracoes.json');await ghPut('alteracoes.json',JSON.stringify(edits,null,2),'editar falas');showModal('Salvo','Gravado no GitHub.')}catch(e){showModal('Erro',String(e.message||e))}}
function escapeToml(v){return String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}
async function compilar(){
  if(!(await needToken()))return;
  if(!Object.keys(window.FOM_ITEMS).length){showModal('Falta data.bin','Sobe o data.bin primeiro.');return;}
  try{
    showModal('Compilando','por.meta.toml');
    var lines=['[meta_properties]','id = "b7ac0e5d19f24c83"','asset_kind = "L10nTarget"','','[asset_properties]'],hits=0;
    groups.forEach(function(g){(window.FOM_ITEMS[g.i]||[]).forEach(function(it){var val=edits[it.k]!==undefined?edits[it.k]:it.o;if(val!==it.o)hits++;lines.push('"'+it.k+'" = "'+escapeToml(val)+'"')})});
    await ghPut('alteracoes.json',JSON.stringify(edits,null,2),'editar falas');
    await ghPut('por.meta.toml',lines.join('\n')+'\n','compilar mod');
    showModal('Compilado',hits+' falas no repo.');
  }catch(e){showModal('Erro',String(e.message||e))}
}
async function loadBin(){
  var r=await fetch('data.bin'); if(!r.ok) return false;
  var text=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
  var packed=JSON.parse(text);
  window.FOM_ITEMS={};
  groups=packed.map(function(g){window.FOM_ITEMS[g.id]=g.items||[]; return {i:g.id,s:g.section,n:g.name,c:g.count}});
  return true;
}
async function init(){
  saveLocal();
  try{
    var ok=await loadBin();
    document.getElementById('boot').textContent=ok?(groups.reduce(function(a,g){return a+g.c},0)+' falas. Personagem → estação → contexto → conversa.'):'Sem data.bin: só amostra do March. Suba data.bin na raiz do repo.';
    if(!ok) groups=(window.FOM_MANIFEST||[]).map(function(m){return {i:m.i,s:m.s,n:m.n,c:m.c}});
  }catch(e){
    document.getElementById('boot').textContent=String(e.message);
    groups=(window.FOM_MANIFEST||[]).map(function(m){return {i:m.i,s:m.s,n:m.n,c:m.c}});
  }
  buildNav('');
  var first=groups.find(function(m){return m.n==='March'})||groups[0];
  if(first) loadGroup(first.i);
  document.getElementById('navFilter').oninput=function(e){buildNav(e.target.value)};
  document.getElementById('q').oninput=function(e){q=e.target.value; renderAll()};
  document.getElementById('list').addEventListener('input',onInput);
  document.getElementById('btnSalvar').onclick=salvar;
  document.getElementById('btnCompilar').onclick=compilar;
  document.getElementById('btnToken').onclick=needToken;
  document.getElementById('modalOk').onclick=function(){if(modalMode==='token'){var v=document.getElementById('tokenInput').value.trim(); if(v) setToken(v)} hideModal()};
}
document.addEventListener('DOMContentLoaded',init);
