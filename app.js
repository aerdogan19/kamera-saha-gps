/* Saha GPS - arayuz. Paket/sonuc kullanici girdisidir: yalniz createElement + textContent kullanilir;
   innerHTML/eval/fetch/XHR YOK. Resimler yalniz data:image/jpeg;base64 desenine uyarsa atanir. */
(function () {
  'use strict';
  var M = window.SahaMantik, D = window.SahaDepo;
  var kok = document.getElementById('uygulama');
  var bildirimKutu = document.getElementById('bildirim');

  var durum = {
    olcen: '', paket: null, olcumler: [], gecmis: [], temizlik: null, bildirimZaman: null, kapsam: {}
  };

  var TIP_SIMGE = { kamera: '📷', nvr: '🗄️', access_point: '📡', ap: '📡', yazici: '🖨️', pc: '💻', switch: '🔀' };
  var SINIF_METNI = {
    iyi: 'İyi doğruluk', kabul: 'Kabul edilebilir', kotu: 'Doğruluk zayıf',
    red: 'Çok zayıf: kaydetme önerilmez'
  };

  /* ---------- yardimcilar ---------- */
  function el(etiket, secenek, cocuklar) {
    var e = document.createElement(etiket);
    secenek = secenek || {};
    if (secenek.s) e.className = secenek.s;
    if (secenek.t !== undefined) e.textContent = secenek.t;
    if (secenek.a) Object.keys(secenek.a).forEach(function (k) { e.setAttribute(k, secenek.a[k]); });
    if (secenek.on) Object.keys(secenek.on).forEach(function (k) { e.addEventListener(k, secenek.on[k]); });
    (cocuklar || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function bosalt(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function guvenliResim(src, alt, sinif) {
    if (!M.jpegDataUrlGecerliMi(src)) return null;
    var i = document.createElement('img');
    i.className = sinif || '';
    i.alt = alt || '';
    i.src = src;
    return i;
  }
  function dugme(metin, sinif, tikla) {
    return el('button', { s: 'dugme ' + (sinif || ''), t: metin, a: { type: 'button' }, on: { click: tikla } });
  }
  function sayiYaz(x) { return x.toFixed(1).replace('.', ','); }
  function tarihYaz(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  }
  function bildir(mesaj, tur) {
    bildirimKutu.textContent = mesaj;
    bildirimKutu.className = 'bildirim gorunur ' + (tur || '');
    if (durum.bildirimZaman) clearTimeout(durum.bildirimZaman);
    durum.bildirimZaman = setTimeout(function () { bildirimKutu.className = 'bildirim'; }, 4500);
  }
  function hataGoster(e) { bildir('Beklenmeyen hata: ' + (e && e.message ? e.message : e), 'hata'); }
  function temizle() {
    if (durum.temizlik) { var t = durum.temizlik; durum.temizlik = null; try { t(); } catch (e) { /* yut */ } }
  }

  /* ---------- gezinme ---------- */
  function git(ekranFn) {
    durum.gecmis.push(ekranFn);
    history.pushState({ n: durum.gecmis.length }, '');
    ciz(ekranFn);
  }
  function degistir(ekranFn) { // gecmise yeni kayit eklemeden yerinde yenile
    durum.gecmis[durum.gecmis.length - 1] = ekranFn;
    ciz(ekranFn);
  }
  function geri() {
    if (durum.gecmis.length > 1) history.back(); else ciz(durum.gecmis[0]);
  }
  function ciz(ekranFn) {
    temizle();
    bosalt(kok);
    window.scrollTo(0, 0);
    Promise.resolve().then(ekranFn).catch(hataGoster);
  }
  window.addEventListener('popstate', function () {
    if (durum.gecmis.length > 1) durum.gecmis.pop();
    ciz(durum.gecmis[durum.gecmis.length - 1]);
  });

  function ustBar(baslik, altBaslik, geriVar) {
    return el('header', { s: 'ustbar' }, [
      geriVar ? el('button', { s: 'geri', t: '← Geri', a: { type: 'button', 'aria-label': 'Geri' }, on: { click: geri } }) : null,
      el('div', { s: 'baslik-blok' }, [
        el('h1', { t: baslik }),
        altBaslik ? el('p', { s: 'alt-baslik', t: altBaslik }) : null
      ])
    ]);
  }

  /* ---------- ilk ekran ---------- */
  function paketYukle(dosya) {
    if (!dosya) return;
    if (dosya.size > 30 * 1024 * 1024) { bildir('Dosya çok büyük (30 MB üstü).', 'hata'); return; }
    var okuyucu = new FileReader();
    okuyucu.onerror = function () { bildir('Dosya okunamadı.', 'hata'); };
    okuyucu.onload = function () {
      var veri;
      try { veri = JSON.parse(String(okuyucu.result)); } catch (e) { bildir('Dosya geçerli bir JSON değil.', 'hata'); return; }
      var sonuc = M.paketDogrula(veri);
      if (!sonuc.ok) { bildir('Paket reddedildi: ' + sonuc.hatalar.join(' '), 'hata'); return; }
      var p = sonuc.paket;
      D.paketGetir(p.paket_id).then(function (varMi) {
        return D.paketKaydet(p).then(function () {
          bildir(varMi ? 'Paket güncellendi; önceki ölçümler korundu.' : 'Paket yüklendi.', 'tamam');
          if (sonuc.uyarilar.length) bildir(sonuc.uyarilar.join(' '), 'uyari');
          git(function () { return ekranPaket(p.paket_id); });
        });
      }).catch(hataGoster);
    };
    okuyucu.readAsText(dosya);
  }

  function ekranIlk() {
    var olcenGirdi = el('input', {
      s: 'girdi', a: { type: 'text', id: 'olcen', maxlength: '100', autocomplete: 'name', placeholder: 'Ad Soyad' }
    });
    olcenGirdi.value = durum.olcen;
    olcenGirdi.addEventListener('change', function () {
      durum.olcen = olcenGirdi.value.trim().slice(0, 100);
      D.ayarKaydet('olcen', durum.olcen).catch(hataGoster);
    });
    var dosyaGirdi = el('input', {
      s: 'gizli', a: { type: 'file', accept: '.json,.txt,application/json,text/plain' },
      on: { change: function () { var f = dosyaGirdi.files && dosyaGirdi.files[0]; dosyaGirdi.value = ''; paketYukle(f); } }
    });
    var liste = el('div', { s: 'paket-liste' });
    kok.appendChild(ustBar('Saha GPS', 'Kamera konumu toplama', false));
    var ana = el('main', { s: 'icerik' });
    if (!D.kaliciMi()) {
      ana.appendChild(el('div', { s: 'uyari-kutu' }, [
        el('p', { t: 'Kalıcı depolama açılamadı (özel gezinti ya da yavaş/kısıtlı depolama olabilir). Ölçümler sayfa kapanınca kaybolur; çıkmadan önce sonucu gönderin.' }),
        dugme('🔄 Sayfayı yenile ve tekrar dene', '', function () { window.location.reload(); })
      ]));
    }
    ana.appendChild(el('section', { s: 'kart-bolum' }, [
      el('label', { s: 'etiket', t: 'Ölçümü yapan kişi', a: { for: 'olcen' } }), olcenGirdi
    ]));
    ana.appendChild(el('section', { s: 'kart-bolum' }, [
      el('label', { s: 'dugme birincil buyuk', a: { tabindex: '0' } }, [document.createTextNode('📂 Paket yükle (.json / .txt)'), dosyaGirdi]),
      el('p', { s: 'ipucu', t: 'Masaüstü uygulamasının ürettiği saha GPS paketi dosyasını seçin.' })
    ]));
    ana.appendChild(el('h2', { t: 'Yüklü paketler' }));
    ana.appendChild(liste);
    kok.appendChild(ana);

    return D.paketListesi().then(function (paketler) {
      if (!paketler.length) liste.appendChild(el('p', { s: 'ipucu', t: 'Henüz paket yüklenmedi.' }));
      paketler.forEach(function (p) {
        var ilerleme = p.olculen + '/' + p.cihaz_sayisi;
        liste.appendChild(el('article', { s: 'paket-kart' }, [
          el('h3', { t: p.lokasyon_ad }),
          el('p', { s: 'ipucu', t: 'Paket: ' + tarihYaz(p.olusturma) + ' · Yüklendi: ' + tarihYaz(p.yuklenme) }),
          el('p', { t: 'Ölçülen: ' + ilerleme + (p.ekstra ? ' (+' + p.ekstra + ' ekstra)' : '') + (p.gonderilmemis ? ' · gönderilmemiş: ' + p.gonderilmemis : '') }),
          el('progress', { a: { max: String(Math.max(1, p.cihaz_sayisi)), value: String(p.olculen) } }),
          el('div', { s: 'satir' }, [
            dugme('Aç', 'birincil', function () { git(function () { return ekranPaket(p.paket_id); }); }),
            dugme('Sil', 'tehlike', function () {
              if (window.confirm('"' + p.lokasyon_ad + '" paketi ve ölçümleri bu telefondan silinsin mi? Gönderilmemiş ölçümler kaybolur.')) {
                D.paketSil(p.paket_id).then(function () { degistir(ekranIlk); }).catch(hataGoster);
              }
            })
          ])
        ]));
      });
    });
  }

  /* ---------- paket ekrani ---------- */
  function sonOlcumler() { // mac -> son olcum
    var h = {};
    durum.olcumler.forEach(function (o) {
      if (!o.mac) return;
      if (!h[o.mac] || String(o.zaman) >= String(h[o.mac].zaman)) h[o.mac] = o;
    });
    return h;
  }

  function rozet(olcum, esikler) {
    if (!olcum) return el('span', { s: 'rozet rozet-yok', t: 'Ölçülmedi' });
    var sinif = M.dogrulukSinifi(olcum.dogruluk_m, esikler);
    return el('span', { s: 'rozet rozet-' + sinif, t: '✔ Ölçüldü ±' + sayiYaz(olcum.dogruluk_m) + ' m' });
  }

  function cihazAdi(c) { return c.ad || c.model || c.mac; }

  function bilgiSatirlari(c) {
    var s = [];
    if (c.model && c.model !== c.ad) s.push(el('div', { t: c.model }));
    if (c.kanal) {
      var k = [];
      if (c.kanal.nvr_ad) k.push('NVR: ' + c.kanal.nvr_ad);
      if (c.kanal.kanal_no !== null) k.push('Kanal ' + c.kanal.kanal_no);
      if (c.kanal.kamera_adi) k.push(c.kanal.kamera_adi);
      if (k.length) s.push(el('div', { s: 'kanal', t: k.join(' · ') }));
    }
    if (c.seri_no) s.push(el('div', { t: 'Seri no: ' + c.seri_no }));
    s.push(el('div', { s: 'mac', t: c.mac }));
    return s;
  }

  function cihazKarti(c, olcum, esikler, ac) {
    var resim = guvenliResim(c.snapshot, 'Kamera görüntüsü', 'kart-resim');
    if (resim) resim.loading = 'lazy';
    var kart = el('div', { s: 'kart', a: { role: 'button', tabindex: '0' } }, [
      resim,
      el('div', { s: 'kart-govde' }, [
        el('div', { s: 'kart-baslik' }, [
          el('span', { s: 'simge', t: TIP_SIMGE[c.tip] || '🔌', a: { 'aria-hidden': 'true' } }),
          el('span', { t: cihazAdi(c) })
        ])
      ].concat(bilgiSatirlari(c), [rozet(olcum, esikler)]))
    ]);
    kart.addEventListener('click', ac);
    kart.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
    return kart;
  }

  function cihazAcFn(c) { return function () { git(function () { return ekranCihaz(c, null); }); }; }

  function ekranPaket(paketId) {
    return Promise.all([D.paketGetir(paketId), D.olcumlerGetir(paketId)]).then(function (s) {
      var paket = s[0];
      if (!paket) { bildir('Paket bulunamadı.', 'hata'); degistir(ekranIlk); return; }
      durum.paket = paket;
      durum.olcumler = s[1];
      var cihazMap = {};
      paket.cihazlar.forEach(function (c) { cihazMap[c.mac] = c; });
      durum.cihazMap = cihazMap;
      var son = sonOlcumler();
      var olculen = Object.keys(son).filter(function (m) { return cihazMap[m]; }).length;
      var toplam = paket.cihazlar.length;
      var gonderilmemis = durum.olcumler.filter(function (o) { return !o.gonderildi; }).length;

      var arama = el('input', { s: 'girdi', a: { type: 'search', placeholder: 'Ara: ad, model, seri no, MAC, kanal…', 'aria-label': 'Ara' } });
      var filtre = el('select', { s: 'girdi', a: { 'aria-label': 'Filtre' } }, [
        el('option', { t: 'Tüm cihazlar', a: { value: 'hepsi' } }),
        el('option', { t: 'Yalnız ölçülmeyenler', a: { value: 'olcumsuz' } }),
        el('option', { t: 'Yalnız ölçülenler', a: { value: 'olculen' } })
      ]);
      var listeKutu = el('div', { s: 'grup-liste' });

      function eslesir(c, q) {
        if (!q) return true;
        var havuz = [c.ad, c.model, c.seri_no, c.mac, c.kanal ? c.kanal.kamera_adi : '', c.kanal ? c.kanal.nvr_ad : '',
          c.kanal && c.kanal.kanal_no !== null ? 'kanal ' + c.kanal.kanal_no : ''].join(' ').toLocaleLowerCase('tr');
        return havuz.indexOf(q) !== -1;
      }
      function gorunurMu(c, q, f) {
        if (f === 'olcumsuz' && son[c.mac]) return false;
        if (f === 'olculen' && !son[c.mac]) return false;
        return eslesir(c, q);
      }

      function listeyiCiz() {
        bosalt(listeKutu);
        var q = arama.value.trim().toLocaleLowerCase('tr'), f = filtre.value, suzuluMu = !!q || f !== 'hepsi';
        paket.gruplar.forEach(function (g) {
          var govde = el('div', { s: 'grup-govde' }), sayac = 0, grupMac = {}, grupOlculen = 0;
          function say(mac) { if (cihazMap[mac] && !grupMac[mac]) { grupMac[mac] = true; if (son[mac]) grupOlculen++; } }
          function kartEkle(kutu, mac) {
            var c = cihazMap[mac];
            if (!c) return;
            say(mac);
            if (!gorunurMu(c, q, f)) return;
            sayac++;
            kutu.appendChild(cihazKarti(c, son[mac], paket.esikler, cihazAcFn(c)));
          }
          kartEkle(govde, g.sektor_mac);
          g.istasyonlar.forEach(function (i) {
            var ik = el('div', { s: 'istasyon' });
            if (i.istasyon_mac && i.istasyon_mac !== g.sektor_mac) {
              ik.appendChild(el('div', { s: 'istasyon-baslik', t: 'İstasyon' }));
              kartEkle(ik, i.istasyon_mac);
            }
            i.cihazlar.forEach(function (mac) { if (mac !== g.sektor_mac && mac !== i.istasyon_mac) kartEkle(ik, mac); });
            if (ik.childNodes.length) govde.appendChild(ik);
          });
          if (suzuluMu && !sayac) return;
          var topSayi = Object.keys(grupMac).length;
          var d = el('details', { s: 'grup' }, [
            el('summary', { t: g.ad + '  (' + grupOlculen + '/' + topSayi + ')' }), govde
          ]);
          if (suzuluMu) d.open = true;
          listeKutu.appendChild(d);
        });
        if (!listeKutu.firstChild) listeKutu.appendChild(el('p', { s: 'ipucu', t: 'Eşleşen cihaz yok.' }));
      }
      arama.addEventListener('input', listeyiCiz);
      filtre.addEventListener('change', listeyiCiz);

      var ekstralar = durum.olcumler.filter(function (o) { return !o.mac; });
      var ekstraKutu = el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Listede olmayan cihazlar (' + ekstralar.length + ')' })]);
      ekstralar.forEach(function (o) {
        ekstraKutu.appendChild(el('div', {
          s: 'kart ekstra-kart', a: { role: 'button', tabindex: '0' },
          on: { click: function () { git(function () { return ekranCihaz({ ekstra: true, mac: null, ad: 'Listede olmayan cihaz', tip: 'diger' }, o); }); } }
        }, [el('div', { s: 'kart-govde' }, [
          el('div', { s: 'kart-baslik', t: '➕ ' + (o['not'] || 'Not yok').slice(0, 60) }),
          rozet(o, paket.esikler)
        ])]));
      });

      kok.appendChild(ustBar(paket.lokasyon.ad, 'Paket: ' + tarihYaz(paket.olusturma), true));
      kok.appendChild(el('main', { s: 'icerik' }, [
        el('section', { s: 'kart-bolum' }, [
          el('p', { s: 'ilerleme-yazi', t: 'Ölçülen: ' + olculen + '/' + toplam }),
          el('progress', { a: { max: String(Math.max(1, toplam)), value: String(olculen) } }),
          arama, filtre
        ]),
        el('div', { s: 'satir' }, [
          dugme('📤 Sonucu gönder' + (gonderilmemis ? ' (' + gonderilmemis + ' gönderilmemiş)' : ''), 'birincil',
            function () { git(function () { return ekranGonder(); }); }),
          dugme('➕ Listede olmayan cihaz', '', function () {
            git(function () { return ekranCihaz({ ekstra: true, mac: null, ad: 'Listede olmayan cihaz', tip: 'diger' }, null); });
          })
        ]),
        listeKutu, ekstraKutu
      ]));
      listeyiCiz();
    });
  }

  /* ---------- fotograf ---------- */
  function fotoKucult(dosya) {
    return new Promise(function (coz, red) {
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Fotoğraf okunamadı.')); };
      img.onload = function () {
        try {
          var en = img.naturalWidth, boy = img.naturalHeight, k = Math.min(1, 800 / Math.max(en, boy));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(en * k)); cv.height = Math.max(1, Math.round(boy * k));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var kalite = 0.6, sonuc = cv.toDataURL('image/jpeg', kalite);
          while (sonuc.length > M.SINIRLAR.foto_baytlari && kalite > 0.25) { kalite -= 0.1; sonuc = cv.toDataURL('image/jpeg', kalite); }
          URL.revokeObjectURL(url);
          if (!M.jpegDataUrlGecerliMi(sonuc, M.SINIRLAR.foto_baytlari)) red(new Error('Fotoğraf çok büyük.'));
          else coz(sonuc);
        } catch (e) { URL.revokeObjectURL(url); red(e); }
      };
      img.src = url;
    });
  }

  /* ---------- cihaz ekrani ---------- */
  function sonKopyaKaynagi(haricMac) {
    var en = null;
    durum.olcumler.forEach(function (o) {
      if (!o.mac || o.mac === haricMac) return;
      if (!en || String(o.zaman) > String(en.zaman)) en = o;
    });
    return en;
  }

  function ekranCihaz(c, mevcutEkstra) {
    var paket = durum.paket, esikler = paket.esikler, ekstra = !!c.ekstra;
    var mevcut = ekstra ? mevcutEkstra : (sonOlcumler()[c.mac] || null);
    var panel = el('section', { s: 'kart-bolum' });
    var bilgi = el('section', { s: 'kart-bolum' }, [
      el('div', { s: 'kart-baslik buyuk' }, [
        el('span', { s: 'simge', t: TIP_SIMGE[c.tip] || '🔌', a: { 'aria-hidden': 'true' } }),
        el('span', { t: ekstra ? 'Listede olmayan cihaz' : cihazAdi(c) })
      ])
    ].concat(ekstra ? [] : bilgiSatirlari(c)));
    var resim = ekstra ? null : guvenliResim(c.snapshot, 'Kamera görüntüsü', 'buyuk-resim');
    if (resim) bilgi.insertBefore(resim, bilgi.firstChild);
    if (!ekstra && c.konum) {
      bilgi.appendChild(el('div', { s: 'ipucu', t: 'Pakette kayıtlı konum var (kaynak: ' + (c.konum.kaynak || 'bilinmiyor') + ').' }));
    }

    kok.appendChild(ustBar(ekstra ? 'Listede olmayan cihaz' : cihazAdi(c), paket.lokasyon.ad, true));
    kok.appendChild(el('main', { s: 'icerik' }, [bilgi, panel]));

    function kopyaDugmesi() {
      var src = sonKopyaKaynagi(c.mac);
      if (!src) return null;
      var ad = durum.cihazMap[src.mac] ? cihazAdi(durum.cihazMap[src.mac]) : src.mac;
      return dugme('📋 Aynı direk: önceki ölçümü kopyala (' + ad + ')', '', function () {
        sonucPanel({
          enlem: src.enlem, boylam: src.boylam, dogruluk_m: src.dogruluk_m,
          okuma_sayisi: src.okuma_sayisi, sure_s: 0, kopya_kaynagi_mac: src.mac
        });
      });
    }

    function hataPanel(mesaj) {
      bosalt(panel);
      panel.appendChild(el('p', { s: 'hata-kutu', t: mesaj }));
      panel.appendChild(dugme('📍 Tekrar dene', 'birincil buyuk', olcumeBasla));
    }

    function bosPanel() {
      bosalt(panel);
      panel.appendChild(dugme('📍 Konumu al', 'birincil buyuk', olcumeBasla));
      panel.appendChild(el('p', { s: 'ipucu', t: 'Direğin dibinde değil, 2-3 m açıkta, gökyüzü açık bir yerde durun. ' +
        'Ölçüm en fazla ' + M.etkinOlcumSuresi(esikler) + ' sn sürer; doğruluk ±' + esikler.iyi_m + ' m altına inerse erken biter. ' +
        'Telefonun konumu (Hassas konum) açık olmalı.' }));
      var k = kopyaDugmesi();
      if (k) panel.appendChild(k);
    }

    function kayitliPanel() {
      bosalt(panel);
      var sinif = M.dogrulukSinifi(mevcut.dogruluk_m, esikler);
      panel.appendChild(el('div', { s: 'sonuc-kutu sinif-' + sinif }, [
        el('div', { s: 'buyuk-sayi', t: '±' + sayiYaz(mevcut.dogruluk_m) + ' m' }),
        el('div', { t: mevcut.enlem.toFixed(6) + ', ' + mevcut.boylam.toFixed(6) }),
        el('div', { s: 'ipucu', t: 'Kaydedildi: ' + tarihYaz(mevcut.zaman) + (mevcut.kopya_kaynagi_mac ? ' · önceki ölçümden kopyalandı' : '') })
      ]));
      if (mevcut['not']) panel.appendChild(el('p', { t: 'Not: ' + mevcut['not'] }));
      var fotoYer = el('div');
      panel.appendChild(fotoYer);
      D.fotoGetir(mevcut.olcum_id).then(function (f) {
        var r = guvenliResim(f, 'Çekilen fotoğraf', 'buyuk-resim');
        if (r) fotoYer.appendChild(r);
      }).catch(function () { /* foto yoksa sorun degil */ });
      panel.appendChild(dugme('🔁 Yeniden ölç', 'birincil', olcumeBasla));
      var k = kopyaDugmesi();
      if (k) panel.appendChild(k);
      panel.appendChild(dugme('🗑 Ölçümü sil', 'tehlike', function () {
        if (!window.confirm('Bu ölçüm silinsin mi?')) return;
        D.olcumSil(mevcut.olcum_id).then(function () { geri(); }).catch(hataGoster);
      }));
    }

    function olcumeBasla() {
      temizle();
      bosalt(panel);
      var sayacYazi = el('div', { s: 'buyuk-sayi', t: 'Okuma: 0' });
      var anlikYazi = el('div', { t: 'Anlık doğruluk: bekleniyor…' });
      var sureCubuk = el('progress', { a: { max: '100', value: '0' } });
      var sureS = M.etkinOlcumSuresi(esikler), sureMs = sureS * 1000, bas = Date.now();
      var kilit = null, bitti = false;
      durum.olcuyor = true;
      panel.appendChild(el('p', { t: 'Konum alınıyor, cihazın yanında bekleyin…' }));
      panel.appendChild(sayacYazi);
      panel.appendChild(anlikYazi);
      panel.appendChild(sureCubuk);

      try {
        if (navigator.wakeLock && navigator.wakeLock.request) {
          navigator.wakeLock.request('screen').then(function (l) {
            if (bitti) l.release().catch(function () { /* yut */ }); else kilit = l;
          }).catch(function () { /* wake lock zorunlu degil */ });
        }
      } catch (e) { /* yut */ }

      var tik = setInterval(function () {
        sureCubuk.value = Math.min(100, ((Date.now() - bas) / sureMs) * 100);
      }, 250);

      var oturum = M.olcumBaslat(navigator.geolocation, {
        sure_s: sureS, erken_esik_m: esikler.iyi_m, guvenli: window.isSecureContext !== false
      }, {
        onOkuma: function (o, tumu) {
          sayacYazi.textContent = 'Okuma: ' + tumu.length;
          anlikYazi.textContent = 'Anlık doğruluk: ±' + sayiYaz(o.dogruluk) + ' m';
        },
        onBitti: function (okumalar, b) {
          durdur();
          var r = M.olcumHesapla(okumalar, b.sure_s);
          if (!r) hataPanel(M.hataMetni('yetersiz')); else sonucPanel(r);
        },
        onHata: function (h) { durdur(); hataPanel(h.mesaj); }
      });
      function durdur() {
        bitti = true;
        durum.olcuyor = false;
        clearInterval(tik);
        if (kilit) { kilit.release().catch(function () { /* yut */ }); kilit = null; }
        durum.temizlik = null;
      }
      durum.temizlik = function () { oturum.iptal(); durdur(); };
      panel.appendChild(dugme('✖ İptal', 'tehlike', function () { oturum.iptal(); durdur(); bosPanel(); }));
    }

    function sonucPanel(t) {
      bosalt(panel);
      var sinif = M.dogrulukSinifi(t.dogruluk_m, esikler);
      var foto = null;
      var onayGerek = sinif === 'kotu' || sinif === 'red';
      panel.appendChild(el('div', { s: 'sonuc-kutu sinif-' + sinif }, [
        el('div', { s: 'buyuk-sayi', t: '±' + sayiYaz(t.dogruluk_m) + ' m' }),
        el('div', { s: 'sinif-yazi', t: SINIF_METNI[sinif] + (sinif === 'red' ? ' (> ' + esikler.red_m + ' m)' : '') }),
        el('div', { t: t.enlem.toFixed(6) + ', ' + t.boylam.toFixed(6) }),
        el('div', { s: 'ipucu', t: t.kopya_kaynagi_mac ? 'Önceki ölçümden kopyalandı.' : (t.okuma_sayisi + ' okuma kullanıldı, ' + sayiYaz(t.sure_s) + ' sn') })
      ]));
      if (!ekstra && c.konum && M.turkiyeKutusundaMi(c.konum.enlem, c.konum.boylam)) {
        var d = M.haversine(t.enlem, t.boylam, c.konum.enlem, c.konum.boylam);
        panel.appendChild(el('p', { s: 'ipucu', t: 'Kayıtlı konuma ~' + Math.round(d) + ' m uzaktasın.' }));
      }
      var onay = null;
      if (onayGerek) {
        onay = el('input', { a: { type: 'checkbox', id: 'onay' } });
        panel.appendChild(el('label', { s: 'onay-satir', a: { for: 'onay' } }, [
          onay, el('span', { t: sinif === 'red' ? 'Doğruluk çok zayıf; yine de kaydetmek istiyorum.' : 'Doğruluk zayıf; yine de kaydetmek istiyorum.' })
        ]));
      }
      var not = el('textarea', {
        s: 'girdi', a: { maxlength: '500', rows: '3', placeholder: ekstra ? 'Bu cihaz nedir? (zorunlu)' : 'Not (isteğe bağlı)', 'aria-label': 'Not' }
      });
      not.value = mevcut && mevcut['not'] ? mevcut['not'] : '';
      var onizleme = el('div');
      var fotoGirdi = el('input', {
        s: 'gizli', a: { type: 'file', accept: 'image/*', capture: 'environment' },
        on: {
          change: function () {
            var f = fotoGirdi.files && fotoGirdi.files[0]; fotoGirdi.value = '';
            if (!f) return;
            fotoKucult(f).then(function (url) {
              foto = url; bosalt(onizleme);
              var r = guvenliResim(url, 'Çekilen fotoğraf', 'buyuk-resim'); if (r) onizleme.appendChild(r);
            }).catch(function (e) { bildir(e.message, 'hata'); });
          }
        }
      });
      var kaydetDugme = dugme('💾 Kaydet', 'birincil buyuk', function () {
        var metin = not.value.trim().slice(0, 500);
        if (ekstra && !metin) { bildir('Listede olmayan cihaz için not yazın (ne olduğunu belirtin).', 'uyari'); not.focus(); return; }
        var rec = {
          olcum_id: M.yeniId(), paket_id: paket.paket_id, mac: ekstra ? null : c.mac,
          enlem: t.enlem, boylam: t.boylam, dogruluk_m: t.dogruluk_m, okuma_sayisi: t.okuma_sayisi, sure_s: t.sure_s,
          zaman: M.isoYerel(new Date()), kopya_kaynagi_mac: t.kopya_kaynagi_mac || null, 'not': metin, gonderildi: null
        };
        if (!M.olcumGecerliMi(rec)) {
          bildir('Koordinat Türkiye sınırları dışında görünüyor; kaydedilmedi. Konumu yeniden alın.', 'hata'); return;
        }
        var eskiEkstra = ekstra && mevcutEkstra ? mevcutEkstra.olcum_id : null;
        // Foto secilmediyse ayni olcumun eski fotosu korunmaz (yeni olcum = yeni kayit)
        D.olcumKaydet(rec, foto).then(function () {
          return eskiEkstra ? D.olcumSil(eskiEkstra) : null;
        }).then(function () { bildir('Kaydedildi.', 'tamam'); geri(); }).catch(hataGoster);
      });
      if (onay) {
        kaydetDugme.disabled = true;
        onay.addEventListener('change', function () { kaydetDugme.disabled = !onay.checked; });
      }
      panel.appendChild(not);
      panel.appendChild(el('label', { s: 'dugme', a: { tabindex: '0' } }, [document.createTextNode('📷 Fotoğraf ekle (isteğe bağlı)'), fotoGirdi]));
      panel.appendChild(onizleme);
      panel.appendChild(el('div', { s: 'satir' }, [kaydetDugme, dugme('🔁 Yeniden ölç', '', olcumeBasla)]));
    }

    if (mevcut) kayitliPanel(); else bosPanel();
    if (ekstra && mevcut) { // ekstra icin silme dugmesi kayitliPanel icinde zaten var
      return;
    }
  }

  /* ---------- gonder ekrani ---------- */
  function ekranGonder() {
    var paket = durum.paket;
    var blobUrl = null, dosya = null, dosyaAdi = '', uretilen = null;
    var olcenGirdi = el('input', { s: 'girdi', a: { type: 'text', id: 'olcen2', maxlength: '100', placeholder: 'Ad Soyad' } });
    olcenGirdi.value = durum.olcen;
    var ozet = el('div', { s: 'sonuc-kutu' });
    var indir = el('a', { s: 'dugme birincil buyuk', t: '⬇ Dosyayı indir', a: { role: 'button' } });
    var paylas = dugme('📤 Paylaş (WhatsApp / e-posta)', 'birincil buyuk', function () {
      if (!dosya) return;
      navigator.share({ files: [dosya], title: 'Saha GPS sonucu' }).then(function () {
        return isaretle();
      }).catch(function (e) {
        if (e && e.name !== 'AbortError') bildir('Paylaşım açılamadı; "Dosyayı indir" düğmesini kullanın.', 'uyari');
      });
    });
    paylas.classList.add('gizli');
    // Indirme tiklamasi "gonderildi" SAYILMAZ (iOS'ta indirme sessizce basarisiz olabilir);
    // kullanici dosyanin ulastigini acikca onaylar.
    var onayDugme = dugme('✔ Dosya karşıya ulaştı: gönderildi olarak işaretle', '', function () { isaretle(); });
    onayDugme.classList.add('gizli');
    indir.addEventListener('click', function () { onayDugme.classList.remove('gizli'); });

    function isaretle() {
      if (!uretilen) return Promise.resolve();
      return D.gonderildiIsaretle(uretilen, new Date().toISOString()).then(function () {
        onayDugme.classList.add('gizli');
        bildir('Ölçümler gönderildi olarak işaretlendi.', 'tamam');
        return uret();
      });
    }
    // Blob URL'si indirme bitmeden iptal edilmesin: 60 sn gecikmeyle serbest birak.
    function urlGeciktirilmisSil(u) { if (u) setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }

    function uret() {
      return D.olcumlerGetir(paket.paket_id).then(function (liste) {
        return Promise.all(liste.map(function (o) {
          return D.fotoGetir(o.olcum_id).then(function (f) { return Object.assign({}, o, { foto: f }); });
        }));
      }).then(function (liste) {
        var simdi = new Date();
        var sonuc = M.sonucOlustur({
          paket: paket, olcen: durum.olcen, olcumler: liste.filter(function (o) { return o.mac; }),
          ekstralar: liste.filter(function (o) { return !o.mac; }), simdi: simdi, user_agent: navigator.userAgent
        });
        uretilen = liste;
        var json = JSON.stringify(sonuc);
        var blob = new Blob([json], { type: 'text/plain' });
        dosyaAdi = M.dosyaAdi(paket.lokasyon.ad, simdi);
        dosya = null;
        try { dosya = new File([blob], dosyaAdi, { type: 'text/plain' }); } catch (e) { dosya = null; }
        urlGeciktirilmisSil(blobUrl);
        blobUrl = URL.createObjectURL(blob);
        indir.href = blobUrl; indir.setAttribute('download', dosyaAdi);
        var gonderilmemis = liste.filter(function (o) { return !o.gonderildi; }).length;
        var fotoSayisi = sonuc.olcumler.concat(sonuc.ekstralar).filter(function (o) { return o.foto; }).length;
        bosalt(ozet);
        ozet.appendChild(el('div', { s: 'buyuk-sayi', t: sonuc.olcumler.length + ' ölçüm + ' + sonuc.ekstralar.length + ' ekstra' }));
        ozet.appendChild(el('div', { t: 'Gönderilmemiş: ' + gonderilmemis + ' · Fotoğraf: ' + fotoSayisi }));
        ozet.appendChild(el('div', { s: 'ipucu', t: 'Dosya: ' + dosyaAdi + ' (' + (json.length / 1048576).toFixed(2).replace('.', ',') + ' MB)' }));
        var paylasilabilir = false;
        try { paylasilabilir = !!(dosya && navigator.canShare && navigator.share && navigator.canShare({ files: [dosya] })); } catch (e) { paylasilabilir = false; }
        paylas.classList.toggle('gizli', !paylasilabilir);
      });
    }
    olcenGirdi.addEventListener('change', function () {
      durum.olcen = olcenGirdi.value.trim().slice(0, 100);
      D.ayarKaydet('olcen', durum.olcen).then(uret).catch(hataGoster);
    });

    durum.temizlik = function () { urlGeciktirilmisSil(blobUrl); blobUrl = null; };
    kok.appendChild(ustBar('Sonucu gönder', paket.lokasyon.ad, true));
    kok.appendChild(el('main', { s: 'icerik' }, [
      el('section', { s: 'kart-bolum' }, [el('label', { s: 'etiket', t: 'Ölçümü yapan kişi', a: { for: 'olcen2' } }), olcenGirdi]),
      ozet, paylas, indir, onayDugme,
      el('p', { s: 'ipucu', t: 'Dosyayı WhatsApp ya da e-posta ile masaüstü uygulamasını kullanan kişiye gönderin. Her cihaz için yalnız son ölçüm yer alır. İndirme düğmesi ölçümleri kendiliğinden "gönderildi" yapmaz; dosya ulaşınca onay düğmesine basın.' })
    ]));
    return uret();
  }

  /* ---------- yeni surum bildirimi ---------- */
  // Yeni service worker devreye girince sayfa KENDILIGINDEN yenilenmez (olcum ortasinda
  // kayip olmasin); kullaniciya "yenile" onerilir, olcum suruyorsa yenileme reddedilir.
  function yeniSurumBandi() {
    if (document.getElementById('yeni-surum')) return;
    var bant = el('div', { s: 'yeni-surum', a: { id: 'yeni-surum', role: 'status' } }, [
      el('span', { t: 'Yeni sürüm var.' }),
      el('button', {
        s: 'dugme birincil', t: 'Yenile', a: { type: 'button' },
        on: {
          click: function () {
            if (durum.olcuyor) { bildir('Ölçüm sürerken yenilenemez; ölçüm bitince tekrar deneyin.', 'uyari'); return; }
            window.location.reload();
          }
        }
      })
    ]);
    document.body.insertBefore(bant, document.body.firstChild);
  }

  /* ---------- baslat ---------- */
  function baslat() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* yut */ }); } catch (e) { /* yut */ }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      var oncekiDenetleyici = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!oncekiDenetleyici) { oncekiDenetleyici = true; return; } // ilk kurulum: bildirim yok
        yeniSurumBandi();
      });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () { /* sessizce yut */ });
      });
    }
    D.hazirla().then(function () { return D.ayarGetir('olcen'); }).then(function (ad) {
      durum.olcen = typeof ad === 'string' ? ad : '';
      durum.gecmis = [ekranIlk];
      ciz(ekranIlk);
    }).catch(hataGoster);
  }
  baslat();
})();
