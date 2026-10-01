/* Saha GPS - IndexedDB deposu. Global `SahaDepo`.
   Magazalar: paketler (ozet), paket_veri (tam paket), olcumler (paket_id dizinli),
   fotolar (olcum_id -> data URL; liste ekraninda yuklenmez), ayarlar.
   IndexedDB yoksa (ozel gezinti vb.) oturum boyunca bellekte calisir; `kalici` false olur. */
(function (kok) {
  'use strict';
  var AD = 'saha_gps', SURUM = 1;
  var MAGAZALAR = {
    paketler: { anahtar: 'paket_id' },
    paket_veri: { anahtar: 'paket_id' },
    olcumler: { anahtar: 'olcum_id', dizin: 'paket_id' },
    fotolar: { anahtar: 'olcum_id' },
    ayarlar: { anahtar: 'k' }
  };

  var durum = { kalici: false, hazir: null, db: null, bellek: {} };

  function istek(r) {
    return new Promise(function (coz, red) {
      r.onsuccess = function () { coz(r.result); };
      r.onerror = function () { red(r.error); };
    });
  }
  function islemBitti(tx) {
    return new Promise(function (coz, red) {
      tx.oncomplete = function () { coz(); };
      tx.onerror = function () { red(tx.error); };
      tx.onabort = function () { red(tx.error || new Error('islem iptal')); };
    });
  }

  function bellekHazirla() {
    Object.keys(MAGAZALAR).forEach(function (m) { durum.bellek[m] = {}; });
    durum.kalici = false;
  }

  function hazirla() {
    if (durum.hazir) return durum.hazir;
    durum.hazir = new Promise(function (coz) {
      var idb = null;
      try { idb = kok.indexedDB; } catch (e) { idb = null; }
      if (!idb) { bellekHazirla(); coz(); return; }
      var acma;
      try { acma = idb.open(AD, SURUM); } catch (e) { bellekHazirla(); coz(); return; }
      // Bazi ortamlarda (file://, kisitli gezinti) open hic cevap vermez: 4 sn sonra bellege dus.
      var zamanAsimi = setTimeout(function () {
        if (!durum.db && !durum.kalici) { bellekHazirla(); coz(); }
      }, 4000);
      acma.onupgradeneeded = function () {
        var db = acma.result;
        Object.keys(MAGAZALAR).forEach(function (ad) {
          if (db.objectStoreNames.contains(ad)) return;
          var s = db.createObjectStore(ad, { keyPath: MAGAZALAR[ad].anahtar });
          if (MAGAZALAR[ad].dizin) s.createIndex(MAGAZALAR[ad].dizin, MAGAZALAR[ad].dizin, { unique: false });
        });
      };
      acma.onsuccess = function () {
        clearTimeout(zamanAsimi);
        if (Object.keys(durum.bellek).length) { acma.result.close(); return; } // gec geldi, bellek modu secildi
        durum.db = acma.result; durum.kalici = true; coz();
      };
      acma.onerror = function () { bellekHazirla(); coz(); };
      acma.onblocked = function () { bellekHazirla(); coz(); };
    });
    return durum.hazir;
  }

  /* ---- dusuk seviye ---- */
  function al(m, k) {
    return hazirla().then(function () {
      if (!durum.kalici) return durum.bellek[m][k];
      return istek(durum.db.transaction(m, 'readonly').objectStore(m).get(k));
    });
  }
  function koy(m, v) {
    return hazirla().then(function () {
      if (!durum.kalici) { durum.bellek[m][v[MAGAZALAR[m].anahtar]] = v; return; }
      var tx = durum.db.transaction(m, 'readwrite');
      tx.objectStore(m).put(v);
      return islemBitti(tx);
    });
  }
  function sil(m, k) {
    return hazirla().then(function () {
      if (!durum.kalici) { delete durum.bellek[m][k]; return; }
      var tx = durum.db.transaction(m, 'readwrite');
      tx.objectStore(m).delete(k);
      return islemBitti(tx);
    });
  }
  function hepsi(m) {
    return hazirla().then(function () {
      if (!durum.kalici) return Object.keys(durum.bellek[m]).map(function (k) { return durum.bellek[m][k]; });
      return istek(durum.db.transaction(m, 'readonly').objectStore(m).getAll());
    });
  }
  function dizinle(m, deger) {
    return hazirla().then(function () {
      if (!durum.kalici) {
        var alan = MAGAZALAR[m].dizin;
        return Object.keys(durum.bellek[m]).map(function (k) { return durum.bellek[m][k]; })
          .filter(function (v) { return v[alan] === deger; });
      }
      return istek(durum.db.transaction(m, 'readonly').objectStore(m).index(MAGAZALAR[m].dizin).getAll(deger));
    });
  }

  /* ---- ust seviye ---- */
  function ayarGetir(k) { return al('ayarlar', k).then(function (r) { return r ? r.v : null; }); }
  function ayarKaydet(k, v) { return koy('ayarlar', { k: k, v: v }); }

  function paketKaydet(paket) {
    var ozet = {
      paket_id: paket.paket_id, lokasyon_ad: paket.lokasyon.ad, olusturma: paket.olusturma,
      yuklenme: new Date().toISOString(), cihaz_sayisi: paket.cihazlar.length
    };
    return koy('paket_veri', { paket_id: paket.paket_id, paket: paket }).then(function () {
      return koy('paketler', ozet);
    });
  }
  function paketGetir(id) { return al('paket_veri', id).then(function (r) { return r ? r.paket : null; }); }

  // Liste ekrani: tam paketi ve fotolari YUKLEMEZ; yalniz ozet + olculen sayisi.
  function paketListesi() {
    return hepsi('paketler').then(function (liste) {
      return Promise.all(liste.map(function (p) {
        return dizinle('olcumler', p.paket_id).then(function (o) {
          var macler = {}, ekstra = 0, gonderilmemis = 0;
          o.forEach(function (x) {
            if (x.mac) macler[x.mac] = true; else ekstra++;
            if (!x.gonderildi) gonderilmemis++;
          });
          return Object.assign({}, p, { olculen: Object.keys(macler).length, ekstra: ekstra, gonderilmemis: gonderilmemis });
        });
      })).then(function (s) {
        return s.sort(function (a, b) { return String(b.yuklenme).localeCompare(String(a.yuklenme)); });
      });
    });
  }

  function olcumlerGetir(paketId) { return dizinle('olcumler', paketId); }

  // Ayni MAC icin yalniz son olcum tutulur (eskisi + fotosu silinir).
  // Hep ya hep hic: olcum + foto + eskilerin silinmesi TEK readwrite transaction'da.
  // Once yeni yazilir, sonra eskiler silinir; herhangi bir adim dusse transaction geri alinir.
  function olcumKaydet(olcum, foto) {
    return hazirla().then(function () {
      if (!durum.kalici) {
        var om = durum.bellek.olcumler, fm = durum.bellek.fotolar;
        om[olcum.olcum_id] = olcum;
        if (foto) fm[olcum.olcum_id] = { olcum_id: olcum.olcum_id, foto: foto }; else delete fm[olcum.olcum_id];
        if (olcum.mac) {
          Object.keys(om).forEach(function (k) {
            var x = om[k];
            if (x.paket_id === olcum.paket_id && x.mac === olcum.mac && x.olcum_id !== olcum.olcum_id) { delete om[k]; delete fm[k]; }
          });
        }
        return;
      }
      var tx = durum.db.transaction(['olcumler', 'fotolar'], 'readwrite');
      var os = tx.objectStore('olcumler'), fs = tx.objectStore('fotolar');
      os.put(olcum);
      if (foto) fs.put({ olcum_id: olcum.olcum_id, foto: foto }); else fs.delete(olcum.olcum_id);
      if (olcum.mac) {
        var rq = os.index('paket_id').getAll(olcum.paket_id);
        rq.onsuccess = function () {
          rq.result.forEach(function (x) {
            if (x.mac === olcum.mac && x.olcum_id !== olcum.olcum_id) { os.delete(x.olcum_id); fs.delete(x.olcum_id); }
          });
        };
      }
      return islemBitti(tx);
    });
  }
  function olcumSil(olcumId) {
    return hazirla().then(function () {
      if (!durum.kalici) { delete durum.bellek.olcumler[olcumId]; delete durum.bellek.fotolar[olcumId]; return; }
      var tx = durum.db.transaction(['olcumler', 'fotolar'], 'readwrite');
      tx.objectStore('olcumler').delete(olcumId);
      tx.objectStore('fotolar').delete(olcumId);
      return islemBitti(tx);
    });
  }
  function fotoGetir(olcumId) { return al('fotolar', olcumId).then(function (r) { return r ? r.foto : null; }); }

  function gonderildiIsaretle(olcumler, zaman) {
    return Promise.all(olcumler.map(function (o) {
      return al('olcumler', o.olcum_id).then(function (g) {
        if (!g) return;
        g.gonderildi = zaman;
        return koy('olcumler', g);
      });
    }));
  }

  function paketSil(id) {
    return olcumlerGetir(id).then(function (liste) {
      return Promise.all(liste.map(function (x) { return olcumSil(x.olcum_id); }));
    }).then(function () { return sil('paket_veri', id); }).then(function () { return sil('paketler', id); });
  }

  kok.SahaDepo = {
    hazirla: hazirla, kaliciMi: function () { return durum.kalici; },
    ayarGetir: ayarGetir, ayarKaydet: ayarKaydet,
    paketKaydet: paketKaydet, paketGetir: paketGetir, paketListesi: paketListesi, paketSil: paketSil,
    olcumlerGetir: olcumlerGetir, olcumKaydet: olcumKaydet, olcumSil: olcumSil,
    fotoGetir: fotoGetir, gonderildiIsaretle: gonderildiIsaretle
  };
})(typeof self !== 'undefined' ? self : this);
