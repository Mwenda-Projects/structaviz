/* StructaViz Tools: shared theme, top bar and desktop layout.
   Each tool loads it with:
   <link rel="stylesheet" href="structaviz-tools.css"><script src="structaviz-tools.js"></script> */
(function(){
  var KEY='structaviz-theme',root=document.documentElement,path=location.pathname,
      inTools=/\/tools\//i.test(path),isHub=/\/hub(\.html)?\/?$/i.test(path),up=inTools?'../':'';

  /* Theme: follow the choice made inside the StructaViz app (default Dark) */
  function pref(){try{return localStorage.getItem(KEY)||'dark'}catch(e){return'dark'}}
  function light(){return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)}
  function apply(){
    var p=pref(),t=p==='light'||(p==='device'&&light())?'light':'dark';
    root.setAttribute('data-theme',t);
    var m=document.querySelector('meta[name="theme-color"]');
    if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}
    m.content=t==='light'?'#f1f5f9':'#090c11';
  }
  apply();
  if(window.matchMedia){try{matchMedia('(prefers-color-scheme: light)').addEventListener('change',apply)}catch(e){}}
  window.addEventListener('storage',function(e){if(e.key===KEY)apply()});

  /* Offline support (production only, so local development is never cached) */
  if('serviceWorker' in navigator&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}

  /* Tab icon and title */
  if(!document.querySelector('link[rel~="icon"]')){var l=document.createElement('link');l.rel='icon';l.type='image/png';l.href='/favicon-96x96.png';document.head.appendChild(l)}
  if(!/StructaViz/i.test(document.title))document.title+=' | StructaViz';

  /* Top bar */
  function bar(){
    if(document.querySelector('.svz-top'))return;
    var h=document.createElement('header');h.className='svz-top';
    h.innerHTML='<a class="svz-brand" href="'+up+'hub.html" aria-label="StructaViz tools home"><img class="svz-ic" src="/logo-mark.png" alt="" width="26" height="26"><span class="svz-name">STRUCTAVIZ</span><span class="svz-tag">TOOLS</span></a>'
      +'<nav class="svz-nav" aria-label="Navigation">'
      +(isHub?'':'<a href="'+up+'hub.html"><span class="lg">All tools</span><span class="sm">Tools</span></a>')
      +'<a class="svz-back" href="'+up+'app.html"><span class="lg">\u2190 Back to StructaViz</span><span class="sm">\u2190 App</span></a></nav>';
    document.body.insertBefore(h,document.body.firstChild);
    var img=h.querySelector('img');
    img.addEventListener('error',function(){var i=document.createElement('i');i.className='svz-ic fb';img.replaceWith(i)});
  }

  /* Desktop layout: inputs left, results right. Phones keep the original order. */
  var groups=[];
  function isOut(c){return !!c.querySelector('.res,svg,table,canvas')&&!c.querySelector('input,select,textarea')}
  function collect(){
    var cs=[].slice.call(document.querySelectorAll('main, main > section'));
    cs.forEach(function(c){
      var cards=[].filter.call(c.children,function(n){return n.classList&&n.classList.contains('card')});
      if(cards.length<2)return;
      var outs=cards.filter(isOut),ins=cards.filter(function(x){return outs.indexOf(x)<0});
      if(outs.length&&ins.length)groups.push({c:c,cards:cards,ins:ins,outs:outs,wrap:null});
    });
  }
  function split(g){
    if(g.wrap)return;
    var w=document.createElement('div'),a=document.createElement('div'),b=document.createElement('div');
    w.className='svz-cols';a.className='svz-in';b.className='svz-out';w.appendChild(a);w.appendChild(b);
    g.c.insertBefore(w,g.cards[0]);
    g.ins.forEach(function(n){a.appendChild(n)});g.outs.forEach(function(n){b.appendChild(n)});
    g.wrap=w;
  }
  function join(g){
    if(!g.wrap)return;
    g.cards.forEach(function(n){g.c.insertBefore(n,g.wrap)});
    g.wrap.remove();g.wrap=null;
  }
  function layout(){var wide=matchMedia('(min-width:1000px)').matches;groups.forEach(wide?split:join)}


  /* Phones: a row of tabs that cannot fit on one line becomes a dropdown.
     Tabs that fit stay as tabs, and desktop always keeps tabs. */
  function tabswitch(){
    if(isHub)return;
    var mq=matchMedia('(max-width:700px)');
    var items=[].slice.call(document.querySelectorAll('.tabs, .chips')).map(function(row){
      var wrap=document.createElement('div'),lab=document.createElement('label'),box=document.createElement('div'),sel=document.createElement('select'),id='svzsel'+Math.random().toString(36).slice(2,8);
      wrap.className='svz-tabsel';wrap.hidden=true;box.className='svz-selbox';sel.id=id;lab.setAttribute('for',id);
      lab.textContent=row.classList.contains('tabs')?'Calculation':'Category';
      box.appendChild(sel);wrap.appendChild(lab);wrap.appendChild(box);row.parentNode.insertBefore(wrap,row);
      sel.addEventListener('change',function(){var b=row.querySelectorAll('button')[sel.selectedIndex];if(b)b.click()});
      var it={row:row,wrap:wrap,sel:sel,labels:''};
      new MutationObserver(function(){sync(it)}).observe(row,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      return it;
    });
    function sync(it){
      var bs=[].slice.call(it.row.querySelectorAll('button')),labels=bs.map(function(b){return b.textContent.trim()}).join('|');
      if(it.labels!==labels){it.sel.innerHTML='';bs.forEach(function(b){var o=document.createElement('option');o.textContent=b.textContent.trim();it.sel.appendChild(o)});it.labels=labels}
      for(var i=0;i<bs.length;i++)if(bs[i].classList.contains('on')){it.sel.selectedIndex=i;break}
    }
    function fits(it){
      var bs=it.row.querySelectorAll('button'),w=6*Math.max(bs.length-1,0);
      [].forEach.call(bs,function(b){w+=b.offsetWidth});
      var p=it.row.parentNode,cs=getComputedStyle(p);
      return w<=p.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    }
    function update(){
      items.forEach(function(it){
        sync(it);
        var compact=mq.matches&&!fits(it);
        it.wrap.hidden=!compact;it.row.classList.toggle('svz-off',compact);
      });
    }
    update();
    window.addEventListener('resize',update);
    try{mq.addEventListener('change',update)}catch(e){}
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(update);
  }

  function ready(){
    bar();collect();layout();tabswitch();
    try{matchMedia('(min-width:1000px)').addEventListener('change',layout)}catch(e){window.addEventListener('resize',layout)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();