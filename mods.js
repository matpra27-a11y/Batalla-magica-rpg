/* Batalla Mágica – mods.js
   Mundo (portal, caminos, aldea de runas), optimización, cuentas, amigos y admin.
   Se carga desde jugar.html; no hace falta tocar index.html. */
(function () {
  'use strict';
  const CFG = Object.assign({ url: '', key: '', admins: [] }, window.BM_CONFIG || {});
  const REMOTE = !!(CFG.url && CFG.key);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lc = s => String(s || '').toLowerCase();

  /* =====================================================================
     1) MUNDO: más vegetación y caminos en el portal + aldea de runas
     ===================================================================== */
  function makeArea(G, rng) {
    return function area(f, n, cx, cz, rin, rout, o) {
      const list = []; let tries = 0;
      while (list.length < n && tries++ < n * 40) {
        const a = rng() * 6.283, rr = Math.sqrt(rin * rin + rng() * (rout * rout - rin * rin));
        const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (Math.abs(x) > 118 || z > 162 || z < -68) continue;
        if (G.blocked(x, z, o.pad ?? 1)) continue;
        const s = 0.8 + rng() * 0.45;
        list.push({ x, z, r: rng() * 6.28, s });
        if (o.col) G.colliders.push({ x, z, r: o.col * s });
      }
      G.queue(f, list, o);
    };
  }

  function runes(G, sites) {
    const { THREE, scene, me } = G;
    const mk = (R, cA, cB) => {
      const mat = new THREE.MeshBasicMaterial({ map: G.circleTex(cA, cB), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.rotation.x = -Math.PI / 2; m.scale.set(R * 2, R * 2, 1); return m;
    };
    sites.forEach(s => {
      s.g1 = new THREE.Group(); s.g2 = new THREE.Group();
      s.m1 = mk(s.R, s.cA, s.cB); s.m2 = mk(s.R * 0.62, s.cB, s.cA);
      s.g1.add(s.m1); s.g2.add(s.m2);
      s.root = new THREE.Group(); s.root.position.set(s.x, 0.1, s.z); s.root.add(s.g1, s.g2); s.root.visible = false; scene.add(s.root);
      s.a = 0; s.near = false;
    });
    let last = performance.now();
    (function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      for (const s of sites) {
        const near = Math.hypot(me.x - s.x, me.z - s.z) < s.R + 5;
        if (near && !s.near) { try { G.addRing(s.x, s.z, s.R * 1.15, s.cA, 1.0); G.addGlow(new THREE.Vector3(s.x, 1.2, s.z), s.cB, s.R * 0.9, 1.2); } catch (e) {} }
        s.near = near;
        s.a += ((near ? 1 : 0) - s.a) * Math.min(1, dt * (near ? 3.5 : 1.8));
        if (s.a < 0.01) { s.root.visible = false; continue; }
        s.root.visible = true; const k = 0.7 + 0.3 * s.a; s.root.scale.set(k, 1, k);
        s.g1.rotation.y += dt * 0.5; s.g2.rotation.y -= dt * 0.9;
        s.m1.material.opacity = s.m2.material.opacity = s.a * 0.95;
      }
    })(performance.now());
  }

  function worldPre(G) {
    const { THREE, scene, queue, colliders, pathSegs, mulberry32, TOUCH, PORTAL } = G;
    const k = TOUCH ? 0.65 : 1, N = n => Math.max(1, Math.round(n * k));
    const rng = mulberry32(90210), area = makeArea(G, rng);
    const tiles = [];
    const road = (x1, z1, x2, z2) => {
      pathSegs.push([x1, z1, x2, z2]);
      const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) return;
      const dx = (x2 - x1) / L, dz = (z2 - z1) / L, r = Math.atan2(-dz, dx);
      for (let t = 0; t < L; t += 1.0) tiles.push({ x: x1 + dx * t, z: z1 + dz * t, r, sx: 1.25, sz: 3.0 });
    };
    const bend = (x1, z1, x2, z2, off) => { // camino con una curva suave
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1;
      const px = mx - dz / L * off, pz = mz + dx / L * off;
      road(x1, z1, px, pz); road(px, pz, x2, z2);
    };

    /* --- Portal: anillo de camino, ramales y runas --- */
    const P = PORTAL, RR = 7;
    road(0, 118, 0, P.z - RR);
    for (let i = 0; i < 12; i++) {
      const a1 = -Math.PI / 2 + i * Math.PI / 6, a2 = a1 + Math.PI / 6;
      road(P.x + RR * Math.cos(a1), P.z + RR * Math.sin(a1), P.x + RR * Math.cos(a2), P.z + RR * Math.sin(a2));
    }
    road(0, P.z - RR, 0, P.z - 3.2);
    const ends = [[-27, P.z - 15], [27, P.z - 15], [-29, P.z + 17], [29, P.z + 17], [0, P.z + 31]];
    ends.forEach(([ex, ez], i) => {
      const ux = (ex - P.x), uz = (ez - P.z), d = Math.hypot(ux, uz);
      bend(P.x + ux / d * RR, P.z + uz / d * RR, ex, ez, (i % 2 ? 3 : -3));
    });
    const stones = [[-30, P.z - 17.5], [30, P.z - 17.5]].map(([x, z]) => ({ x, z, r: Math.atan2(-x, -(z - P.z)) }));
    stones.forEach(s => colliders.push({ x: s.x, z: s.z, r: 2 }));
    queue('glowing-rune-waystone', stones, { w: 5, shadow: true });
    colliders.push({ x: 0, z: P.z + 35, r: 3.5 });
    queue('giant-fantasy-mushrooms', [{ x: 0, z: P.z + 35, r: 0 }], { w: 10, shadow: true });

    /* --- Aldea de las Runas (copia de la aldea, en otro lugar) --- */
    let zr = 62, best = 1e9;
    for (let z = 50; z <= 74; z++) { // elige la línea de camino con menos árboles en el medio
      let c = 0; for (let x = 0; x >= -84; x -= 2) for (const q of colliders) if (Math.hypot(q.x - x, q.z - z) < q.r + 1.6) c++;
      if (c < best) { best = c; zr = z; }
    }
    const H = { x: -92, z: zr }, hx = H.x, hz = H.z;
    const face = (x, z) => Math.atan2(-(x - hx), -(z - hz));
    const rr = () => rng() * 6;
    const A = { houses: [], stalls: [], benches: [], barrels: [], crates: [], signs: [], wells: [] };
    for (const [dx, dz] of [[-11, -7], [9, -9], [-12, 8], [11, 8]]) { A.houses.push({ x: hx + dx, z: hz + dz, r: face(hx + dx, hz + dz) }); colliders.push({ x: hx + dx, z: hz + dz, r: 3.6 }); }
    for (const [dx, dz] of [[-5, 4.5], [5, 4.5]]) { A.stalls.push({ x: hx + dx, z: hz + dz, r: face(hx + dx, hz + dz) }); colliders.push({ x: hx + dx, z: hz + dz, r: 1.5 }); }
    for (const [dx, dz] of [[4, -4], [-4, -4]]) A.benches.push({ x: hx + dx, z: hz + dz, r: face(hx + dx, hz + dz) });
    A.wells.push({ x: hx, z: hz, r: 0 }); colliders.push({ x: hx, z: hz, r: 1.2 });
    for (const [dx, dz] of [[-14.2, -5.6], [-13.2, -6.6], [12.5, -7], [14, 10.5], [-15, 6.5]]) { A.barrels.push({ x: hx + dx, z: hz + dz, r: rr() }); colliders.push({ x: hx + dx, z: hz + dz, r: 0.45 }); }
    for (const [dx, dz] of [[-14.7, -4], [13.2, 11.3]]) { A.crates.push({ x: hx + dx, z: hz + dz, r: rr() }); colliders.push({ x: hx + dx, z: hz + dz, r: 0.4 }); }
    A.signs.push({ x: hx + 15, z: hz - 2.2, r: Math.PI / 2 });
    // camino desde la ruta del sur hasta la aldea y a cada casa
    road(0, hz, hx + 17, hz); road(hx + 17, hz, hx + 3, hz);
    for (const h of A.houses) {
      const dx = h.x - hx, dz = h.z - hz, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
      road(hx + ux * 3, hz + uz * 3, h.x - ux * 4.6, h.z - uz * 4.6);
    }
    // plaza de tierra
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28), new THREE.MeshLambertMaterial({ color: 0x9a8b73 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(hx, 0.03, hz); plaza.receiveShadow = true; scene.add(plaza);
    const cot = { raw: true, ox: -3.0, oz: 3.0, shadow: true, nearest: true };
    queue('v_cottage', A.houses, cot);
    queue('v_stall', A.stalls, { raw: true, ox: -1.0, oz: 0.6, shadow: true, nearest: true });
    queue('v_well', A.wells, { raw: true, ox: -0.07, shadow: true, nearest: true });
    queue('p_public_bench', A.benches, { raw: true, nearest: true });
    queue('p_barrel', A.barrels, { raw: true, shadow: true, nearest: true });
    queue('p_crate', A.crates, { raw: true, shadow: true, nearest: true });
    queue('p_signpost', A.signs, { raw: true, nearest: true });
    // runas
    queue('rune-stone-circle', [{ x: hx - 26, z: hz - 14, r: 0 }], { w: 14, shadow: true });
    const hs = [[-4, -21], [23, -13], [-22, 17]].map(([dx, dz]) => ({ x: hx + dx, z: hz + dz, r: face(hx + dx, hz + dz) }));
    hs.forEach(s => colliders.push({ x: s.x, z: s.z, r: 2 }));
    queue('glowing-rune-waystone', hs, { w: 5, shadow: true });
    colliders.push({ x: hx - 34, z: hz + 11, r: 3.5 });
    queue('giant-fantasy-mushrooms', [{ x: hx - 34, z: hz + 11, r: 0 }], { w: 10, shadow: true });

    queue('p_path', tiles, { raw: true, ox: -0.5, oz: 0.5, nearest: true });

    // círculos mágicos gigantes que se encienden al acercarse a las runas de la aldea
    runes(G, [
      { x: hx - 26, z: hz - 14, R: 12, cA: '#b86bff', cB: '#66e0ff' },
      { x: hs[0].x, z: hs[0].z, R: 8, cA: '#ff9a3c', cB: '#ffe08a' },
      { x: hs[1].x, z: hs[1].z, R: 8, cA: '#5be36b', cB: '#d4ff8a' },
      { x: hs[2].x, z: hs[2].z, R: 8, cA: '#66d9ff', cB: '#e0f7ff' }
    ]);

    /* --- Vegetación (modelos livianos instanciados) --- */
    const veg = (cx, cz, rin, rout, m) => {
      area('lp_pine_tall', N(18 * m), cx, cz, rin, rout, { h: 12, col: 0.5, pad: 1.2 });
      area('lp_pine_tree', N(24 * m), cx, cz, rin, rout, { h: 8, col: 0.5, pad: 1.2 });
      area('lp_round_tree', N(12 * m), cx, cz, rin, rout, { h: 6.5, col: 0.5, pad: 1.2 });
      area('lp_birch_tree', N(10 * m), cx, cz, rin, rout, { h: 7.5, col: 0.4, pad: 1.2 });
      area('lp_bush_round', N(36 * m), cx, cz, rin, rout, { h: 1.3, col: 0.5, pad: 1 });
      area('lp_bush_berries', N(22 * m), cx, cz, rin, rout, { h: 1.2, col: 0.45, pad: 1 });
      area('lp_fern', N(90 * m), cx, cz, rin, rout, { h: 0.9, pad: 0.4 });
      area('lp_flower_red', N(26 * m), cx, cz, rin, rout, { h: 0.5, pad: 0.4 });
      area('lp_flower_yellow', N(26 * m), cx, cz, rin, rout, { h: 0.5, pad: 0.4 });
      area('lp_flower_purple', N(26 * m), cx, cz, rin, rout, { h: 0.5, pad: 0.4 });
      area('lp_grass_tuft', N(120 * m), cx, cz, rin, rout, { h: 0.7, pad: 0.2 });
      area('lp_mushroom_red', N(14 * m), cx, cz, rin, rout, { h: 0.5, pad: 0.4 });
      area('lp_rock_small', N(12 * m), cx, cz, rin, rout, { w: 1.0, pad: 0.4 });
      area('lp_boulder_mossy', N(4 * m), cx, cz, rin, rout, { w: 2.2, col: 1.0, pad: 1.5 });
      area('lp_fallen_log', N(3 * m), cx, cz, rin, rout, { w: 3.2, col: 0.8, pad: 1.5 });
      area('lp_tree_stump', N(4 * m), cx, cz, rin, rout, { h: 0.8, col: 0.4, pad: 1 });
    };
    veg(P.x, P.z, 9, 42, 1);       // alrededor del portal
    veg(hx, hz, 15, 40, 0.9);      // alrededor de la aldea de runas
    W.cfg = { P, H, k };
  }

  function worldPost(G) { // modelos del bosque encantado (más pesados): pocos, ya con bosque.js cargado
    const { PORTAL } = G, { H, k } = W.cfg, N = n => Math.max(1, Math.round(n * k));
    const area = makeArea(G, G.mulberry32(31337));
    const go = (cx, cz, rin, rout, m) => {
      area('f_young_tree', N(8 * m), cx, cz, rin, rout, { h: 7, col: 0.6, shadow: false, pad: 1.2 });
      area('f_elder_tree', N(3 * m), cx, cz, rin, rout, { h: 11, col: 0.8, shadow: false, pad: 2 });
      area('f_toad_red', N(8 * m), cx, cz, rin, rout, { h: 0.7, shadow: false, pad: 0.4 });
      area('f_toad_amethyst', N(6 * m), cx, cz, rin, rout, { h: 0.8, shadow: false, pad: 0.4 });
      area('f_boulder', N(2 * m), cx, cz, rin, rout, { w: 2.8, col: 1.2, shadow: false, pad: 1.5 });
    };
    go(PORTAL.x, PORTAL.z, 10, 40, 1);
    go(H.x, H.z, 16, 38, 0.8);
  }
  const W = {};

  /* =====================================================================
     2) OPTIMIZACIÓN (sin quitar texturas)
     ===================================================================== */
  function perf(G) {
    const { renderer, sun, me, camera, scene, TOUCH } = G;
    camera.far = 230; camera.updateProjectionMatrix();             // la niebla ya tapa lo de más lejos
    // Calidad: auto = nítido (hasta resolución nativa, máx 2x) y baja sola SOLO si va lento
    const cap = Math.min(window.devicePixelRatio || 1, 2);
    let q = 'auto'; try { q = localStorage.getItem('bm_q') || 'auto'; } catch (e) {}
    let maxDpr = cap, minDpr = Math.min(1, cap), cur = cap, auto = true;
    const setQ = v => {
      q = v; auto = v === 'auto';
      if (v === 'high') { maxDpr = minDpr = cap; }
      else if (v === 'mid') { maxDpr = minDpr = Math.min(cap, 1.25); }
      else if (v === 'low') { maxDpr = minDpr = Math.min(cap, 0.85); }
      else { maxDpr = cap; minDpr = Math.min(1, cap); }
      cur = maxDpr; apply();
      try { localStorage.setItem('bm_q', v); } catch (e) {}
    };
    const apply = () => { renderer.setPixelRatio(cur); renderer.setSize(innerWidth, innerHeight); };
    window.__setQ = setQ; window.__getQ = () => q;
    setQ(q);
    // sombras: siguen al jugador (más nítidas) y se actualizan cada 2 cuadros
    const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.far = 200; sc.updateProjectionMatrix();
    scene.add(sun.target);
    renderer.shadowMap.autoUpdate = false;
    const texel = 96 / 1024 * 32;
    let fr = 0, acc = 0, n = 0, cool = 0, every = 2, last = performance.now();
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = now - last; last = now; if (dt > 250) return;
      fr++; acc += dt; n++;
      const tx = Math.round(me.x / texel) * texel, tz = Math.round(me.z / texel) * texel;
      sun.target.position.set(tx, 0, tz); sun.position.set(tx + 40, 60, tz + 20);
      sun.target.updateMatrixWorld();
      if (fr % every === 0) renderer.shadowMap.needsUpdate = true;
      if (n >= 60) { // calidad dinámica: baja la resolución interna sólo si va lento
        const avg = acc / n; acc = 0; n = 0;
        if (auto && performance.now() > cool) {
          if (avg > 26 && cur > minDpr) { cur = Math.max(minDpr, cur - 0.15); every = Math.min(4, every + 1); apply(); cool = performance.now() + 3000; }
          else if (avg < 18.5 && cur < maxDpr) { cur = Math.min(maxDpr, cur + 0.1); every = Math.max(2, every - 1); apply(); cool = performance.now() + 5000; }
        }
      }
    }
    requestAnimationFrame(tick);
    // objetos instanciados estáticos: no recalcular matrices cada cuadro
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const smooth = o => { // texturas más suaves y nítidas de cerca (sin quitar nada)
      const m = o.material; if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) {
        const t = mm && mm.map; if (!t || t._bm) continue; t._bm = 1;
        if (t.magFilter === G.THREE.NearestFilter) { t.magFilter = G.THREE.LinearFilter; t.needsUpdate = true; }
        t.anisotropy = Math.max(t.anisotropy || 1, aniso);
      }
    };
    const freeze = () => scene.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) smooth(o);
      if (o.isInstancedMesh && o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    });
    setTimeout(freeze, 4000); setTimeout(freeze, 12000); setTimeout(freeze, 30000);
  }

  window.__MODS = {
    pre(G) {
      try { worldPre(G); } catch (e) { console.warn('mods.world', e); }
      try { perf(G); } catch (e) { console.warn('mods.perf', e); }
    },
    post(G) { try { worldPost(G); } catch (e) { console.warn('mods.post', e); } },
    cfg: () => W.cfg
  };

  /* =====================================================================
     3) CUENTAS (Supabase si hay config.js; si no, modo local en este dispositivo)
     ===================================================================== */
  const ERR = {
    bad_user: 'Usuario: 3 a 12 letras, números o _.', bad_pass: 'La contraseña debe tener 6 a 72 caracteres.',
    bad_email: 'El correo no es válido.', user_taken: 'Ese nombre de usuario ya existe.', email_taken: 'Ese correo ya está registrado.',
    bad_login: 'Usuario o contraseña incorrectos.', locked: 'Demasiados intentos. Esperá 1 minuto.', banned: '⛔ Esta cuenta está suspendida.',
    net: 'No se pudo conectar con el servidor de cuentas.'
  };

  const Remote = {
    tok: null,
    async rpc(name, args) {
      const h = { apikey: CFG.key, 'Content-Type': 'application/json' };
      if (CFG.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + CFG.key;
      const r = await fetch(`${CFG.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
      const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || ('HTTP ' + r.status));
      return d;
    },
    async signup(u, p, e) { try { const c = await this.rpc('register', { u, p, e }); return c === 'ok' ? { ok: true } : { ok: false, error: ERR[c] || c }; } catch (x) { return { ok: false, error: ERR.net + ' (' + x.message + ')' }; } },
    async login(u, p) {
      try {
        const d = await this.rpc('login', { u, p });
        if (d.error) return { ok: false, error: ERR[d.error] || d.error };
        this.tok = d.token; return { ok: true, profile: { username: d.username, is_admin: !!d.is_admin } };
      } catch (x) { return { ok: false, error: ERR.net + ' (' + x.message + ')' }; }
    },
    async heartbeat() { try { await this.rpc('heartbeat', { tok: this.tok }); } catch (e) {} },
    async logout() { try { await this.rpc('logout', { tok: this.tok }); } catch (e) {} },
    async friends() { const l = await this.rpc('friend_list', { tok: this.tok }); return (l || []).map(f => ({ fid: f.fid, username: f.username, status: f.status, incoming: f.incoming, online: f.last_seen && Date.now() - Date.parse(f.last_seen) < 120000 })); },
    request(u) { return this.rpc('friend_request', { tok: this.tok, uname: u }); },
    respond(fid, acc) { return this.rpc('friend_respond', { tok: this.tok, fid, accept: acc }); },
    remove(fid) { return this.rpc('friend_remove', { tok: this.tok, fid }); },
    adminUsers() { return this.rpc('admin_list_users', { tok: this.tok }); },
    adminBan(u, f) { return this.rpc('admin_set_ban', { tok: this.tok, uname: u, flag: f }); },
    adminSetAdmin(u, f) { return this.rpc('admin_set_admin', { tok: this.tok, uname: u, flag: f }); }
  };

  const Local = { // sólo para probar: todo queda en este navegador
    me: null,
    users() { try { return JSON.parse(localStorage.getItem('bm_users') || '{}'); } catch (e) { return {}; } },
    save(u) { try { localStorage.setItem('bm_users', JSON.stringify(u)); } catch (e) {} },
    async hash(p, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); },
    async signup(u, p, e) {
      const us = this.users(); if (us[lc(u)]) return { ok: false, error: ERR.user_taken };
      if (Object.values(us).some(x => lc(x.email) === lc(e))) return { ok: false, error: ERR.email_taken };
      const salt = Math.random().toString(36).slice(2); us[lc(u)] = { name: u, salt, hash: await this.hash(p, salt), email: e, friends: [], banned: false, admin: false };
      this.save(us); return { ok: true };
    },
    async login(u, p) {
      const us = this.users(), a = us[lc(u)];
      if (!a || a.hash !== await this.hash(p, a.salt)) return { ok: false, error: ERR.bad_login };
      if (a.banned) return { ok: false, error: ERR.banned };
      this.me = lc(u); return { ok: true, profile: { username: a.name, is_admin: a.admin || CFG.admins.map(lc).includes(lc(u)) } };
    },
    async heartbeat() {}, async logout() {},
    async friends() { const us = this.users(); return (us[this.me].friends || []).map((n, i) => ({ fid: n, username: us[n] ? us[n].name : n, status: 'accepted', incoming: false, online: false })); },
    async request(u) { const us = this.users(), t = us[lc(u)]; if (!t) return 'not_found'; if (lc(u) === this.me) return 'self'; if (us[this.me].friends.includes(lc(u))) return 'already'; us[this.me].friends.push(lc(u)); t.friends.push(this.me); this.save(us); return 'accepted'; },
    async respond() {}, async remove(fid) { const us = this.users(); us[this.me].friends = us[this.me].friends.filter(x => x !== fid); if (us[fid]) us[fid].friends = us[fid].friends.filter(x => x !== this.me); this.save(us); },
    async adminUsers() { return Object.values(this.users()).map(a => ({ username: a.name, email: a.email, is_admin: a.admin, banned: a.banned })); },
    async adminBan(u, f) { const us = this.users(); if (us[lc(u)]) us[lc(u)].banned = f; this.save(us); },
    async adminSetAdmin(u, f) { const us = this.users(); if (us[lc(u)]) us[lc(u)].admin = f; this.save(us); }
  };
  const API = REMOTE ? Remote : Local;

  /* =====================================================================
     4) INTERFAZ: login/registro, amigos, admin
     ===================================================================== */
  function injectCss() {
    const s = document.createElement('style');
    s.textContent = `
      .card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(18,28,18,.93)!important}
      #bmAuth input,.bmP input{text-transform:none!important}
      #bmMsg,.bmM{min-height:1.2em;font-size:13px;color:#ffd77a}
      #bmWho{display:flex;justify-content:space-between;align-items:center;gap:8px}
      #bmWho button{padding:6px 10px;font-size:12px}
      .bmP{z-index:30;top:50%;left:50%;transform:translate(-50%,-50%);width:min(350px,93vw);max-height:82vh;overflow:auto}
      .bmP h4{margin:0;display:flex;justify-content:space-between;align-items:center}
      .bmP h4 button{padding:4px 10px}
      .bmI{display:flex;justify-content:space-between;align-items:center;gap:6px;background:#35503a;border-radius:8px;padding:6px 8px;font-size:13px}
      .bmI button{padding:4px 8px;font-size:12px;min-width:30px}
      .bmD{display:inline-block;width:9px;height:9px;border-radius:50%;background:#777;margin-right:6px}.bmD.on{background:#5be36b}
      .bmT{font-size:11px;opacity:.7}
    `;
    document.head.appendChild(s);
  }
  const noKeys = el => ['keydown', 'keyup', 'keypress'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));

  let user = null, hbTimer = 0;
  function initUI() {
    const lobby = $('lobby'); if (!lobby) return;
    injectCss();
    const main = lobby.querySelector('.card'); main.style.display = 'none';
    const auth = document.createElement('div'); auth.className = 'card'; auth.id = 'bmAuth';
    auth.innerHTML = `
      <div class="chars" id="bmTabs"><button data-t="login" class="sel">🔑 Iniciar sesión</button><button data-t="reg">📝 Registrarse</button></div>
      <input id="bmU" maxlength="12" placeholder="👤 Nombre de usuario" autocomplete="username" autocapitalize="off" spellcheck="false">
      <input id="bmE" type="email" placeholder="✉️ Correo electrónico" autocomplete="email" style="display:none">
      <input id="bmP" type="password" placeholder="🔒 Contraseña" autocomplete="current-password">
      <input id="bmP2" type="password" placeholder="🔒 Repetir contraseña" autocomplete="new-password" style="display:none">
      <button id="bmGo">Entrar</button>
      <div id="bmMsg">${REMOTE ? '' : '⚠️ Modo local: las cuentas sólo existen en este dispositivo.'}</div>`;
    lobby.appendChild(auth);
    ['bmU', 'bmE', 'bmP', 'bmP2'].forEach(i => { noKeys($(i)); $(i).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }); });
    try { $('bmU').value = localStorage.getItem('bm_last') || ''; } catch (e) {}
    let mode = 'login';
    const setMode = m => {
      mode = m; auth.querySelectorAll('#bmTabs button').forEach(b => b.classList.toggle('sel', b.dataset.t === m));
      $('bmE').style.display = $('bmP2').style.display = m === 'reg' ? '' : 'none';
      $('bmGo').textContent = m === 'reg' ? 'Crear cuenta' : 'Entrar';
      $('bmP').autocomplete = m === 'reg' ? 'new-password' : 'current-password'; $('bmMsg').textContent = '';
    };
    auth.querySelectorAll('#bmTabs button').forEach(b => b.onclick = () => setMode(b.dataset.t));
    const msg = t => { $('bmMsg').textContent = t; };
    let busy = false;
    async function submit() {
      if (busy) return;
      const u = $('bmU').value.trim(), p = $('bmP').value;
      if (!/^[A-Za-z0-9_]{3,12}$/.test(u)) return msg(ERR.bad_user);
      if (p.length < 6) return msg('La contraseña debe tener al menos 6 caracteres.');
      let e = '';
      if (mode === 'reg') {
        e = $('bmE').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return msg(ERR.bad_email);
        if (p !== $('bmP2').value) return msg('Las contraseñas no coinciden.');
      }
      busy = true; $('bmGo').disabled = true; msg('Un momento…');
      let r;
      if (mode === 'reg') { r = await API.signup(u, p, e); if (r.ok) r = await API.login(u, p); }
      else r = await API.login(u, p);
      busy = false; $('bmGo').disabled = false;
      if (!r.ok) return msg(r.error);
      try { localStorage.setItem('bm_last', u); } catch (x) {}
      $('bmP').value = $('bmP2').value = '';
      onLogin(r.profile, main, auth);
    }
    $('bmGo').onclick = submit;
  }

  function onLogin(profile, main, auth) {
    user = profile; auth.style.display = 'none'; main.style.display = window.__BM_MENU ? 'none' : '';
    const nm = $('name'); nm.value = (profile.is_admin ? '★' : '') + profile.username; nm.style.display = 'none';
    const who = document.createElement('div'); who.id = 'bmWho';
    who.innerHTML = `<span>👤 <b>${esc(profile.username)}</b>${profile.is_admin ? ' <span class="bmT">ADMIN</span>' : ''}</span><span><button class="alt" id="bmFrB">👥 Amigos</button> ${profile.is_admin ? '<button class="alt" id="bmAdB">🛠️</button> ' : ''}<button class="alt" id="bmOut">Salir</button></span>`;
    main.insertBefore(who, main.firstChild);
    $('bmFrB').onclick = () => togglePanel('bmFr'); if (profile.is_admin) $('bmAdB').onclick = () => togglePanel('bmAd');
    $('bmOut').onclick = async () => { await API.logout(); location.reload(); };
    const btns = $('btns');
    if (btns) {
      const b = document.createElement('button'); b.textContent = '👥'; b.onclick = () => togglePanel('bmFr'); btns.appendChild(b);
      if (profile.is_admin) { const a = document.createElement('button'); a.textContent = '🛠️'; a.onclick = () => togglePanel('bmAd'); btns.appendChild(a); }
    }
    buildFriends(); if (profile.is_admin) buildAdmin();
    const st = $('settings');
    if (st && window.__setQ && !$('bmQ')) {
      const l = document.createElement('label');
      l.innerHTML = '🖼️ Calidad <select id="bmQ"><option value="auto">Automática</option><option value="high">Alta (más nítida)</option><option value="mid">Media</option><option value="low">Baja (más fluido)</option></select>';
      st.appendChild(l); const sel = $('bmQ'); sel.value = window.__getQ(); sel.onchange = () => window.__setQ(sel.value);
    }
    window.__bm = { getUser: () => user, panel: togglePanel };
    if (window.__BM_MENU && window.__menuStart) window.__menuStart(profile);
    API.heartbeat(); clearInterval(hbTimer); hbTimer = setInterval(() => API.heartbeat(), 60000);
  }

  function panel(id, title) {
    const p = document.createElement('div'); p.id = id; p.className = 'panel bmP';
    p.innerHTML = `<h4><span>${title}</span><button class="alt" data-x>✖</button></h4><div class="bmBody" style="display:flex;flex-direction:column;gap:8px"></div>`;
    p.querySelector('[data-x]').onclick = () => p.classList.remove('open');
    document.body.appendChild(p); return p;
  }
  function togglePanel(id) {
    const p = $(id); if (!p) return; const open = !p.classList.contains('open');
    ['bmFr', 'bmAd'].forEach(x => $(x) && $(x).classList.remove('open'));
    if (open) { p.classList.add('open'); if (p._refresh) p._refresh(); }
  }

  /* --- Amigos --- */
  function buildFriends() {
    const p = panel('bmFr', '👥 Amigos'), body = p.querySelector('.bmBody');
    body.innerHTML = `<div class="row"><input id="bmFN" maxlength="12" placeholder="Usuario de tu amigo"><button id="bmFA">Agregar</button></div><div class="bmM" id="bmFM"></div><div id="bmFL" style="display:flex;flex-direction:column;gap:6px"></div>`;
    noKeys($('bmFN'));
    const m = t => { $('bmFM').textContent = t; };
    const TXT = { sent: '✅ Solicitud enviada.', accepted: '🤝 ¡Ya son amigos!', already: 'Ya son amigos.', pending: 'Ya hay una solicitud pendiente.', not_found: 'No existe ese usuario.', self: 'Ese sos vos 😄', no_auth: 'Iniciá sesión de nuevo.' };
    async function refresh() {
      let l; try { l = await API.friends(); } catch (e) { $('bmFL').textContent = 'No se pudo cargar la lista.'; return; }
      if (!l.length) { $('bmFL').innerHTML = '<div class="bmT">Todavía no tenés amigos. Agregá uno por su nombre de usuario.</div>'; return; }
      const incoming = l.filter(f => f.status === 'pending' && f.incoming), out = l.filter(f => f.status === 'pending' && !f.incoming), ok = l.filter(f => f.status === 'accepted');
      const row = (f, btns) => `<div class="bmI"><span><i class="bmD ${f.online ? 'on' : ''}"></i>${esc(f.username)}${f.status === 'accepted' ? (f.online ? ' <span class="bmT">en línea</span>' : '') : ''}</span><span>${btns}</span></div>`;
      $('bmFL').innerHTML =
        (incoming.length ? '<div class="bmT">Solicitudes recibidas</div>' + incoming.map(f => row(f, `<button data-a="y" data-id="${esc(f.fid)}">✔</button> <button class="alt" data-a="n" data-id="${esc(f.fid)}">✖</button>`)).join('') : '') +
        (ok.length ? '<div class="bmT">Amigos</div>' + ok.map(f => row(f, `<button class="alt" data-a="d" data-id="${esc(f.fid)}">Quitar</button>`)).join('') : '') +
        (out.length ? '<div class="bmT">Enviadas</div>' + out.map(f => row(f, `<button class="alt" data-a="d" data-id="${esc(f.fid)}">Cancelar</button>`)).join('') : '');
    }
    $('bmFL').onclick = async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.dataset.id, fid = /^\d+$/.test(id) ? +id : id;
      try { if (b.dataset.a === 'y') await API.respond(fid, true); else if (b.dataset.a === 'n') await API.respond(fid, false); else await API.remove(fid); } catch (x) { m('Error: ' + x.message); }
      refresh();
    };
    $('bmFA').onclick = async () => {
      const u = $('bmFN').value.trim(); if (!u) return;
      try { const r = await API.request(u); m(TXT[r] || r); $('bmFN').value = ''; } catch (x) { m('Error: ' + x.message); }
      refresh();
    };
    $('bmFN').addEventListener('keydown', e => { if (e.key === 'Enter') $('bmFA').click(); });
    p._refresh = refresh;
    setInterval(() => { if (p.classList.contains('open')) refresh(); }, 30000);
  }

  /* --- Admin --- */
  function announce(text) {
    if (!window.mqtt) return;
    ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'].forEach(u => {
      try {
        const c = mqtt.connect(u, { clientId: 'bga-' + Math.random().toString(36).slice(2, 10), connectTimeout: 6000, reconnectPeriod: 0 });
        c.on('connect', () => c.publish('bgame-v1/global', JSON.stringify({ n: '📢 ADMIN', m: text.slice(0, 120) }), () => c.end()));
        c.on('error', () => { try { c.end(true); } catch (e) {} });
        setTimeout(() => { try { c.end(true); } catch (e) {} }, 9000);
      } catch (e) {}
    });
  }
  function buildAdmin() {
    const p = panel('bmAd', '🛠️ Administrador'), body = p.querySelector('.bmBody'); let god = false;
    body.innerHTML = `
      <div class="bmT">Teletransporte</div>
      <div class="row"><button class="alt" data-tp="0,14">Plaza</button><button class="alt" data-tp="0,124">Portal</button><button class="alt" data-tp="HAM">Aldea runas</button></div>
      <button class="alt" id="bmGod">❤️ Vida y energía infinitas: NO</button>
      <div class="bmT">Herramientas</div>
      <div class="row"><button class="alt" data-t="heal">💚 Curar</button><button class="alt" data-t="kill">💀 Matar monstruos</button></div>
      <div class="row"><button class="alt" data-t="cd">⏱️ Sin recarga: NO</button><button class="alt" data-t="portal">🌀 Invocar portal</button></div>
      <div class="row"><button class="alt" data-t="sun">☀️ Día</button><button class="alt" data-t="night">🌙 Noche</button></div>
      <div class="bmT">Anuncio a todos los jugadores</div>
      <div class="row"><input id="bmAN" maxlength="120" placeholder="Mensaje global"><button id="bmAS">Enviar</button></div>
      <div class="bmT">Usuarios</div><button class="alt" id="bmAL">↻ Actualizar lista</button><div id="bmAU" style="display:flex;flex-direction:column;gap:6px"></div><div class="bmM" id="bmAM"></div>`;
    noKeys($('bmAN'));
    body.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
      const G = window.__G; if (!G) return; let x, z;
      if (b.dataset.tp === 'HAM') { const H = W.cfg && W.cfg.H; if (!H) return; x = H.x + 17; z = H.z; } else [x, z] = b.dataset.tp.split(',').map(Number);
      G.me.x = x; G.me.z = z;
    });
    body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const G = window.__G; if (!G || !G.me) return; const t = b.dataset.t;
      if (t === 'heal') { G.me.hp = 100; G.me.en = 100; G.me.exh = false; }
      else if (t === 'kill') { (G.monsters || []).forEach(m => { try { if (!m.dead) G.hurt(m, 1e6, []); } catch (e) {} }); }
      else if (t === 'cd') { window.__noCd = !window.__noCd; b.textContent = '⏱️ Sin recarga: ' + (window.__noCd ? 'SÍ' : 'NO'); }
      else if (t === 'portal') { try { G.spawnPortal(); } catch (e) {} }
      else if (t === 'sun' || t === 'night') { try { G.sun && (G.sun.intensity = t === 'sun' ? 1.6 : .15); } catch (e) {} }
    });
    $('bmGod').onclick = () => { god = !god; $('bmGod').textContent = '❤️ Vida y energía infinitas: ' + (god ? 'SÍ' : 'NO'); };
    setInterval(() => { const G = window.__G; if (god && G && G.me) { G.me.hp = 100; G.me.en = 100; G.me.exh = false; } }, 200);
    $('bmAS').onclick = () => { const t = $('bmAN').value.trim(); if (t) { announce(t); $('bmAN').value = ''; $('bmAM').textContent = 'Anuncio enviado.'; } };
    async function list() {
      let l; try { l = await API.adminUsers(); } catch (e) { $('bmAM').textContent = 'Error: ' + e.message; return; }
      $('bmAU').innerHTML = (l || []).map(u => `<div class="bmI"><span>${esc(u.username)}${u.is_admin ? ' ★' : ''}${u.banned ? ' ⛔' : ''}<br><span class="bmT">${esc(u.email || '')}</span></span><span><button class="alt" data-b="${esc(u.username)}" data-f="${u.banned ? 0 : 1}">${u.banned ? 'Desbanear' : 'Banear'}</button> <button class="alt" data-m="${esc(u.username)}" data-f="${u.is_admin ? 0 : 1}">${u.is_admin ? '−Admin' : '+Admin'}</button></span></div>`).join('');
    }
    $('bmAL').onclick = list; p._refresh = list;
    $('bmAU').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      try { if (b.dataset.b) await API.adminBan(b.dataset.b, b.dataset.f === '1'); else if (b.dataset.m) await API.adminSetAdmin(b.dataset.m, b.dataset.f === '1'); } catch (x) { $('bmAM').textContent = 'Error: ' + x.message; }
      list();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI); else initUI();
})();
