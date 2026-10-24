/* StructaViz Tools: shared theme + top bar. Add to each tool's <head>:
   <link rel="stylesheet" href="structaviz-tools.css"><script src="structaviz-tools.js"></script> */
(function(){
  var KEY='structaviz-theme',root=document.documentElement;
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

  function build(){
    if(document.querySelector('.svz-top'))return;
    var isHub=/hub\.html$/i.test(location.pathname);
    var h=document.createElement('header');h.className='svz-top';
    h.innerHTML='<a class="svz-brand" href="hub.html" aria-label="StructaViz tools home"><i class="svz-ic"></i><span class="svz-name">STRUCTAVIZ</span><span class="svz-tag">TOOLS</span></a>'
      +'<nav class="svz-nav" aria-label="Navigation">'
      +(isHub?'':'<a href="hub.html"><span class="lg">All tools</span><span class="sm">Tools</span></a>')
      +'<button type="button" id="svzTheme"></button>'
      +'<a class="svz-back" href="../app.html"><span class="lg">\u2190 Back to StructaViz</span><span class="sm">\u2190 App</span></a></nav>';
    document.body.insertBefore(h,document.body.firstChild);
    var b=h.querySelector('#svzTheme');
    function label(){var p=pref();b.textContent=p==='light'?'\u2600':p==='device'?'\u25D0':'\u263E';b.title='Theme: '+p;b.setAttribute('aria-label','Theme: '+p+'. Click to change.')}
    label();
    b.addEventListener('click',function(){
      var n={dark:'light',light:'device',device:'dark'}[pref()]||'dark';
      try{localStorage.setItem(KEY,n)}catch(e){}
      apply();label();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
