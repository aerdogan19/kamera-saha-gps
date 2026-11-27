/* Saha GPS - arayuz. Paket/sonuc kullanici girdisidir: yalniz createElement + textContent kullanilir;
   innerHTML/eval/fetch/XHR YOK. Resimler yalniz data:image/jpeg;base64 desenine uyarsa atanir. */
(function () {
  'use strict';
  var M = window.SahaMantik, D = window.SahaDepo, S = window.SolarMantik;
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
      if (veri && typeof veri === 'object' && veri.tur === S.PAKET_TURU) { solarPaketYukle(veri); return; }
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
      el('p', { s: 'ipucu', t: 'Masaüstü uygulamasının ürettiği saha GPS ya da solar kamera paketi dosyasını seçin.' })
    ]));
    ana.appendChild(el('h2', { t: 'Yüklü paketler' }));
    ana.appendChild(liste);
    kok.appendChild(ana);

    return D.paketListesi().then(function (paketler) {
      if (!paketler.length) liste.appendChild(el('p', { s: 'ipucu', t: 'Henüz paket yüklenmedi.' }));
      paketler.forEach(function (p) {
        var ilerleme = p.olculen + '/' + p.cihaz_sayisi;
        liste.appendChild(el('article', { s: 'paket-kart' }, [
          el('h3', { t: (p.tur === 'solar' ? '☀ ' : '') + p.lokasyon_ad }),
          el('p', { s: 'ipucu', t: 'Paket: ' + tarihYaz(p.olusturma) + ' · Yüklendi: ' + tarihYaz(p.yuklenme) }),
          el('p', { t: 'Ölçülen: ' + ilerleme + (p.ekstra ? ' (+' + p.ekstra + ' ekstra)' : '') + (p.gonderilmemis ? ' · gönderilmemiş: ' + p.gonderilmemis : '') }),
          el('progress', { a: { max: String(Math.max(1, p.cihaz_sayisi)), value: String(p.olculen) } }),
          el('div', { s: 'satir' }, [
            dugme('Aç', 'birincil', function () {
              git(function () { return p.tur === 'solar' ? ekranSolarListe(p.paket_id) : ekranPaket(p.paket_id); });
            }),
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
      var onizleme = el('div'), fotoHata = fotoHataKutusu();
      var fotoGirdi = el('input', {
        s: 'gizli', a: { type: 'file', accept: 'image/*', capture: 'environment' },
        on: {
          change: function () {
            var f = fotoGirdi.files && fotoGirdi.files[0]; fotoGirdi.value = '';
            if (!f) return;
            fotoKucult(f).then(function (url) {
              foto = url; fotoHata.gizle(); bosalt(onizleme);
              var r = guvenliResim(url, 'Çekilen fotoğraf', 'buyuk-resim'); if (r) onizleme.appendChild(r);
            }).catch(function (e) { fotoHata.goster(e); });
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
      panel.appendChild(fotoHata.kutu);
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

  /* ---------- SOLAR modu (docs/SOLAR_PLAN.md) ---------- */
  function solarPaketYukle(veri) {
    var sonuc = S.solarPaketDogrula(veri);
    if (!sonuc.ok) { bildir('Solar paketi reddedildi: ' + sonuc.hatalar.join(' '), 'hata'); return; }
    var p = sonuc.paket;
    D.paketGetir(p.paket_id).then(function (varMi) {
      return D.paketKaydet(p).then(function () {
        bildir(varMi ? 'Solar paketi güncellendi; önceki kayıtlar korundu.' : 'Solar paketi yüklendi.', 'tamam');
        if (sonuc.uyarilar.length) bildir(sonuc.uyarilar.join(' '), 'uyari');
        git(function () { return ekranSolarListe(p.paket_id); });
      });
    }).catch(hataGoster);
  }

  function solarSonKayitlar(liste) { // kayit_id -> en yeni telefon kaydi
    var h = {};
    liste.forEach(function (o) {
      if (!h[o.kayit_id] || String(o.zaman) >= String(h[o.kayit_id].zaman)) h[o.kayit_id] = o;
    });
    return h;
  }

  function yonMetni(g) {
    if (!g || g.yon_derece === null || g.yon_derece === undefined) return 'Yön girilmedi';
    var kaynak = g.yon_kaynak === 'hedef_nokta' ? 'hedef nokta' : (g.yon_kaynak === 'pusula' ? 'pusula, tahmini' : 'elle');
    return 'Yön: ' + Math.round(g.yon_derece) + '° ' + S.yonAdi(g.yon_derece) + ' (' + kaynak + ')';
  }

  function solarRozet(kayit, esikler) {
    if (!kayit) return el('span', { s: 'rozet rozet-yok', t: 'Ölçülmedi' });
    if (kayit.enlem === null || kayit.enlem === undefined) return el('span', { s: 'rozet rozet-yok', t: 'Kaydedildi (konum yok)' });
    return el('span', { s: 'rozet rozet-' + M.dogrulukSinifi(kayit.dogruluk_m, esikler), t: '✔ Konum ±' + sayiYaz(kayit.dogruluk_m) + ' m' });
  }

  // "3/4 kamera yönlü" rozeti
  function yonRozeti(kameralar) {
    var oz = S.yonOzeti(kameralar);
    if (!oz.toplam) return el('span', { s: 'rozet rozet-yok', t: 'Kamera yok' });
    var sinif = oz.yonlu === oz.toplam ? 'rozet-iyi' : (oz.yonlu === 0 ? 'rozet-yok' : 'rozet-kabul');
    return el('span', { s: 'rozet ' + sinif, t: oz.yonlu + '/' + oz.toplam + ' kamera yönlü' });
  }

  function ekranSolarListe(paketId) {
    return Promise.all([D.paketGetir(paketId), D.solarKayitlariGetir(paketId)]).then(function (s) {
      var paket = s[0];
      if (!paket) { bildir('Paket bulunamadı.', 'hata'); degistir(ekranIlk); return; }
      durum.solarPaket = paket;
      durum.solarKayitlar = s[1];
      durum.solarTaslak = null; // listeye donuldu: yarim kalan taslak bellekte tutulmaz (kayitlar IndexedDB'de)
      var son = solarSonKayitlar(s[1]), satirlar = [], paketteki = {};
      paket.kayitlar.forEach(function (k) {
        paketteki[k.kayit_id] = true;
        satirlar.push({ paketKaydi: k, mevcut: son[k.kayit_id] || null });
      });
      Object.keys(son).forEach(function (id) { if (!paketteki[id]) satirlar.push({ paketKaydi: null, mevcut: son[id] }); });
      var gonderilmemis = s[1].filter(function (o) { return !o.gonderildi; }).length;
      var kayitli = satirlar.filter(function (x) { return x.mevcut; }).length;

      var liste = el('div', { s: 'grup-liste' });
      var solarArama = el('input', { s: 'girdi', a: { type: 'search', placeholder: 'Ara: kimlik (#30516), ad, model…', 'aria-label': 'Ara' } });
      var kartlar = [];
      function solarFiltre() {
        var q = solarArama.value.trim().toLocaleLowerCase('tr').replace(/^#/, '');
        kartlar.forEach(function (x) { x.kart.classList.toggle('gizli', !!q && x.havuz.indexOf(q) === -1); });
      }
      solarArama.addEventListener('input', solarFiltre);
      if (!satirlar.length) liste.appendChild(el('p', { s: 'ipucu', t: 'Henüz cihaz yok. "➕ Yeni solar cihaz" ile ekleyin.' }));
      satirlar.forEach(function (x) {
        var kaynak = x.mevcut || x.paketKaydi;
        var kameralar = x.mevcut ? (x.mevcut.kameralar || []) : x.paketKaydi.kameralar;
        var ac = function () { git(function () { return ekranSolarKayit(x.paketKaydi, x.mevcut, null); }); };
        var yer = [kaynak.konum_adi, kaynak.is_adi].filter(function (t) { return !!t; }).join(' · ');
        var kart = el('div', { s: 'kart', a: { role: 'button', tabindex: '0' } }, [
          el('div', { s: 'kart-govde' }, [
            el('div', { s: 'kart-baslik' }, [
              el('span', { s: 'simge', t: '☀', a: { 'aria-hidden': 'true' } }),
              el('span', { t: kaynak.ad }),
              S.kayitKimligi(kaynak) ? document.createTextNode(' ') : null,
              S.kayitKimligi(kaynak) ? el('span', { s: 'rozet rozet-kabul', t: '#' + S.kayitKimligi(kaynak) }) : null
            ]),
            yer ? el('div', { t: yer }) : null,
            (kaynak.marka || kaynak.model) ? el('div', { s: 'ipucu', t: [kaynak.marka, kaynak.model].filter(function (t) { return !!t; }).join(' ') }) : null,
            el('div', { s: 'ipucu', t: x.mevcut && x.mevcut.yeni ? 'Yeni kayıt (telefonda eklendi)' : '' }),
            el('div', {}, [solarRozet(x.mevcut, paket.esikler), document.createTextNode(' '), yonRozeti(kameralar)])
          ])
        ]);
        kart.addEventListener('click', ac);
        kart.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
        liste.appendChild(kart);
        kartlar.push({ kart: kart, havuz: [kaynak.ad, S.kayitKimligi(kaynak), kaynak.model, kaynak.seri_no, kaynak.konum_adi, kaynak.is_adi].join(' ').toLocaleLowerCase('tr') });
      });

      kok.appendChild(ustBar('☀ ' + paket.lokasyon.ad, 'Solar paketi: ' + tarihYaz(paket.olusturma), true));
      kok.appendChild(el('main', { s: 'icerik' }, [
        el('section', { s: 'kart-bolum' }, [
          el('p', { s: 'ilerleme-yazi', t: 'Kayıtlı cihaz: ' + kayitli + ' / ' + satirlar.length }),
          el('progress', { a: { max: String(Math.max(1, satirlar.length)), value: String(kayitli) } })
        ]),
        el('div', { s: 'satir' }, [
          dugme('➕ Yeni solar cihaz', 'birincil', function () {
            var yid = M.yeniId(); // geri/ileri gezinmede ayni taslak kimligi korunur
            git(function () { return ekranSolarKayit(null, null, yid); });
          }),
          dugme('📤 Sonucu gönder' + (gonderilmemis ? ' (' + gonderilmemis + ' gönderilmemiş)' : ''), '',
            function () { git(function () { return ekranSolarGonder(); }); })
        ]),
        satirlar.length > 5 ? solarArama : null,
        liste
      ]));
    });
  }

  // GPS ölçüm bloğu: kutu içinde boş / ölçülüyor / sonuç durumlarını yönetir (mevcut olcumBaslat/olcumHesapla/erkenBitebilirMi).
  // o: {dugme, ipucu, sonuc(): {enlem,boylam,dogruluk_m}|null, kosul(): hata metni|null, onSonuc(r): hata metni|null, temizlikler}
  function gpsBlok(kutu, esikler, o) {
    var iptalEt = null;
    o.temizlikler.push(function () { if (iptalEt) iptalEt(); });

    function goster() {
      bosalt(kutu);
      var t = o.sonuc();
      if (t) {
        var sinif = M.dogrulukSinifi(t.dogruluk_m, esikler);
        kutu.appendChild(el('div', { s: 'sonuc-kutu sinif-' + sinif }, [
          el('div', { s: 'buyuk-sayi', t: '±' + sayiYaz(t.dogruluk_m) + ' m' }),
          el('div', { t: t.enlem.toFixed(6) + ', ' + t.boylam.toFixed(6) }),
          el('div', { s: 'sinif-yazi', t: SINIF_METNI[sinif] })
        ]));
        kutu.appendChild(dugme('🔁 Yeniden ölç', '', baslat));
      } else {
        kutu.appendChild(dugme(o.dugme, 'birincil', baslat));
        if (o.ipucu) kutu.appendChild(el('p', { s: 'ipucu', t: o.ipucu }));
      }
    }
    function hataYaz(mesaj) {
      bosalt(kutu);
      kutu.appendChild(el('p', { s: 'hata-kutu', t: mesaj }));
      kutu.appendChild(dugme('📍 Tekrar dene', 'birincil', baslat));
      kutu.appendChild(dugme('Vazgeç', '', goster));
    }
    function baslat() {
      if (durum.olcuyor) { bildir('Başka bir ölçüm sürüyor; bitmesini bekleyin.', 'uyari'); return; }
      var kosul = o.kosul ? o.kosul() : null;
      if (kosul) { bildir(kosul, 'uyari'); return; }
      bosalt(kutu);
      var sayacYazi = el('div', { s: 'buyuk-sayi', t: 'Okuma: 0' });
      var anlikYazi = el('div', { t: 'Anlık doğruluk: bekleniyor…' });
      var sureCubuk = el('progress', { a: { max: '100', value: '0' } });
      var sureS = M.etkinOlcumSuresi(esikler), bas = Date.now(), kilit = null, bitti = false;
      durum.olcuyor = true;
      kutu.appendChild(el('p', { t: 'Konum alınıyor, olduğunuz yerde sabit bekleyin…' }));
      kutu.appendChild(sayacYazi); kutu.appendChild(anlikYazi); kutu.appendChild(sureCubuk);
      try {
        if (navigator.wakeLock && navigator.wakeLock.request) {
          navigator.wakeLock.request('screen').then(function (l) {
            if (bitti) l.release().catch(function () { /* yut */ }); else kilit = l;
          }).catch(function () { /* zorunlu degil */ });
        }
      } catch (e) { /* yut */ }
      var tik = setInterval(function () { sureCubuk.value = Math.min(100, ((Date.now() - bas) / (sureS * 1000)) * 100); }, 250);
      function durdur() {
        bitti = true; durum.olcuyor = false; clearInterval(tik); iptalEt = null;
        if (kilit) { kilit.release().catch(function () { /* yut */ }); kilit = null; }
      }
      var oturum = M.olcumBaslat(navigator.geolocation, {
        sure_s: sureS, erken_esik_m: esikler.iyi_m, guvenli: window.isSecureContext !== false
      }, {
        onOkuma: function (ok, tumu) {
          sayacYazi.textContent = 'Okuma: ' + tumu.length;
          anlikYazi.textContent = 'Anlık doğruluk: ±' + sayiYaz(ok.dogruluk) + ' m';
        },
        onBitti: function (okumalar, b) {
          durdur();
          var r = M.olcumHesapla(okumalar, b.sure_s);
          if (!r) { hataYaz(M.hataMetni('yetersiz')); return; }
          if (!M.olcumGecerliMi(r)) { hataYaz('Koordinat Türkiye sınırları dışında görünüyor; konumu yeniden alın.'); return; }
          var hata = o.onSonuc(r);
          if (hata) hataYaz(hata); else goster();
        },
        onHata: function (h) { durdur(); hataYaz(h.mesaj); }
      });
      iptalEt = function () { oturum.iptal(); durdur(); };
      kutu.appendChild(dugme('✖ İptal', 'tehlike', function () { if (iptalEt) iptalEt(); goster(); }));
    }
    goster();
    return { goster: goster };
  }

  // Kalici foto hata kutusu: kullanici kapatana ya da yeni fotograf basarili olana kadar kalir.
  function fotoHataMetni(e) {
    var m = e && e.message ? e.message : '';
    if (/okunamad/i.test(m)) return "Fotoğraf okunamadı (HEIC olabilir). Kamera ayarında 'En uyumlu' biçimi seçin ya da ekran görüntüsü yerine tekrar çekin.";
    return m || 'Fotoğraf eklenemedi.';
  }
  function fotoHataKutusu() {
    var yazi = el('span'), kutu = el('div', { s: 'hata-kutu gizli', a: { role: 'alert' } }, [
      yazi, document.createTextNode(' '),
      el('button', { s: 'dugme', t: 'Kapat', a: { type: 'button' }, on: { click: function () { kutu.classList.add('gizli'); } } })
    ]);
    return {
      kutu: kutu,
      goster: function (e) { yazi.textContent = fotoHataMetni(e); kutu.classList.remove('gizli'); },
      gizle: function () { kutu.classList.add('gizli'); }
    };
  }

  function fotoAlani(etiket, f, alan, degisti) {
    var onizleme = el('div'), hataKutu = fotoHataKutusu();
    function ciz2() {
      bosalt(onizleme);
      var r = f[alan] ? guvenliResim(f[alan], etiket, 'buyuk-resim') : null;
      if (r) {
        onizleme.appendChild(r);
        onizleme.appendChild(dugme('Fotoğrafı kaldır', 'tehlike', function () { f[alan] = null; ciz2(); if (degisti) degisti(); }));
      }
    }
    var girdi = el('input', {
      s: 'gizli', a: { type: 'file', accept: 'image/*', capture: 'environment' },
      on: {
        change: function () {
          var d = girdi.files && girdi.files[0]; girdi.value = '';
          if (!d) return;
          fotoKucult(d).then(function (url) { hataKutu.gizle(); f[alan] = url; ciz2(); if (degisti) degisti(); }).catch(function (e) { hataKutu.goster(e); });
        }
      }
    });
    ciz2();
    return el('div', {}, [
      el('label', { s: 'dugme', a: { tabindex: '0' } }, [document.createTextNode('📷 ' + etiket), girdi]), hataKutu.kutu, onizleme
    ]);
  }

  function kisitMenzil(m) { return Math.min(S.SINIRLAR.menzil_maks, Math.max(S.SINIRLAR.menzil_min, Math.round(m))); }

  /* ---------- gorus blogu (kanal basina): yon [hedef nokta / pusula / elle] + aciklik + menzil ---------- */
  // g: kanalin gorus nesnesi (yerinde degistirilir).
  // o: {esikler, sapma, konum(): {enlem,boylam}|null, temizlikler, ptz(): bool, degisti()}
  // Doner: {kutu, ptzGuncelle()} (PTZ isareti degisince basligi/ipucunu yeniler).
  function gorusBlokKur(g, o) {
    var esikler = o.esikler, sapma = o.sapma;
    var baslik = el('h2');
    var yonOzet = el('div', { s: 'buyuk-sayi' });
    var yonIpucu = el('p', { s: 'ipucu' });
    var ptzIpucu = el('p', { s: 'ipucu' });
    var kaydirici = el('input', { s: 'kaydirici', a: { id: 'sk-yon', type: 'range', min: '0', max: '359', step: '1', 'aria-label': 'Yön (derece, gerçek kuzeye göre)' } });
    var aciklikGirdi = el('input', { s: 'girdi', a: { type: 'number', min: '1', max: '360', step: '1', inputmode: 'numeric', id: 'sk-aciklik', 'aria-label': 'Açıklık (derece)' } });
    var menzilGirdi = el('input', { s: 'girdi', a: { type: 'number', min: '1', max: '500', step: '1', inputmode: 'numeric', id: 'sk-menzil', 'aria-label': 'Menzil (metre)' } });
    var hazirDugmeler = S.ACIKLIK_HAZIR.map(function (h) {
      var d = dugme(h.etiket, '', function () { g.aciklik_derece = h.derece; yenile(); o.degisti(); });
      d.setAttribute('data-derece', String(h.derece));
      return d;
    });
    function ptzGuncelle() {
      var p = o.ptz();
      baslik.textContent = p ? 'Ana / park yönü (PTZ)' : 'Görüş yönü';
      ptzIpucu.textContent = p ? 'PTZ kamera döner: buraya kameranın ana (park) konumda baktığı yönü girin. Açıklık/menzil bu ana yön için geçerlidir.' : '';
    }
    function yenile() {
      var y = g.yon_derece;
      yonOzet.textContent = y === null ? 'Yön girilmedi' : Math.round(y) + '° ' + S.yonAdi(y);
      var k = g.yon_kaynak;
      yonIpucu.textContent = y === null ? 'Sektör çizilebilmesi için yön gerekir; hedef nokta yöntemi önerilir.' :
        (k === 'hedef_nokta' ? 'Kaynak: hedef nokta (gerçek kuzeye göre).' :
          (k === 'pusula' ? 'Kaynak: pusula. TAHMİNİ: metal/direk/elektronik yakınında ±10-20° sapabilir; mümkünse hedef nokta yöntemini kullanın.' :
            'Kaynak: elle girildi.'));
      kaydirici.value = String(y === null ? 0 : Math.round(y) % 360);
      kaydirici.classList.toggle('pasif', y === null);
      aciklikGirdi.value = String(g.aciklik_derece);
      menzilGirdi.value = String(g.menzil_m);
      hazirDugmeler.forEach(function (d) { d.classList.toggle('secili', Number(d.getAttribute('data-derece')) === g.aciklik_derece); });
    }
    kaydirici.addEventListener('input', function () {
      var v = Number(kaydirici.value);
      g.yon_derece = v; g.yon_kaynak = 'elle'; g.yon_manyetik_derece = null; g.pusula_dogruluk = null; g.hedef = null;
      yonOzet.textContent = v + '° ' + S.yonAdi(v); yonIpucu.textContent = 'Kaynak: elle girildi.'; kaydirici.classList.remove('pasif');
    });
    kaydirici.addEventListener('change', function () { o.degisti(); });
    aciklikGirdi.addEventListener('input', function () {
      var v = Number(aciklikGirdi.value);
      if (aciklikGirdi.value !== '' && v >= S.SINIRLAR.aciklik_min && v <= S.SINIRLAR.aciklik_maks) {
        g.aciklik_derece = v;
        hazirDugmeler.forEach(function (d) { d.classList.toggle('secili', Number(d.getAttribute('data-derece')) === v); });
      }
    });
    aciklikGirdi.addEventListener('change', function () { o.degisti(); });
    menzilGirdi.addEventListener('input', function () {
      var v = Number(menzilGirdi.value);
      if (menzilGirdi.value !== '' && v >= S.SINIRLAR.menzil_min && v <= S.SINIRLAR.menzil_maks) g.menzil_m = Math.round(v);
    });
    menzilGirdi.addEventListener('change', function () { o.degisti(); });

    var hedefKutu = el('div');
    gpsBlok(hedefKutu, esikler, {
      temizlikler: o.temizlikler, dugme: '🎯 Hedef nokta ölç (önerilen)',
      ipucu: 'Önce cihazın konumunu alın. Sonra bu kameranın baktığı yönde 10-30 m ilerideki bir noktaya yürüyüp burada ölçün: yön ve menzil cihazdan o noktaya göre hesaplanır.',
      kosul: function () { return o.konum() ? null : 'Önce cihaz formunda cihazın konumunu ölçün.'; },
      sonuc: function () { return g.yon_kaynak === 'hedef_nokta' && g.hedef ? g.hedef : null; },
      onSonuc: function (r) {
        var kn = o.konum();
        if (!kn) return 'Önce cihaz formunda cihazın konumunu ölçün.';
        var hy = S.hedefYonuHesapla(kn.enlem, kn.boylam, r.enlem, r.boylam);
        if (!hy || hy.mesafe_m < 3) return 'Hedef nokta cihaza çok yakın (3 m altı). Kameranın baktığı yönde 10-30 m ilerideki bir noktada tekrar ölçün.';
        g.yon_derece = hy.yon_derece; g.yon_kaynak = 'hedef_nokta';
        g.yon_manyetik_derece = null; g.pusula_dogruluk = null;
        g.menzil_m = kisitMenzil(hy.mesafe_m);
        g.hedef = { enlem: r.enlem, boylam: r.boylam, dogruluk_m: r.dogruluk_m };
        yenile(); o.degisti();
        return null;
      }
    });

    var pusulaYazi = el('p', { s: 'ipucu' });
    var pusulaOturum = null;
    o.temizlikler.push(function () { if (pusulaOturum) { pusulaOturum.iptal(); pusulaOturum = null; } });
    var pusulaDugme = dugme('🧭 Pusula oku (tahmini)', '', function () {
      if (pusulaOturum) { pusulaOturum.iptal(); pusulaOturum = null; }
      pusulaYazi.textContent = 'Telefonu kameranın baktığı yöne doğrultun (arka yüzü ileriye bakacak şekilde, düz ve sabit) ve 3 sn bekleyin…';
      // iOS izin isteği dokunuşun içinde senkron çağrılmalı: pusulaOkumasi doğrudan tıklamadan çağrılır.
      pusulaOturum = S.pusulaOkumasi(window, { sure_s: 3 }, {
        onOkuma: function (d, n) { pusulaYazi.textContent = 'Okunuyor… ' + Math.round(d) + '° (' + n + ' okuma)'; },
        onBitti: function (r) {
          pusulaOturum = null;
          g.yon_manyetik_derece = r.yon_manyetik_derece;
          g.pusula_dogruluk = r.pusula_dogruluk;
          g.yon_derece = S.manyetiktenGercege(r.yon_manyetik_derece, sapma);
          g.yon_kaynak = 'pusula'; g.hedef = null;
          pusulaYazi.textContent = 'Pusula: ' + Math.round(r.yon_manyetik_derece) + '° (manyetik), +' + sayiYaz(sapma) +
            '° sapma ile gerçek kuzeye göre ' + Math.round(g.yon_derece) + '°. Tahmini; ±' + Math.round(r.pusula_dogruluk) + '° dalgalanma.';
          yenile(); o.degisti();
        },
        onHata: function (h) { pusulaOturum = null; pusulaYazi.textContent = h.mesaj; bildir(h.mesaj, 'uyari'); }
      });
    });
    var yonTemizle = dugme('Yönü temizle', '', function () {
      g.yon_derece = null; g.yon_kaynak = null; g.yon_manyetik_derece = null; g.pusula_dogruluk = null; g.hedef = null;
      yenile(); o.degisti();
    });

    var kutu = el('section', { s: 'kart-bolum' }, [
      baslik, ptzIpucu,
      yonOzet, yonIpucu,
      hedefKutu,
      pusulaDugme, pusulaYazi,
      el('label', { s: 'etiket', t: 'Elle yön (0° = kuzey, 90° = doğu)', a: { for: 'sk-yon' } }),
      kaydirici,
      yonTemizle,
      el('h2', { t: 'Açıklık' }),
      el('div', { s: 'satir' }, hazirDugmeler),
      el('label', { s: 'etiket', t: 'Açıklık (derece, 1-360)', a: { for: 'sk-aciklik' } }), aciklikGirdi,
      el('h2', { t: 'Menzil' }),
      el('label', { s: 'etiket', t: 'Menzil (metre, 1-500). Hedef nokta ölçülürse otomatik dolar.', a: { for: 'sk-menzil' } }), menzilGirdi
    ]);
    ptzGuncelle(); yenile();
    return { kutu: kutu, ptzGuncelle: ptzGuncelle };
  }

  /* ---------- taslak (cihaz + kameralar) ---------- */
  var SOLAR_METIN_ALANLARI = ['ad', 'konum_adi', 'is_adi', 'marka', 'model', 'seri_no', 'imei', 'bulut_cihaz_id', 'seri_son5',
    'hat_no', 'iccid', 'operator', 'tarife', 'panel_bilgi', 'batarya_bilgi', 'kurulum_tarihi', 'calisma_durumu', 'not'];

  function solarTaslakKur(paket, paketKaydi, mevcut, kimlik) {
    var vars = paket.varsayilanlar, modeller = S.modelListesi(paket), f;
    if (mevcut) {
      f = JSON.parse(JSON.stringify(mevcut));
      ['olcum_id', 'paket_id', 'zaman', 'gonderildi', 'bulut_hesap'].forEach(function (a) { delete f[a]; }); // bulut_hesap 1.2.1'de kaldirildi: eski kayitlardan atilir
      f.kameralar = Array.isArray(f.kameralar) ? f.kameralar : [];
      f.kameralar.forEach(function (k) { if (!k.gorus) k.gorus = S.yeniGorus(vars); });
    } else {
      f = {
        yeni: !paketKaydi, sira_no: paketKaydi ? paketKaydi.sira_no : null,
        enlem: null, boylam: null, dogruluk_m: null, okuma_sayisi: null, sure_s: null, foto: null, kameralar: []
      };
      if (paketKaydi) {
        f.ad = paketKaydi.ad; f.konum_adi = paketKaydi.konum_adi; f.is_adi = paketKaydi.is_adi;
        f.marka = paketKaydi.marka; f.model = paketKaydi.model; f.seri_no = paketKaydi.seri_no; f.seri_son5 = paketKaydi.seri_son5 || '';
        f.kameralar = paketKaydi.kameralar.map(function (c) {
          return {
            kanal_no: c.kanal_no, ad: c.ad, bolge: c.bolge, ptz: c.ptz,
            gorus: {
              yon_derece: c.yon_derece, yon_kaynak: c.yon_derece !== null ? 'elle' : null, yon_manyetik_derece: null, pusula_dogruluk: null,
              aciklik_derece: c.aciklik_derece, menzil_m: c.menzil_m, hedef: null
            },
            gorus_foto: null, 'not': ''
          };
        });
      }
    }
    f.kayit_id = kimlik;
    SOLAR_METIN_ALANLARI.forEach(function (a) { if (typeof f[a] !== 'string') f[a] = ''; });
    if (!f.kameralar.length) {
      var m = S.modeliBul(modeller, f.model) || { kanal_sayisi: S.varsayilanKanalSayisi(paket), ptz_kanallar: [] };
      f.kameralar = S.kanalSablonuUygula([], m, vars);
    }
    return f;
  }

  // Cihaz kaydini (kameralariyla) telefona YENI olcum_id ile yazar: iOS sekme atmasinda taslak kaybolmasin.
  // Yazimlar sirayla zincirlenir; ad bos ise (kayit kimligi/ad zorunlu) yazilmaz.
  function solarTaslakYaz(t) {
    var f = t.f;
    if (t.iptal || !String(f.ad).trim()) return Promise.resolve(false);
    var rec = JSON.parse(JSON.stringify(f));
    rec.ad = rec.ad.trim().slice(0, S.SINIRLAR.ad);
    delete rec.bulut_hesap;
    rec.seri_son5 = S.seriSon5Normalize(rec.seri_son5) || S.seriSon5Turet(rec.seri_no);
    rec.kayit_id = t.kimlik; rec.olcum_id = M.yeniId(); rec.paket_id = durum.solarPaket.paket_id;
    rec.zaman = M.isoYerel(new Date()); rec.gonderildi = null;
    var p = (durum.solarZincir || Promise.resolve()).then(function () { return D.solarKaydet(rec); }).then(function () { t.kayitli = true; return true; });
    durum.solarZincir = p.catch(function () { /* zincir kopmasin; hata cagirana doner */ });
    return p;
  }
  function solarSessizKaydet(t) { solarTaslakYaz(t).catch(hataGoster); }

  /* ---------- cihaz formu ---------- */
  function ekranSolarKayit(paketKaydi, mevcut, yeniId) {
    var paket = durum.solarPaket, esikler = paket.esikler, vars = paket.varsayilanlar, temizlikler = [];
    var kimlik = paketKaydi ? paketKaydi.kayit_id : (mevcut ? mevcut.kayit_id : yeniId);
    var t = durum.solarTaslak && durum.solarTaslak.kimlik === kimlik ? durum.solarTaslak : null;
    if (!t) {
      t = { kimlik: kimlik, f: solarTaslakKur(paket, paketKaydi, mevcut, kimlik), kayitli: !!mevcut };
      durum.solarTaslak = t;
    }
    var f = t.f, modeller = S.modelListesi(paket);
    function degisti() { solarSessizKaydet(t); }

    // alan: f[anahtar] <-> metin girdisi; 'input' belleği, 'change' telefona yazımı tetikler
    function alan(anahtar, etiket, azami, secenek) {
      secenek = secenek || {};
      var id = 'sc-' + anahtar;
      var g = el('input', {
        s: 'girdi', a: {
          type: secenek.tip || 'text', id: id, maxlength: String(azami), autocomplete: 'off',
          inputmode: secenek.mod || 'text', placeholder: secenek.yer || ''
        }
      });
      var uyari = el('p', { s: 'ipucu uyari-yazi' });
      function uyariYaz() { uyari.textContent = secenek.uyari ? secenek.uyari(g.value) : ''; }
      g.value = f[anahtar] || '';
      g.addEventListener('input', function () { f[anahtar] = g.value; uyariYaz(); });
      g.addEventListener('change', function () { f[anahtar] = g.value.trim(); if (secenek.degisti) secenek.degisti(); degisti(); });
      uyariYaz();
      return {
        girdi: g,
        kutu: el('div', {}, [el('label', { s: 'etiket', t: etiket, a: { for: id } }), g, uyari]),
        yenile: function () { g.value = f[anahtar] || ''; uyariYaz(); }
      };
    }
    var ad = alan('ad', 'Cihaz adı *', 100, { yer: 'ör. Solar Kamera Km 2' });
    var konumAdi = alan('konum_adi', 'Bulunduğu konum (ör. Km 2, Tünel-8 Giriş)', 100);
    var isAdi = alan('is_adi', 'Yapılan işin adı (ör. Demir Stok Sahası)', 100);
    var marka = alan('marka', 'Marka', 60);
    var model = alan('model', 'Model', 60);
    var son5Girdi = null, son5Uyari = el('p', { s: 'ipucu uyari-yazi' }), seriOnce = f.seri_no;
    function mevcutKimlik() { return S.seriSon5Normalize(f.seri_son5) || S.seriSon5Turet(f.seri_no); }
    function telefondakiler() {
      var son = solarSonKayitlar(durum.solarKayitlar || []);
      return Object.keys(son).map(function (id) { return son[id]; });
    }
    function kimlikUyarisiYaz() {
      var k = mevcutKimlik(), c = S.kimlikCakismasi(k, kimlik, telefondakiler(), paket.kayitlar);
      son5Uyari.textContent = c ? 'Uyarı: #' + k + ' kimliği başka bir kayıtta da var (' + (c.kaynak === 'paket' ? 'pakette' : 'telefonda') + '). Aynı cihaz olabilir; kaydı engellemez.' : '';
    }
    // Yeni cihaz eklerken ayni kimlikli kayit varsa o kayda yonlendirir (ayni kayit_id -> masaustu ayni cihazi gunceller).
    function kimlikYonlendir() {
      if (paketKaydi || mevcut || t.kayitli) return false;
      var c = S.kimlikCakismasi(mevcutKimlik(), kimlik, telefondakiler(), paket.kayitlar);
      if (!c) return false;
      if (!window.confirm(S.kimlikYonlendirmeMetni(mevcutKimlik(), S.taslakGirdisiVar(f)))) return false;
      var son = solarSonKayitlar(durum.solarKayitlar || []);
      var pk = paket.kayitlar.filter(function (k) { return k.kayit_id === c.kayit_id; })[0] || null;
      var ml = son[c.kayit_id] || null;
      var hedefF = solarTaslakKur(paket, pk, ml, c.kayit_id);
      var b = S.taslagiBirlestir(hedefF, f);
      var yeniT = { kimlik: c.kayit_id, f: b.f, kayitli: !!ml };
      t.iptal = true; durum.solarTaslak = yeniT;
      (durum.solarZincir || Promise.resolve()).then(function () { return D.solarKayitlariGetir(paket.paket_id); }).then(function (liste) { // eski yarim taslak kayitlari silinir
        return Promise.all(liste.filter(function (o) { return o.kayit_id === kimlik; }).map(function (o) { return D.solarSil(o.olcum_id); }));
      }).then(function () { return b.tasinan.length ? solarTaslakYaz(yeniT) : null; }).then(function () { return D.solarKayitlariGetir(paket.paket_id); }).then(function (liste) {
        durum.solarKayitlar = liste; durum.solarTaslak = yeniT;
        if (b.tasinan.length) bildir('Taşındı: ' + b.tasinan.join(', ') + '.', 'tamam');
        degistir(function () { return ekranSolarKayit(pk, solarSonKayitlar(liste)[c.kayit_id] || null, null); });
      }).catch(hataGoster);
      return true;
    }
    var seri = alan('seri_no', 'Seri no (cihaz kimliği: son 5 hane)', 60, {
      degisti: function () {
        var onceki = S.seriSon5Turet(seriOnce), mevcut5 = S.seriSon5Normalize(f.seri_son5);
        if (!mevcut5 || mevcut5 === onceki) f.seri_son5 = S.seriSon5Turet(f.seri_no);
        seriOnce = f.seri_no;
        if (son5Girdi) son5Girdi.value = f.seri_son5 || '';
        kimlikUyarisiYaz();
        if (kimlikYonlendir()) return;
      }
    });
    seri.girdi.addEventListener('input', function () { // yazarken turet; telefona yazim 'change'te
      var onceki = S.seriSon5Turet(seriOnce), mevcut5 = S.seriSon5Normalize(f.seri_son5);
      if (!mevcut5 || mevcut5 === onceki) { f.seri_son5 = S.seriSon5Turet(seri.girdi.value); if (son5Girdi) son5Girdi.value = f.seri_son5; }
      seriOnce = seri.girdi.value;
    });
    var son5 = alan('seri_son5', 'Kimlik: son 5 hane (seri no yazınca dolar; yalnız 5 hane de yazabilirsiniz)', 5, {
      yer: 'ör. 30516',
      degisti: function () {
        f.seri_son5 = S.seriSon5Normalize(f.seri_son5) || '';
        son5Girdi.value = f.seri_son5; kimlikUyarisiYaz();
        kimlikYonlendir();
      }
    });
    son5Girdi = son5.girdi;
    son5Girdi.setAttribute('autocapitalize', 'characters');
    son5Girdi.addEventListener('input', function () { son5Girdi.value = son5Girdi.value.toUpperCase(); f.seri_son5 = son5Girdi.value; });
    kimlikUyarisiYaz();
    var hat = alan('hat_no', 'Hat numarası (M2M SIM)', 30, { tip: 'tel', mod: 'tel' });
    var iccid = alan('iccid', 'ICCID (SIM kart no, 18-20 hane)', 24, { mod: 'numeric', uyari: S.iccidUyarisi });
    var imei = alan('imei', 'IMEI (15 hane)', 20, { mod: 'numeric', uyari: S.imeiUyarisi });
    var operator = alan('operator', 'Operatör', 60);
    var tarife = alan('tarife', 'Tarife / paket', 60);
    var bulutId = alan('bulut_cihaz_id', 'Bulut cihaz ID', 60);
    var panel = alan('panel_bilgi', 'Güneş paneli (ör. 2 x 100 W)', 120);
    var batarya = alan('batarya_bilgi', 'Batarya (ör. 100 Ah)', 120);
    var kurulum = alan('kurulum_tarihi', 'Kurulum tarihi', 10, { tip: 'date' });
    var notGirdi = el('textarea', { s: 'girdi', a: { id: 'sc-not', maxlength: '500', rows: '3', placeholder: 'Not (isteğe bağlı)', 'aria-label': 'Not' } });
    notGirdi.value = f['not'] || '';
    notGirdi.addEventListener('input', function () { f['not'] = notGirdi.value; });
    notGirdi.addEventListener('change', function () { f['not'] = notGirdi.value.trim(); degisti(); });

    /* model secimi -> kanal sablonu */
    var modelSec = el('select', { s: 'girdi', a: { id: 'sc-model-sec', 'aria-label': 'Model şablonu' } });
    modelSec.appendChild(el('option', { t: '— model seçin —', a: { value: '' } }));
    modeller.forEach(function (m) {
      modelSec.appendChild(el('option', { t: m.ad + ' (' + m.kanal_sayisi + ' kanal' + (m.ptz_kanallar.length ? ', PTZ: ' + m.ptz_kanallar.join('/') : '') + ')', a: { value: m.ad } }));
    });
    var mevcutModel = S.modeliBul(modeller, f.model);
    modelSec.value = mevcutModel ? mevcutModel.ad : '';
    modelSec.addEventListener('change', function () {
      var m = S.modeliBul(modeller, modelSec.value);
      if (!m) return;
      var uygula = function () {
        f.kameralar = S.kanalSablonuUygula(f.kameralar, m, vars);
        kanalListesiYaz();
      };
      if (m.ad !== S.DIGER_MODEL) {
        f.model = m.ad;
        if (m.marka) f.marka = m.marka;
        model.yenile(); marka.yenile();
      }
      if (f.kameralar.every(S.kanalBosMu)) uygula();
      else if (window.confirm('Kanal şablonu uygulansın mı? Kanal sayısı ve PTZ işaretleri "' + m.ad + '" şablonuna göre değişir; girdiğiniz ad/yön bilgileri korunur.')) uygula();
      degisti();
    });

    /* konum (tek GPS olcumu) */
    var konumKutu = el('div');
    var onceki = paketKaydi && paketKaydi.enlem !== null ? 'Pakette kayıtlı konum var (' + paketKaydi.enlem.toFixed(6) + ', ' + paketKaydi.boylam.toFixed(6) + '); yeniden ölçerseniz güncellenir. ' : '';
    gpsBlok(konumKutu, esikler, {
      temizlikler: temizlikler, dugme: '📍 Cihaz konumunu al',
      ipucu: onceki + 'Cihazın direğinin yanında, gökyüzü açık bir yerde durun. Ölçüm en fazla ' + M.etkinOlcumSuresi(esikler) +
        ' sn sürer; doğruluk ±' + esikler.iyi_m + ' m altına inerse erken biter. Tek ölçüm tüm kameralar için geçerlidir.',
      sonuc: function () { return f.enlem === null ? null : { enlem: f.enlem, boylam: f.boylam, dogruluk_m: f.dogruluk_m }; },
      onSonuc: function (r) {
        f.enlem = r.enlem; f.boylam = r.boylam; f.dogruluk_m = r.dogruluk_m; f.okuma_sayisi = r.okuma_sayisi; f.sure_s = r.sure_s;
        f.kameralar.forEach(function (k) { // konum degisti: hedef noktali kameralarin yonu yeniden hesaplanir
          if (k.gorus.hedef && k.gorus.yon_kaynak === 'hedef_nokta') {
            var hy = S.hedefYonuHesapla(f.enlem, f.boylam, k.gorus.hedef.enlem, k.gorus.hedef.boylam);
            if (hy) { k.gorus.yon_derece = hy.yon_derece; k.gorus.menzil_m = kisitMenzil(hy.mesafe_m); }
          }
        });
        kanalListesiYaz();
        degisti();
        return null;
      }
    });

    /* durum secimi */
    var durumSec = el('select', { s: 'girdi', a: { id: 'sc-durum', 'aria-label': 'Çalışma durumu' } });
    durumSec.appendChild(el('option', { t: '— seçilmedi —', a: { value: '' } }));
    S.CALISMA_DURUMLARI.forEach(function (d) { durumSec.appendChild(el('option', { t: S.CALISMA_ETIKETLERI[d], a: { value: d } })); });
    durumSec.value = f.calisma_durumu || '';
    durumSec.addEventListener('change', function () { f.calisma_durumu = durumSec.value; degisti(); });

    /* kameralar */
    var kanalKutu = el('div', { s: 'grup-liste' });
    var kanalEkle = dugme('➕ Kanal ekle', '', function () {
      if (f.kameralar.length >= S.MAKS_KANAL) { bildir('En çok ' + S.MAKS_KANAL + ' kanal eklenebilir.', 'uyari'); return; }
      var kullanilan = {};
      f.kameralar.forEach(function (k) { kullanilan[k.kanal_no] = true; });
      var no = 1; while (kullanilan[no]) no++;
      f.kameralar.push(S.yeniKanal(no, false, vars));
      f.kameralar.sort(function (a, b) { return a.kanal_no - b.kanal_no; });
      kanalListesiYaz(); degisti();
    });
    function kanalaGit(no) {
      if (!String(f.ad).trim()) { bildir('Kanala geçmeden önce cihaz adını girin.', 'uyari'); ad.girdi.focus(); return; }
      solarTaslakYaz(t).then(function () { git(function () { return ekranSolarKanal(kimlik, no); }); }).catch(hataGoster);
    }
    function kanalListesiYaz() {
      bosalt(kanalKutu);
      f.kameralar.forEach(function (k) {
        var yonlu = S.kanalYonluMu(k);
        var kart = el('div', { s: 'kart', a: { role: 'button', tabindex: '0', 'data-kanal': String(k.kanal_no) } }, [
          el('div', { s: 'kart-govde' }, [
            el('div', { s: 'kart-baslik' }, [el('span', { t: 'K' + k.kanal_no + ' · ' + k.ad })]),
            k.bolge ? el('div', { t: 'Bölge: ' + k.bolge }) : null,
            el('div', {}, [
              k.ptz ? el('span', { s: 'rozet rozet-ptz', t: 'PTZ' }) : null,
              k.ptz ? document.createTextNode(' ') : null,
              el('span', { s: 'rozet ' + (yonlu ? 'rozet-iyi' : 'rozet-kabul'), t: yonlu ? 'yön tamam' : 'yön eksik' })
            ])
          ])
        ]);
        var ac = function () { kanalaGit(k.kanal_no); };
        kart.addEventListener('click', ac);
        kart.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
        kanalKutu.appendChild(kart);
      });
      kanalEkle.classList.toggle('gizli', f.kameralar.length >= S.MAKS_KANAL);
    }
    kanalListesiYaz();

    var kaydetDugme = dugme('💾 Kaydet', 'birincil buyuk', function () {
      var adMetni = f.ad.trim().slice(0, S.SINIRLAR.ad);
      if (!adMetni) { bildir('Cihaz adı zorunlu.', 'uyari'); ad.girdi.focus(); return; }
      if (f.enlem !== null) {
        var sinif = M.dogrulukSinifi(f.dogruluk_m, esikler);
        if ((sinif === 'kotu' || sinif === 'red') &&
            !window.confirm('Konum doğruluğu zayıf (±' + sayiYaz(f.dogruluk_m) + ' m). Yine de kaydedilsin mi?')) return;
      }
      if (kimlikYonlendir()) return;
      var cakisma = S.kimlikCakismasi(mevcutKimlik(), kimlik, telefondakiler(), paket.kayitlar);
      if (cakisma) bildir('Uyarı: #' + mevcutKimlik() + ' kimliği başka bir kayıtta da var; kayıt yine yapılıyor.', 'uyari');
      var yonsuz = f.kameralar.filter(function (k) { return !S.kanalYonluMu(k); }).length;
      if (yonsuz && !window.confirm(yonsuz + ' kameranın yönü girilmedi; masaüstünde bu kameralar için sektör çizilmeyecek. Yine de kaydedilsin mi?')) return;
      solarTaslakYaz(t).then(function () { bildir('Kaydedildi.', 'tamam'); geri(); }).catch(hataGoster);
    });

    var silDugme = el('div');
    function silDugmeYaz() {
      bosalt(silDugme);
      if (!t.kayitli) return;
      silDugme.appendChild(dugme('🗑 Telefondaki kaydı sil', 'tehlike', function () {
        if (!window.confirm('Bu cihazın telefondaki kaydı (kameralarıyla) silinsin mi? (Masaüstüne gönderilmiş veri etkilenmez.)')) return;
        D.solarKayitlariGetir(paket.paket_id).then(function (liste) {
          return Promise.all(liste.filter(function (o) { return o.kayit_id === kimlik; }).map(function (o) { return D.solarSil(o.olcum_id); }));
        }).then(function () { durum.solarTaslak = null; geri(); }).catch(hataGoster);
      }));
    }
    silDugmeYaz();

    var m2mNotu = f.yeni ? null : el('p', { s: 'ipucu', t: 'Masaüstünde kayıtlı olabilir; boş bırakırsanız değişmez.' });
    durum.temizlik = function () { temizlikler.forEach(function (x) { try { x(); } catch (e) { /* yut */ } }); };
    kok.appendChild(ustBar(f.ad || 'Yeni solar cihaz', paket.lokasyon.ad, true));
    kok.appendChild(el('main', { s: 'icerik' }, [
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Kimlik' }), seri.kutu, son5.kutu, son5Uyari, ad.kutu, konumAdi.kutu, isAdi.kutu,
        el('label', { s: 'etiket', t: 'Model şablonu (kanal sayısını ve PTZ kanallarını belirler)', a: { for: 'sc-model-sec' } }), modelSec,
        marka.kutu, model.kutu]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'M2M hat (SIM)' }), hat.kutu, iccid.kutu, imei.kutu, operator.kutu, tarife.kutu, m2mNotu,
        el('p', { s: 'ipucu', t: 'Hat no ve IMEI sonuç dosyasına yazılır; dosyayı yalnız güvenli kanaldan paylaşın.' })]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Bulut' }), bulutId.kutu,
        el('p', { s: 'ipucu', t: 'Bulut şifresi toplanmaz; buraya yazmayın.' })]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Güç / durum' }), panel.kutu, batarya.kutu, kurulum.kutu,
        el('label', { s: 'etiket', t: 'Çalışma durumu', a: { for: 'sc-durum' } }), durumSec]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Konum' }), konumKutu]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Kameralar' }),
        el('p', { s: 'ipucu', t: 'Her kameranın yönünü kendi ekranında girin: karta dokunun.' }), kanalKutu, kanalEkle]),
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Cihaz fotoğrafı' }), fotoAlani('Cihaz fotoğrafı', f, 'foto', degisti)]),
      el('section', { s: 'kart-bolum' }, [el('label', { s: 'etiket', t: 'Not', a: { for: 'sc-not' } }), notGirdi]),
      kaydetDugme, silDugme
    ]));
  }

  /* ---------- kanal ekrani ---------- */
  function ekranSolarKanal(kimlik, kanalNo) {
    var paket = durum.solarPaket, esikler = paket.esikler, temizlikler = [];
    var t = durum.solarTaslak && durum.solarTaslak.kimlik === kimlik ? durum.solarTaslak : null;
    var k = t ? t.f.kameralar.filter(function (x) { return x.kanal_no === kanalNo; })[0] : null;
    if (!k) {
      bildir('Cihaz formu kapandı; listeden cihazı yeniden açın.', 'uyari');
      degistir(function () { return ekranSolarListe(paket.paket_id); });
      return;
    }
    var f = t.f;
    function degisti() { solarSessizKaydet(t); }

    var adGirdi = el('input', { s: 'girdi', a: { type: 'text', id: 'kn-ad', maxlength: '100', autocomplete: 'off' } });
    adGirdi.value = k.ad || '';
    adGirdi.addEventListener('input', function () { k.ad = adGirdi.value; });
    adGirdi.addEventListener('change', function () { k.ad = adGirdi.value.trim() || ('Kanal ' + k.kanal_no); adGirdi.value = k.ad; degisti(); });
    var bolgeGirdi = el('input', { s: 'girdi', a: { type: 'text', id: 'kn-bolge', maxlength: '100', autocomplete: 'off', placeholder: 'ör. Kuzey kapı, tünel girişi' } });
    bolgeGirdi.value = k.bolge || '';
    bolgeGirdi.addEventListener('input', function () { k.bolge = bolgeGirdi.value; });
    bolgeGirdi.addEventListener('change', function () { k.bolge = bolgeGirdi.value.trim(); degisti(); });
    var notGirdi = el('textarea', { s: 'girdi', a: { id: 'kn-not', maxlength: '500', rows: '3', placeholder: 'Kanal notu (isteğe bağlı)', 'aria-label': 'Kanal notu' } });
    notGirdi.value = k['not'] || '';
    notGirdi.addEventListener('input', function () { k['not'] = notGirdi.value; });
    notGirdi.addEventListener('change', function () { k['not'] = notGirdi.value.trim(); degisti(); });

    var gorus = gorusBlokKur(k.gorus, {
      esikler: esikler, sapma: paket.manyetik_sapma_derece, temizlikler: temizlikler, degisti: degisti,
      ptz: function () { return !!k.ptz; },
      konum: function () { return f.enlem === null ? null : { enlem: f.enlem, boylam: f.boylam }; }
    });
    var ptzKutu = el('input', { a: { type: 'checkbox', id: 'kn-ptz' } });
    ptzKutu.checked = !!k.ptz;
    ptzKutu.addEventListener('change', function () { k.ptz = ptzKutu.checked; gorus.ptzGuncelle(); degisti(); });

    var tamam = dugme('✔ Tamam', 'birincil buyuk', function () {
      solarTaslakYaz(t).then(function () { geri(); }).catch(hataGoster);
    });
    var kaldir = f.kameralar.length > 1 ? dugme('🗑 Bu kanalı kaldır', 'tehlike', function () {
      if (!window.confirm('K' + k.kanal_no + ' kanalı bu cihazdan kaldırılsın mı? (Masaüstündeki kayıt bundan etkilenmez.)')) return;
      f.kameralar = f.kameralar.filter(function (x) { return x !== k; });
      solarTaslakYaz(t).then(function () { geri(); }).catch(hataGoster);
    }) : null;

    durum.temizlik = function () { temizlikler.forEach(function (x) { try { x(); } catch (e) { /* yut */ } }); };
    kok.appendChild(ustBar('K' + k.kanal_no + ' · ' + (k.ad || 'Kanal'), f.ad, true));
    kok.appendChild(el('main', { s: 'icerik' }, [
      el('section', { s: 'kart-bolum' }, [
        el('label', { s: 'etiket', t: 'Kanal adı', a: { for: 'kn-ad' } }), adGirdi,
        el('label', { s: 'etiket', t: 'Bölge (kameranın izlediği yer)', a: { for: 'kn-bolge' } }), bolgeGirdi,
        el('label', { s: 'onay-satir', a: { for: 'kn-ptz' } }, [ptzKutu, document.createTextNode(' PTZ kamera (döner başlık)')])
      ]),
      gorus.kutu,
      el('section', { s: 'kart-bolum' }, [el('h2', { t: 'Görüş fotoğrafı' }), fotoAlani('Görüş fotoğrafı (kameranın baktığı yön)', k, 'gorus_foto', degisti)]),
      el('section', { s: 'kart-bolum' }, [el('label', { s: 'etiket', t: 'Not', a: { for: 'kn-not' } }), notGirdi]),
      tamam, kaldir
    ]));
  }

  function ekranSolarGonder() {
    var paket = durum.solarPaket;
    var blobUrl = null, dosya = null, dosyaAdi = '', uretilen = null;
    var olcenGirdi = el('input', { s: 'girdi', a: { type: 'text', id: 'olcen3', maxlength: '100', placeholder: 'Ad Soyad' } });
    olcenGirdi.value = durum.olcen;
    var ozet = el('div', { s: 'sonuc-kutu' });
    var indir = el('a', { s: 'dugme birincil buyuk', t: '⬇ Dosyayı indir', a: { role: 'button' } });
    var paylas = dugme('📤 Paylaş (WhatsApp / e-posta)', 'birincil buyuk', function () {
      if (!dosya) return;
      navigator.share({ files: [dosya], title: 'Solar cihaz sonucu' }).then(function () {
        return isaretle();
      }).catch(function (e) {
        if (e && e.name !== 'AbortError') bildir('Paylaşım açılamadı; "Dosyayı indir" düğmesini kullanın.', 'uyari');
      });
    });
    paylas.classList.add('gizli');
    // İndirme tıklaması "gönderildi" SAYILMAZ; kullanıcı dosyanın ulaştığını açıkça onaylar.
    var onayDugme = dugme('✔ Dosya karşıya ulaştı: gönderildi olarak işaretle', '', function () { isaretle(); });
    onayDugme.classList.add('gizli');
    indir.addEventListener('click', function () { onayDugme.classList.remove('gizli'); });

    function isaretle() {
      if (!uretilen) return Promise.resolve();
      return D.solarGonderildiIsaretle(uretilen, new Date().toISOString()).then(function () {
        onayDugme.classList.add('gizli');
        bildir('Kayıtlar gönderildi olarak işaretlendi.', 'tamam');
        return uret();
      });
    }
    function urlGeciktirilmisSil(u) { if (u) setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }

    function uret() {
      return D.solarKayitlariGetir(paket.paket_id).then(function (liste) {
        var simdi = new Date();
        var sonuc = S.solarSonucOlustur({ paket: paket, olcen: durum.olcen, kayitlar: liste, simdi: simdi, user_agent: navigator.userAgent });
        uretilen = liste;
        var json = JSON.stringify(sonuc);
        var blob = new Blob([json], { type: 'text/plain' });
        dosyaAdi = S.solarDosyaAdi(paket.lokasyon.ad, simdi);
        dosya = null;
        try { dosya = new File([blob], dosyaAdi, { type: 'text/plain' }); } catch (e) { dosya = null; }
        urlGeciktirilmisSil(blobUrl);
        blobUrl = URL.createObjectURL(blob);
        indir.href = blobUrl; indir.setAttribute('download', dosyaAdi);
        var gonderilmemis = liste.filter(function (o) { return !o.gonderildi; }).length;
        var fotoSayisi = 0, yonsuz = 0, kameraSayisi = 0;
        sonuc.kayitlar.forEach(function (k) {
          if (k.foto) fotoSayisi++;
          k.kameralar.forEach(function (c) {
            kameraSayisi++;
            if (c.gorus_foto) fotoSayisi++;
            if (c.gorus.yon_derece === null) yonsuz++;
          });
        });
        bosalt(ozet);
        ozet.appendChild(el('div', { s: 'buyuk-sayi', t: sonuc.kayitlar.length + ' cihaz · ' + kameraSayisi + ' kamera' }));
        ozet.appendChild(el('div', { t: 'Gönderilmemiş: ' + gonderilmemis + ' · Fotoğraf: ' + fotoSayisi + ' · Yönü girilmemiş kamera: ' + yonsuz }));
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
    kok.appendChild(ustBar('Solar sonucu gönder', paket.lokasyon.ad, true));
    kok.appendChild(el('main', { s: 'icerik' }, [
      el('section', { s: 'kart-bolum' }, [el('label', { s: 'etiket', t: 'Ölçümü yapan kişi', a: { for: 'olcen3' } }), olcenGirdi]),
      el('p', { s: 'uyari-kutu', t: 'Sonuç dosyası hat no / IMEI içerir; yalnız güvenli kanaldan paylaşın.' }),
      ozet, paylas, indir, onayDugme,
      el('p', { s: 'ipucu', t: 'Dosyayı WhatsApp ya da e-posta ile masaüstü uygulamasını kullanan kişiye gönderin. Her cihaz için yalnız son kayıt yer alır. İndirme düğmesi kayıtları kendiliğinden "gönderildi" yapmaz; dosya ulaşınca onay düğmesine basın.' })
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
