/* StructaViz dropdowns: shows a themed option list instead of the browser's default one.
   The real <select> stays in the page, so values, events and existing code keep working.
   Desktop: a popover under the field. Phones: a bottom sheet. */
(function () {
  if (window.__svzSelect) return;
  window.__svzSelect = true;
  var cur = null, lastTouch = 0, typed = '', typedAt = 0;
  var mqSheet = window.matchMedia('(max-width:700px)');

  function pick(el) {
    var s = el && el.closest ? el.closest('select') : null;
    if (!s || s.multiple || s.size > 1 || s.hasAttribute('data-native')) return null;
    return s;
  }
  function labelOf(s) {
    var l = s.labels && s.labels[0];
    return (l && l.textContent.trim()) || s.getAttribute('aria-label') || 'Select';
  }
  function rows(s) {
    var out = [];
    [].forEach.call(s.children, function (n) {
      if (n.tagName === 'OPTGROUP') {
        out.push({ group: n.label });
        [].forEach.call(n.children, function (o) { out.push({ o: o, dis: n.disabled || o.disabled }); });
      } else if (n.tagName === 'OPTION') out.push({ o: n, dis: n.disabled });
    });
    return out;
  }

  function close(refocus) {
    if (!cur) return;
    var c = cur; cur = null;
    document.removeEventListener('mousedown', c.outside, true);
    window.removeEventListener('scroll', c.scroll, true);
    window.removeEventListener('resize', c.resize);
    c.nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    document.documentElement.classList.remove('svz-lock');
    if (refocus !== false) { try { c.sel.focus({ preventScroll: true }); } catch (e) {} }
  }

  function choose(c, i) {
    var r = c.items[i];
    if (!r || r.dis) return;
    var changed = c.sel.selectedIndex !== r.o.index;
    c.sel.selectedIndex = r.o.index;
    close(true);
    if (changed) {
      c.sel.dispatchEvent(new Event('input', { bubbles: true }));
      c.sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setActive(c, i, scroll) {
    var opts = c.opts;
    if (c.act >= 0 && opts[c.act]) opts[c.act].classList.remove('act');
    c.act = i;
    if (opts[i]) {
      opts[i].classList.add('act');
      c.list.setAttribute('aria-activedescendant', opts[i].id);
      if (scroll) opts[i].scrollIntoView({ block: 'nearest' });
    }
  }
  function step(c, from, dir) {
    var i = from;
    do { i += dir; } while (i >= 0 && i < c.items.length && c.items[i].dis);
    return i >= 0 && i < c.items.length ? i : from;
  }

  function open(s) {
    if (s.disabled) return;
    close(false);
    var sheet = mqSheet.matches;
    var data = rows(s), items = [], opts = [];
    var list = document.createElement('div');
    list.className = sheet ? 'svz-list' : 'svz-menu';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    var uid = 'svzo' + Math.random().toString(36).slice(2, 7);
    data.forEach(function (r) {
      if (r.group !== undefined) {
        var g = document.createElement('div'); g.className = 'svz-grp'; g.textContent = r.group; list.appendChild(g); return;
      }
      var idx = items.length, d = document.createElement('div');
      d.className = 'svz-opt' + (r.o.index === s.selectedIndex ? ' on' : '');
      d.id = uid + idx; d.setAttribute('role', 'option');
      d.setAttribute('aria-selected', r.o.index === s.selectedIndex ? 'true' : 'false');
      if (r.dis) d.setAttribute('aria-disabled', 'true');
      d.textContent = r.o.textContent;
      d.dataset.i = idx; items.push(r); opts.push(d); list.appendChild(d);
    });
    var c = { sel: s, items: items, opts: opts, list: list, nodes: [], act: -1 };
    c.outside = function (e) { if (!c.nodes.some(function (n) { return n.contains(e.target); }) && e.target !== s) close(false); };
    c.scroll = function (e) { if (!list.contains(e.target)) close(false); };
    c.resize = function () { close(false); };

    if (sheet) {
      var back = document.createElement('div'); back.className = 'svz-backdrop';
      var sh = document.createElement('div'); sh.className = 'svz-sheet';
      var h = document.createElement('div'); h.className = 'svz-sheet-h';
      var t = document.createElement('div'); t.className = 'svz-sheet-t'; t.textContent = labelOf(s);
      var x = document.createElement('button'); x.type = 'button'; x.className = 'svz-sheet-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '\u00D7';
      h.appendChild(t); h.appendChild(x); sh.appendChild(h); sh.appendChild(list);
      back.addEventListener('click', function () { close(true); });
      x.addEventListener('click', function () { close(true); });
      document.body.appendChild(back); document.body.appendChild(sh);
      c.nodes = [back, sh];
      document.documentElement.classList.add('svz-lock');
    } else {
      document.body.appendChild(list);
      c.nodes = [list];
      var r = s.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
      list.style.minWidth = Math.max(r.width, 160) + 'px';
      list.style.maxWidth = Math.min(vw - 16, 420) + 'px';
      var below = vh - r.bottom - 12, above = r.top - 12;
      var want = Math.min(list.scrollHeight + 10, 320);
      var up = below < Math.min(want, 180) && above > below;
      list.style.maxHeight = Math.max(120, Math.min(320, up ? above : below)) + 'px';
      var left = Math.min(Math.max(8, r.left), vw - list.offsetWidth - 8);
      list.style.left = left + 'px';
      if (up) list.style.bottom = (vh - r.top + 6) + 'px'; else list.style.top = (r.bottom + 6) + 'px';
    }

    list.addEventListener('mousemove', function (e) {
      var o = e.target.closest('.svz-opt'); if (o && !o.hasAttribute('aria-disabled')) setActive(c, +o.dataset.i, false);
    });
    list.addEventListener('click', function (e) { var o = e.target.closest('.svz-opt'); if (o) choose(c, +o.dataset.i); });
    list.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') { e.preventDefault(); close(true); }
      else if (k === 'Tab') close(false);
      else if (k === 'ArrowDown') { e.preventDefault(); setActive(c, step(c, c.act, 1), true); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(c, step(c, c.act, -1), true); }
      else if (k === 'Home') { e.preventDefault(); setActive(c, step(c, -1, 1), true); }
      else if (k === 'End') { e.preventDefault(); setActive(c, step(c, c.items.length, -1), true); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(c, c.act); }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + k.toLowerCase(); typedAt = now;
        for (var i = 0; i < c.items.length; i++) if (!c.items[i].dis && c.items[i].o.textContent.trim().toLowerCase().indexOf(typed) === 0) { setActive(c, i, true); break; }
      }
    });
    document.addEventListener('mousedown', c.outside, true);
    window.addEventListener('scroll', c.scroll, true);
    window.addEventListener('resize', c.resize);
    cur = c;
    var start = items.findIndex(function (r) { return r.o.index === s.selectedIndex; });
    setActive(c, start >= 0 ? start : step(c, -1, 1), true);
    list.focus({ preventScroll: true });
  }

  function toggle(s) { if (cur && cur.sel === s) close(true); else open(s); }

  document.addEventListener('mousedown', function (e) {
    var s = pick(e.target);
    if (!s || e.button !== 0 || Date.now() - lastTouch < 700) return;
    e.preventDefault();
    try { s.focus({ preventScroll: true }); } catch (x) {}
    toggle(s);
  }, true);

  var tp = null;
  document.addEventListener('touchstart', function (e) {
    var s = pick(e.target), t = e.touches[0];
    tp = s && t ? { s: s, x: t.clientX, y: t.clientY, moved: false } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (tp && t && (Math.abs(t.clientX - tp.x) > 8 || Math.abs(t.clientY - tp.y) > 8)) tp.moved = true;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function (e) {
    if (!tp) return;
    var p = tp; tp = null;
    if (p.moved || !e.cancelable) return;
    e.preventDefault(); lastTouch = Date.now();
    toggle(p.s);
  }, { capture: true, passive: false });

  document.addEventListener('keydown', function (e) {
    var s = pick(e.target);
    if (!s || (cur && cur.list.contains(e.target))) return;
    if (e.key === 'Enter' || e.key === ' ' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) { e.preventDefault(); open(s); }
  }, true);
})();