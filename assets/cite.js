

(function(){
  var bs=document.querySelectorAll('.cv-cite[data-bib]'); if(!bs.length) return;
  function copy(t){
    if(navigator.clipboard&&navigator.clipboard.writeText&&window.isSecureContext)
      return navigator.clipboard.writeText(t).catch(function(){ return fallback(t); });
    return fallback(t);
  }
  function fallback(t){
    return new Promise(function(ok,no){
      var a=document.createElement('textarea'); a.value=t; a.setAttribute('readonly','');
      a.style.cssText='position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(a); a.select(); a.setSelectionRange(0,t.length);
      var r=false; try{ r=document.execCommand('copy'); }catch(e){}
      document.body.removeChild(a); r?ok():no();
    });
  }
  var pop=null, owner=null;
  function close(back){
    if(!pop) return;
    var o=owner; pop.parentNode.removeChild(pop); pop=null; owner=null;
    o.setAttribute('aria-expanded','false'); o.classList.remove('open');
    if(back) o.focus();
  }
  function action(label,text,status){
    var b=document.createElement('button'); b.type='button'; b.className='cv-pop-b'; b.textContent=label;
    var tm;
    b.addEventListener('click',function(){
      copy(text).then(function(){
        b.textContent='Copied'; status.textContent='Copied'; clearTimeout(tm);
        tm=setTimeout(function(){ b.textContent=label; status.textContent=''; },1500);
      },function(){});
    });
    return b;
  }
  function open(b){
    close(false);
    var apa=b.getAttribute('data-apa'), it=b.getAttribute('data-it'), at=it?apa.indexOf(it):-1;
    pop=document.createElement('div'); pop.className='cv-pop'; pop.setAttribute('role','group'); pop.setAttribute('aria-label','Cite');
    var p=document.createElement('p'); p.className='cv-pop-t'; p.tabIndex=-1;
    if(at<0) p.textContent=apa;
    else{
      p.appendChild(document.createTextNode(apa.slice(0,at)));
      var i=document.createElement('i'); i.textContent=it; p.appendChild(i);
      p.appendChild(document.createTextNode(apa.slice(at+it.length)));
    }
    var row=document.createElement('div'); row.className='cv-pop-r';
    var st=document.createElement('span'); st.className='vh'; st.setAttribute('role','status');
    row.appendChild(action('Copy',apa,st)); row.appendChild(action('BibTeX',b.getAttribute('data-bib'),st));
    pop.appendChild(p); pop.appendChild(row); pop.appendChild(st);
    b.closest('.cv-what, .pp-actions').appendChild(pop);
    owner=b; b.setAttribute('aria-expanded','true'); b.classList.add('open');
    p.focus({preventScroll:true});
  }
  [].forEach.call(bs,function(b){
    b.hidden=false;
    b.addEventListener('click',function(){ if(owner===b) close(true); else open(b); });
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&pop) close(true); });
  document.addEventListener('click',function(e){
    if(pop&&!pop.contains(e.target)&&!owner.contains(e.target)) close(pop.contains(document.activeElement));
  });
})();
