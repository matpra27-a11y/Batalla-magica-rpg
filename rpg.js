/* Batalla Mágica – rpg.js
   Estadísticas, nivel, oro, espadas, NPCs de la aldea (historia, misiones, tienda) y guardianes ocultos. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = () => window.__G || {};
  const X = () => window.__bmT || {};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isAdmin = () => !!(window.__bm && window.__bm.getUser() && window.__bm.getUser().is_admin);
  const uname = () => (window.__bm && window.__bm.getUser() && window.__bm.getUser().username) || '';
  const cfg = () => (window.__MODS && window.__MODS.cfg && window.__MODS.cfg()) || {};
  const TOUCH = matchMedia('(pointer:coarse)').matches;

  /* ---------------- Estado y guardado ---------------- */
  const NEW = () => ({ lvl: 1, xp: 0, pts: 0, st: { vida: 0, energia: 0, fuerza: 0, vel: 0 }, gold: 0, sword: 0, owned: [0], q: {}, kills: {} });
  let P = NEW(), loadedFor = null, dirty = 0;
  const key = () => 'bm_prog_' + uname();
  function load() {
    const u = uname(); if (!u || loadedFor === u) return; loadedFor = u; P = NEW();
    try { const d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d) { P = Object.assign(NEW(), d); P.st = Object.assign(NEW().st, d.st); } } catch (e) {}
    window.__sword = P.sword; paintHud();
  }
  const save = () => { dirty = 1; };
  setInterval(() => { if (dirty && loadedFor) { dirty = 0; try { localStorage.setItem(key(), JSON.stringify(P)); } catch (e) {} } }, 2000);
  addEventListener('pagehide', () => { if (loadedFor) try { localStorage.setItem(key(), JSON.stringify(P)); } catch (e) {} });

  const SW = [
    { n: 'Sin espada', d: 0, p: 0 },
    { n: 'Espada oxidada', d: .08, p: 40, m: 'sword3', L: .8 },
    { n: 'Espada de hierro', d: .16, p: 120, m: 'sword7', L: .9 },
    { n: 'Espada del guardia', d: .26, p: 260, m: 'sword12', L: .95 },
    { n: 'Hoja de plata', d: .38, p: 500, m: 'sword16', L: 1 },
    { n: 'Hoja rúnica', d: .55, p: 900, m: 'sword20', L: 1.05 },
    { n: 'Espada del serafín', d: .8, p: 1600, m: 'sword24', L: 1.15 }
  ];
  const need = l => 40 + l * 35;
  const STATS = [['vida', 'Vida', '+10 de vida máxima por punto; recibís menos daño y sanáis más.'], ['energia', 'Energía', '+10 de energía máxima por punto; recargáis más pronto.'], ['fuerza', 'Fuerza', 'Más daño en todos vuestros ataques.'], ['vel', 'Presteza', 'Corréis más ligero.']];
  const MAXS = 25;
  window.__dmgK = () => (1 + .07 * P.st.fuerza) * (1 + SW[P.sword].d);
  const maxHp = () => 100 + 10 * P.st.vida, maxEn = () => 100 + 10 * P.st.energia;
  window.__maxHp = maxHp; window.__maxEn = maxEn; window.__lvl = () => { load(); return P.lvl; };
  window.__defK = () => 100 / maxHp();
  window.__spdK = () => Math.min(1.7, 1 + .03 * P.st.vel) * (window.__bmSpd ? window.__bmSpd() : 1);
  window.__costK = () => Math.max(.25, 100 / maxEn());

  let toastT = 0;
  function toast(t) {
    let e = $('bmToast'); if (!e) { e = document.createElement('div'); e.id = 'bmToast'; e.style.cssText = 'position:fixed;top:118px;left:50%;transform:translateX(-50%);z-index:45;background:rgba(20,12,4,.85);border:1px solid #c9a24a;color:#ffe9a8;font:700 13px system-ui;padding:6px 12px;border-radius:14px;pointer-events:none;transition:opacity .3s;opacity:0'; document.body.appendChild(e); }
    e.textContent = t; e.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { e.style.opacity = 0; }, 1800);
  }
  function gain(xp, gold) {
    load(); P.xp += xp; P.gold += gold; let up = 0;
    while (P.xp >= need(P.lvl)) { P.xp -= need(P.lvl); P.lvl++; P.pts += 3; up++; }
    toast('+' + xp + ' de experiencia · +' + gold + ' monedas'); if (up) { const g = G(); g.alertMsg && g.alertMsg('¡Alcanzasteis el nivel ' + P.lvl + '!', '+3 puntos · tocad «Fe» para repartirlos', 3500); }
    save(); paintHud(); if ($('bmRpg') && $('bmRpg').style.display === 'block') panel();
  }
  window.__rpgReward = (xp, gold) => gain(xp, gold);
  window.__onKill = m => {
    const d = m.def || {}, xp = Math.round((m.max || 40) * .5) + 4, gold = 2 + Math.floor(Math.random() * 6) + (/goblin/.test(d.f || '') ? 3 : 0);
    const t = /skeleton/.test(d.f || '') ? 'esq' : /goblin/.test(d.f || '') ? 'gob' : 'limo'; P.kills[t] = (P.kills[t] || 0) + 1; P.kills.all = (P.kills.all || 0) + 1;
    bump('all'); bump(t); gain(xp, gold);
  };
  window.__rpgEvent = k => { bump(k); };

  /* ---------------- Misiones ---------------- */
  const Q = [
    { id: 'limos', by: 'lyra', n: 'Plaga en el camino', d: 'Dad muerte a seis monstruos; el portal del sur los envía sin tregua.', k: 'all', c: 6, xp: 90, g: 60 },
    { id: 'huesos', by: 'lyra', n: 'Huesos inquietos', d: 'Dad muerte a cuatro esqueletos que rondan por los caminos.', k: 'esq', c: 4, xp: 130, g: 90 },
    { id: 'goblins', by: 'alaric', n: 'Duendes ladrones', d: 'Dad muerte a cuatro goblins que saquean mis graneros.', k: 'gob', c: 4, xp: 200, g: 150 },
    { id: 'visita', by: 'bran', n: 'El camino de las runas', d: 'Viajad hasta la Aldea de las Runas, hacia el poniente.', k: 'visita', c: 1, xp: 70, g: 50 },
    { id: 'evento', by: 'elowen', n: 'Despertar el sello', d: 'Entrad en la isla del cielo cuando el portal se abra.', k: 'isl', c: 1, xp: 300, g: 200 },
    { id: 'guardian', by: 'alaric', n: 'Centinela oculto', d: 'Hallad un círculo mágico escondido y vencer al centinela que lo guarda.', k: 'guardian', c: 1, xp: 400, g: 300 },
    { id: 'serafin', by: 'alaric', n: 'La criatura del cielo', d: 'Derrotad al Gran Serafín de la isla.', k: 'boss', c: 1, xp: 1000, g: 800 }
  ];
  function bump(k) { load(); for (const q of Q) { if (q.k !== k) continue; const s = P.q[q.id]; if (s && s.s === 'active' && s.n < q.c) { s.n++; if (s.n >= q.c) { s.s = 'ready'; const g = G(); g.alertMsg && g.alertMsg('Cometido cumplido', q.n + ' · regresad con quien os lo encomendó', 3000); } save(); paintHud(); } } }
  window.__rpgEvent = bump;

  /* ---------------- HUD (oro / misiones / botón) ---------------- */
  function css() {
    if ($('bmRpgCss')) return; const s = document.createElement('style'); s.id = 'bmRpgCss';
    s.textContent = `#bmRpgB{position:fixed;top:62px;right:62px;width:42px;height:42px;border-radius:50%;z-index:26;font:800 13px Georgia,serif;background:#8a5a2b;border:2px solid #3a2410;color:#f4e6c4;display:none;align-items:center;justify-content:center;padding:0;box-shadow:0 2px 6px #0008}
    #bmQ{position:fixed;left:8px;top:150px;z-index:24;max-width:190px;font:600 12px Georgia,serif;color:#3a2410;pointer-events:none;display:none;background:linear-gradient(#ecdcae,#d8be83);border:2px solid #6b4a1f;padding:6px 9px;border-radius:6px;opacity:.93}
    #bmQ b{color:#7a2e10}#bmTalk{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);z-index:30;display:none;background:#8a5a2b;border:2px solid #3a2410;color:#f4e6c4;font:700 16px Georgia,serif;padding:10px 20px;border-radius:8px;box-shadow:0 3px 10px #000a}
    #bmDlg,#bmRpg{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(560px,94vw);max-height:78vh;overflow:auto;z-index:50;display:none;background:linear-gradient(#ecdcae,#d6bb7e);border:4px double #5a3a14;border-radius:8px;color:#3a2410;padding:16px 18px;font:16px/1.5 Georgia,serif;box-sizing:border-box;box-shadow:0 8px 28px #000b}
    #bmRpg{bottom:auto;top:50%;transform:translate(-50%,-50%)}
    #bmDlg .n,#bmRpg h3{color:#7a2e10;font:700 19px Georgia,serif;margin:0 0 6px;border-bottom:1px solid #8a6a3a;padding-bottom:4px;letter-spacing:.03em}#bmDlg .o{display:flex;flex-direction:column;gap:7px;margin-top:12px}
    #bmDlg b{color:#6a2208}
    .bmB{background:linear-gradient(#9a6a35,#7a4f22);border:2px solid #3a2410;color:#f6e9c8;border-radius:6px;padding:9px 12px;font:700 14px Georgia,serif;text-align:left}.bmB[disabled]{opacity:.5}
    .bmRow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(90,58,20,.3)}.bmRow small{display:block;color:#6a5030;font:12px Georgia,serif}
    .bmBar{height:10px;border-radius:5px;background:#b99a62;border:1px solid #5a3a14;overflow:hidden;margin:4px 0 8px}.bmBar i{display:block;height:100%;background:linear-gradient(90deg,#8a2a10,#d89a3a)}
    #bmRpg input{width:64px;font:700 15px Georgia,serif;padding:6px;border:2px solid #5a3a14;border-radius:6px;background:#f6ecd0;color:#3a2410}`;
    document.head.appendChild(s);
    const b = document.createElement('button'); b.id = 'bmRpgB'; b.textContent = 'Fe'; b.title = 'Estadísticas'; b.onclick = () => (($('bmRpg').style.display === 'block') ? closePanel() : panel()); document.body.appendChild(b);
    const q = document.createElement('div'); q.id = 'bmQ'; document.body.appendChild(q);
    const t = document.createElement('button'); t.id = 'bmTalk'; document.body.appendChild(t);
    const d = document.createElement('div'); d.id = 'bmDlg'; document.body.appendChild(d);
    const r = document.createElement('div'); r.id = 'bmRpg'; document.body.appendChild(r);
  }
  function paintHud() {
    const q = $('bmQ'); if (!q) return; const act = Q.filter(x => P.q[x.id] && (P.q[x.id].s === 'active' || P.q[x.id].s === 'ready'));
    q.style.display = act.length ? 'block' : 'none';
    q.innerHTML = '<b>Cometidos</b> · ' + P.gold + ' monedas<br>' + act.map(x => { const s = P.q[x.id]; return s.s === 'ready' ? '✔ <b>' + esc(x.n) + '</b>' : '· ' + esc(x.n) + ' ' + s.n + '/' + x.c; }).join('<br>');
  }

  /* ---------------- Panel de estadísticas ---------------- */
  function closePanel() { const r = $('bmRpg'); if (r) r.style.display = 'none'; }
  function panel() {
    css(); load(); const r = $('bmRpg'), adm = isAdmin(); r.style.display = 'block';
    const pts = adm ? '∞' : P.pts, mh = maxHp(), me_ = maxEn();
    let h = `<h3>Fe del héroe · Nivel ${P.lvl}${adm ? ' (administrador)' : ''}</h3><div style="font:13px Georgia,serif">Experiencia ${P.xp}/${need(P.lvl)} · ${P.gold} monedas · Puntos: <b>${pts}</b><br>Vida máxima <b>${mh}</b> · Energía máxima <b>${me_}</b></div><div class="bmBar"><i style="width:${Math.min(100, P.xp / need(P.lvl) * 100)}%"></i></div>`;
    STATS.forEach(([k, n, d]) => { const v = P.st[k], can = adm || (P.pts > 0 && v < MAXS); h += `<div class="bmRow"><div><b>${n}</b> · ${v}<small>${d}</small></div><button class="bmB" data-k="${k}" ${can ? '' : 'disabled'} style="min-width:48px;text-align:center">＋</button></div>`; });
    h += `<div class="bmRow"><div><b>Espada</b><small>${esc(SW[P.sword].n)} · +${Math.round(SW[P.sword].d * 100)}% de daño · Daño total ×${window.__dmgK().toFixed(2)}</small></div></div>`;
    if (adm) h += `<div class="bmRow"><div><b>Fijar nivel</b><small>Sólo el administrador puede elegir su nivel.</small></div><div style="display:flex;gap:6px"><input id="bmLv" type="number" min="1" max="99" value="${P.lvl}"><button class="bmB" id="bmLvB" style="text-align:center">Fijar</button></div></div>`;
    h += `<div style="display:flex;gap:8px;margin-top:10px"><button class="bmB" id="bmRs" style="flex:1;text-align:center">Reiniciar</button><button class="bmB" id="bmRc" style="flex:1;text-align:center">Cerrar</button></div>`;
    r.innerHTML = h;
    r.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; if (!adm) { if (P.pts <= 0 || P.st[k] >= MAXS) return; P.pts--; } P.st[k]++; if (k === 'vida') G().me.hp = Math.min(100, G().me.hp + 5); save(); panel(); });
    const lb = $('bmLvB'); if (lb) lb.onclick = () => { const n = Math.max(1, Math.min(99, parseInt($('bmLv').value) || 1)); P.lvl = n; P.xp = 0; save(); panel(); toast('Nivel fijado en ' + n); };
    $('bmRs').onclick = () => { const t = Object.values(P.st).reduce((a, b) => a + b, 0); P.st = NEW().st; if (!adm) P.pts += t; save(); panel(); toast('Atributos reiniciados'); };
    $('bmRc').onclick = closePanel;
  }
  window.__bmRpg = { open: panel, get P() { return P; } };

  /* ---------------- NPCs ---------------- */
  const NPC = [
    { id: 'herrero', m: 'peasant_5', n: 'Herrero Doran', x: 9.3, z: 9.7 }, { id: 'lyra', m: 'city_dwellers_2', n: 'Mercader Lyra', x: -9.3, z: 9.7 },
    { id: 'aldric', m: 'peasant_3', n: 'Anciano Aldric', x: -3, z: -9.5 }, { id: 'bran', m: 'city_dwellers_1', n: 'Guardia Bran', x: 7, z: -9.5 },
    { id: 'elowen', m: 'queen', n: 'Sabia Elowen', x: -8, z: -10.5 }, { id: 'alaric', m: 'king', n: 'Rey Alaric', x: 13, z: -6 },
    { w: 1, m: 'peasant_4', n: 'Aldeana', x: 4, z: 15 }, { w: 1, m: 'peasant_6', n: 'Granjero', x: -5, z: 16 }, { w: 1, m: 'rich_citizens_1', n: 'Noble', x: 14, z: 10 },
    { w: 1, m: 'rich_citizens_2', n: 'Dama', x: -14, z: 8 }, { w: 1, m: 'rich_citizens_3', n: 'Banquero', x: 1, z: -16 }, { w: 1, m: 'rich_citizens_4', n: 'Señora', x: -14, z: -13 }
  ];
  let npcG = null, npcBusy = false, npcL = [], cur = null;
  function flat(root) {
    const T = G().THREE; root.traverse(m => { if (!m.isMesh) return; m.frustumCulled = false; m.material = m.material.clone(); m.material.flatShading = true; m.material.needsUpdate = true; });
  }
  async function spawnNPCs() {
    const g = G(), T = g.THREE; if (npcG || npcBusy || !g.scene || !g.loader) return; npcBusy = true;
    try {
      const gl = await g.loader.loadAsync('npcs.glb'); flat(gl.scene); npcG = new T.Group();
      NPC.forEach((d, i) => {
        const src = gl.scene.getObjectByName(d.m); if (!src) return; const grp = new T.Group(), m = src.clone(); grp.add(m); grp.position.set(d.x, 0, d.z);
        grp.rotation.y = d.w ? Math.random() * 6.28 : Math.atan2(-d.x, -d.z);
        const lab = g.labelSprite(d.n); lab.position.y = 2.25; lab.scale.multiplyScalar(.75); grp.add(lab);
        grp.userData = { d, ox: d.x, oz: d.z, a: Math.random() * 6.28, sp: .3 + Math.random() * .3, rad: 2 + Math.random() * 1.5, ph: i }; npcG.add(grp); npcL.push(grp);
      }); g.scene.add(npcG);
    } catch (e) { console.warn('npcs', e); } npcBusy = false;
  }
  function npcUpdate(dt, t) {
    if (!npcG) return; npcG.visible = !window.__isl; if (!npcG.visible) return;
    for (const n of npcL) { const u = n.userData; if (!u.d.w) { n.position.y = Math.sin(t * 1.5 + u.ph) * .01; continue; }
      u.a += u.sp * dt * .5; const x = u.ox + Math.cos(u.a) * u.rad, z = u.oz + Math.sin(u.a) * u.rad; n.rotation.y = Math.atan2(x - n.position.x, z - n.position.z) || n.rotation.y; n.position.x = x; n.position.z = z; n.position.y = Math.abs(Math.sin(t * 4 + u.ph)) * .04; }
    const me = G().me, tk = $('bmTalk'); if (!me || !tk) return; let best = null, bd = 3.6;
    if (!window.__isl) for (const n of npcL) { if (!n.userData.d.id) continue; const d = Math.hypot(n.position.x - me.x, n.position.z - me.z); if (d < bd) { bd = d; best = n.userData.d; } }
    if (best && $('bmDlg').style.display !== 'block') { tk.style.display = 'block'; tk.textContent = 'Hablar con ' + best.n; tk.onclick = () => talk(best); } else tk.style.display = 'none';
    if (!best && $('bmDlg').style.display === 'block') closeDlg();
  }
  function closeDlg() { const d = $('bmDlg'); if (d) d.style.display = 'none'; cur = null; }
  function dlg(npc, text, opts) {
    const d = $('bmDlg'); cur = npc; d.style.display = 'block'; $('bmTalk').style.display = 'none';
    d.innerHTML = `<div class="n">${esc(npc.n)}</div><div>${text}</div><div class="o"></div>`; const o = d.querySelector('.o');
    opts.concat([{ t: 'Despedirme', f: closeDlg }]).forEach(x => { const b = document.createElement('button'); b.className = 'bmB'; b.innerHTML = x.t; if (x.off) b.disabled = true; b.onclick = x.f; o.appendChild(b); });
  }
  const dirTxt = (dx, dz) => { const a = Math.atan2(dx, dz) * 180 / Math.PI; /* +z sur, +x este */ const n = ['sur', 'sureste', 'este', 'noreste', 'norte', 'noroeste', 'oeste', 'suroeste']; return n[Math.round((((a % 360) + 360) % 360) / 45) % 8]; };
  function questOpts(npc) {
    const out = []; for (const q of Q) { if (q.by !== npc.id) continue; const s = P.q[q.id];
      if (!s) out.push({ t: 'Cometido: <b>' + esc(q.n) + '</b>', f: () => dlg(npc, esc(q.d) + `<br><small>Recompensa: ${q.xp} de experiencia y ${q.g} monedas.</small>`, [{ t: 'Acepto el cometido', f: () => { P.q[q.id] = { s: 'active', n: 0 }; save(); paintHud(); toast('Cometido aceptado: ' + q.n); talk(npc); } }]) });
      else if (s.s === 'active') out.push({ t: esc(q.n) + ' (' + s.n + '/' + q.c + ')', off: 1, f: () => {} });
      else if (s.s === 'ready') out.push({ t: 'Dar cuenta de: <b>' + esc(q.n) + '</b>', f: () => { s.s = 'done'; save(); gain(q.xp, q.g); talk(npc); } }); }
    return out;
  }
  const TALK = {
    aldric(npc) {
      const bk = [{ t: 'Volver', f: () => talk(npc) }];
      dlg(npc, 'Acercaos, viajero. Soy Aldric, el más anciano de Puerto Claro. Preguntad cuanto os plazca, que la memoria es lo único que me resta.', [
        { t: '¿Qué tierra es esta?', f: () => dlg(npc, 'Este valle fue tierra de paz por mil años. Los antiguos magos lo guardaron con siete círculos de runas, y cada círculo velaba un secreto. El mayor de todos sellaba a un ser de luz enloquecida: el <b>Gran Serafín de los Mil Ojos</b>.', bk) },
        { t: '¿Qué son las piedras rúnicas?', f: () => dlg(npc, 'Son sellos vivos. En la <b>Aldea de las Runas</b>, hacia el poniente, hay tres piedras que resplandecen. Si tres almas distintas se posan sobre ellas a un mismo tiempo, el sello se quebranta y un portal se abre hacia la isla del cielo, donde el Serafín aguarda.', bk) },
        { t: '¿Por qué despierta el sello?', f: () => dlg(npc, 'Porque el sello flaquea con cada generación. Cuando se rompe, la aldea es arrebatada al cielo por <b>diez minutos</b>. Si el Serafín cae, quien le dé muerte recibe su <b>halo</b> y el poder del rayo sagrado. Si no, el sello se cierra de nuevo… hasta la próxima vez.', bk) },
        { t: '¿Existen parajes ocultos?', f: () => dlg(npc, 'Cuentan que en los confines del valle, entre el bosque más espeso, yacen <b>cuatro círculos mágicos</b>. Quien pisa uno despierta a un centinela de anillos y ojos. Cae vencido, mas renace a los dos minutos. Guardaos de sus bolas de energía.', bk) }]);
    },
    bran(npc) {
      const me = G().me, H = cfg().H, bk = [{ t: 'Volver', f: () => talk(npc) }]; let txt = 'Soy Bran, guardián de la plaza. Si buscáis las piedras rúnicas, yo os mostraré el camino.';
      if (me && H) { const dx = H.x - me.x, dz = H.z - me.z; txt += `<br><br>La <b>Aldea de las Runas</b> yace hacia el <b>${dirTxt(dx, dz)}</b>, a unos <b>${Math.round(Math.hypot(dx, dz))} pasos</b> de donde estáis. Seguid los caminos de piedra y veréis brillar las runas.`; }
      dlg(npc, txt, [
        { t: '¿Cómo se despierta el sello?', f: () => dlg(npc, 'Hallad las <b>tres piedras pequeñas</b> de la aldea; resplandecen al acercaros. Cada compañero debe posarse sobre una distinta, los tres a la par. Con amigos es más llevadero: abrid un mundo privado y convocadlos.', bk) },
        { t: '¿Es peligrosa la empresa?', f: () => dlg(npc, 'En extremo. Los serafines menores pueden esquivarse, mas el Gran Serafín arroja rayos y ondas de luz. Resguardaos tras las piedras gigantes cuando oigáis la onda, o saltad para esquivarla.', bk) }].concat(questOpts(npc)));
    },
    elowen(npc) {
      const bk = [{ t: 'Volver', f: () => talk(npc) }];
      dlg(npc, 'Que la luz os guíe. Soy Elowen. Os lo diré sin rodeos: para enfrentaros a esa <b>criatura del cielo</b> habréis menester de <b>mucha fortuna y mucha vida</b>. Ningún novato sale con bien de ese lance.', [
        { t: '¿Cómo me preparo?', f: () => dlg(npc, 'Dad muerte a los monstruos: cada uno os concede experiencia y monedas. Al subir de nivel ganáis tres puntos para repartir entre <b>vida, energía, fuerza y presteza</b> (tocad «Fe»). Y comprad una espada al herrero de la plaza.', [{ t: 'Abrir la Fe del héroe', f: () => { closeDlg(); panel(); } }].concat(bk)) },
        { t: '¿Es distinta cada magia?', f: () => dlg(npc, 'Lo es. Cada elemento posee seis artes propias, y se despiertan al crecer vuestro nivel. El fuego invoca lava y meteoros; el hielo, ventiscas y prisiones; el veneno, nubes y plagas; la naturaleza, raíces y tótems; la sangre roba vida; el arcano abre saltos y estrellas; y la <b>sombra</b> abre un portal de monstruos o despierta las runas.', bk) }].concat(questOpts(npc)));
    },
    lyra(npc) { dlg(npc, 'Salud, buen viajero. Nada vendo hoy, mas tengo cometidos para gente de valor.', questOpts(npc)); },
    alaric(npc) { dlg(npc, 'Yo soy Alaric, rey de este valle. Mis huestes andan ocupadas; menester he de héroes de veras.', questOpts(npc)); },
    herrero(npc) {
      const rows = SW.slice(1).map((s, i) => { i++; const own = P.owned.indexOf(i) >= 0, eq = P.sword === i;
        return { t: `${esc(s.n)} · +${Math.round(s.d * 100)}% de daño · ${eq ? 'empuñada' : own ? 'Empuñar' : s.p + ' monedas'}`, off: eq || (!own && P.gold < s.p), f: () => { if (!own) { if (P.gold < s.p) return; P.gold -= s.p; P.owned.push(i); } P.sword = i; window.__sword = i; save(); paintHud(); toast('Empuñáis: ' + s.n); talk(npc); } }; });
      rows.push({ t: 'Envainar la espada', off: !P.sword, f: () => { P.sword = 0; window.__sword = 0; save(); talk(npc); } });
      dlg(npc, `Sed bienvenido a mi fragua. Soy Doran y acero tengo para toda bolsa. Lleváis <b>${P.gold} monedas</b>.`, rows);
    }
  };
  function talk(npc) { load(); (TALK[npc.id] || (() => {}))(npc); }

  /* ---------------- Espada en la espalda ---------------- */
  let swGL = null, swBusy = false;
  async function swLoad() { if (swGL || swBusy || !G().loader) return; swBusy = true; try { swGL = await G().loader.loadAsync('swords.glb'); } catch (e) { console.warn('espadas', e); } swBusy = false; }
  function setSword(av, idx) {
    if (!av || !swGL) return; const u = av.userData; idx = idx | 0; if ((u.swIdx | 0) === idx && (idx === 0 || u.swObj)) return;
    if (u.swObj) { av.remove(u.swObj); u.swObj = null; } u.swIdx = idx; if (!idx) return;
    const def = SW[idx], src = def && swGL.scene.getObjectByName(def.m); if (!src) return; const T = G().THREE, m = src.clone(), h = u.h || 1.8, hold = new T.Group();
    m.scale.setScalar(h * .42 * def.L); hold.position.set(.05, h * .5, -.2); hold.rotation.set(.12, 0, -.75); hold.add(m); av.add(hold); u.swObj = hold;
  }

  /* ---------------- Guardianes ocultos ---------------- */
  const GD = [], shots = [];
  function barSprite() {
    const T = G().THREE, c = document.createElement('canvas'); c.width = 128; c.height = 14; const t = new T.CanvasTexture(c), s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(4.5, .5, 1); s.renderOrder = 11;
    return { s, draw(f) { const x = c.getContext('2d'); x.fillStyle = '#200'; x.fillRect(0, 0, 128, 14); x.fillStyle = '#ffd24a'; x.fillRect(2, 2, 124 * Math.max(0, f), 10); t.needsUpdate = true; } };
  }
  async function summon(d) {
    const g = G(), T = g.THREE, X_ = X(); if (d.busy || d.alive || !X_.ringsModel) return; d.busy = true;
    try {
      const m = await X_.ringsModel(1.6); const grp = new T.Group(); grp.add(m.root); m.root.position.y = 0; const gl = X_.spr(0xc8a0ff, 11, .45); grp.add(gl);
      const bar = barSprite(); bar.s.position.y = 4.2; bar.draw(1); grp.add(bar.s); const lab = g.labelSprite('Centinela'); lab.position.y = 5.1; grp.add(lab);
      grp.position.set(d.x, 3.4, d.z); g.scene.add(grp);
      const f = { g: grp, h: 7, rad: 3.6, dead: false, ready: true, hp: 700, max: 700, upd: m.upd, bar, t: 0, at: 1.5, ax: d.x, az: d.z, foe: {} };
      f.foe.hit = dm => { if (f.dead) return; f.hp -= dm; bar.draw(f.hp / f.max); g.addGlow(grp.position.clone(), 0xffffff, 4, .25); if (f.hp <= 0) die(d, f); };
      d.f = f; d.alive = true; X_.FOES.push(f); g.alertMsg && g.alertMsg('¡El círculo ha despertado a un centinela!', 'Vencedlo: renace a los dos minutos', 3500);
    } catch (e) { console.warn('guardián', e); } d.busy = false;
  }
  function die(d, f) {
    const g = G(); f.dead = true; d.alive = false; d.respawn = performance.now() + 120000; g.addGlow(f.g.position.clone(), 0xc8a0ff, 12, .8); g.addRing(f.g.position.x, f.g.position.z, 7, '#c8a0ff', .7);
    if (f.g.parent) f.g.parent.remove(f.g); const i = X().FOES.indexOf(f); if (i >= 0) X().FOES.splice(i, 1);
    g.alertMsg && g.alertMsg('¡Centinela vencido!', 'Volverá en dos minutos', 3000); gain(160, 60); bump('guardian');
  }
  function guardUpdate(dt) {
    const g = G(), me = g.me, T = g.THREE, S = cfg().sec; if (!S || !me || !X().ringsModel) return;
    if (!GD.length) S.forEach(s => GD.push({ x: s.x, z: s.z, alive: false, busy: false, respawn: 0 }));
    const now = performance.now();
    for (const d of GD) {
      if (!d.alive && !window.__isl && now > d.respawn && Math.hypot(me.x - d.x, me.z - d.z) < 3.6) summon(d);
      const f = d.f; if (!d.alive || !f || f.dead) continue; f.t += dt; const p = f.g.position, dx = me.x - p.x, dz = me.z - p.z, dd = Math.hypot(dx, dz) || 1;
      if (dd < 28 && dd > 8) { p.x += dx / dd * 2.6 * dt; p.z += dz / dd * 2.6 * dt; } const dc = Math.hypot(p.x - d.x, p.z - d.z); if (dc > 20) { p.x = d.x + (p.x - d.x) / dc * 20; p.z = d.z + (p.z - d.z) / dc * 20; }
      p.y = 3.4 + Math.sin(f.t * 1.3) * .6; f.g.rotation.y = Math.atan2(dx, dz); f.upd(f.t); f.at -= dt;
      if (f.at <= 0 && dd < 34) { f.at = 1.7; const dir = new T.Vector3(me.x - p.x, (me.y || 0) + 1.1 - p.y, me.z - p.z).normalize(), s = X().spr(0xd6b4ff, 1.6, .95); s.position.copy(p); g.scene.add(s); shots.push({ s, v: dir.multiplyScalar(13), t: 0 }); }
    }
    for (let i = shots.length - 1; i >= 0; i--) { const q = shots[i]; q.t += dt; q.s.position.addScaledVector(q.v, dt); const dm = Math.hypot(q.s.position.x - me.x, q.s.position.z - me.z), dy = Math.abs(q.s.position.y - ((me.y || 0) + 1));
      if ((dm < 1.1 && dy < 1.6) || q.t > 3) { if (dm < 1.1 && dy < 1.6 && g.hitMe) g.hitMe(5); g.scene.remove(q.s); shots.splice(i, 1); } }
  }

  /* ---------------- Bucle ---------------- */
  let last = performance.now(), swT = 0, vT = 0;
  function tick(now) {
    requestAnimationFrame(tick); const dt = Math.min(.1, (now - last) / 1000); last = now; const g = G();
    if (!g.me || !$('lobby') || $('lobby').style.display !== 'none') { const b = $('bmRpgB'); if (b) b.style.display = 'none'; return; }
    css(); load(); const b = $('bmRpgB'); if (b) b.style.display = 'flex';
    spawnNPCs(); swLoad(); try { npcUpdate(dt, now / 1000); guardUpdate(dt); } catch (e) { console.warn('rpg', e); }
    const me = g.me; if (P.st.vida) me.hp = Math.min(100, me.hp + P.st.vida * .1 * dt); if (P.st.energia) me.en = Math.min(100, me.en + P.st.energia * .8 * dt);
    swT += dt; if (swT > .5) { swT = 0; setSword(me.avatar, P.sword); g.remotes.forEach(r => { if (r.avatar) setSword(r.avatar, r.sw); }); }
    vT += dt; if (vT > 1.5) { vT = 0; const H = cfg().H; if (H && Math.hypot(me.x - H.x, me.z - H.z) < 22) bump('visita'); }
  }
  requestAnimationFrame(tick);
})();
