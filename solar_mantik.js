/* Solar modu - DOM'suz saf mantik. Tarayicida global `SolarMantik` (mantik.js'ten SONRA yuklenir),
   Node'da module.exports. Sozlesme: docs/SOLAR_PLAN.md. */
(function (kok, fabrika) {
  'use strict';
  var temel = kok.SahaMantik || (typeof module === 'object' && module.exports && typeof require === 'function' ? require('./mantik.js') : null);
  var m = fabrika(temel);
  if (typeof module === 'object' && module.exports) { module.exports = m; }
  kok.SolarMantik = m;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var PAKET_TURU = 'kamera_tespit.solar_paketi';
  var SONUC_TURU = 'kamera_tespit.solar_sonucu';
  var PAKET_SURUMU = 2; // v1 (tek kamera) paketleri AYRICA reddedilir; geriye uyum yok
  // masaustu hem tireli uuid hem 32 haneli hex (uuid4().hex) uretebilir
  var UUID_DESENI = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;
  var SINIRLAR = {
    ad: 100, bolge: 100, konum_adi: 100, is_adi: 100, not: 500, marka: 60, model: 60, seri_no: 60, hat_no: 30, donanim: 120,
    olcen: 100, lokasyon: 200,
    kayit: 2000, aciklik_min: 1, aciklik_maks: 360, menzil_min: 1, menzil_maks: 500,
    foto_baytlari: 400 * 1024, dosya_bayt: 60 * 1024 * 1024
  };
  var VARSAYILAN = { aciklik_derece: 90, menzil_m: 30, kanal_sayisi: 4 };
  var VARSAYILAN_SAPMA = 5.5;
  var VARSAYILAN_ESIKLER = { iyi_m: 5, kabul_m: 15, red_m: 30, olcum_suresi_s: 45 };
  // Hazir aciklik degerleri (lens odak uzakligi -> yaklasik gorus acisi)
  var ACIKLIK_HAZIR = [
    { etiket: '2,8 mm ≈ 100°', derece: 100 },
    { etiket: '4 mm ≈ 85°', derece: 85 },
    { etiket: '6 mm ≈ 55°', derece: 55 },
    { etiket: 'PTZ / bilinmiyor = 360°', derece: 360 }
  ];
  var KAYNAKLAR = ['hedef_nokta', 'pusula', 'elle'];
  var YON_ADLARI = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];

  function sonluMu(x) { return typeof x === 'number' && isFinite(x); }
  function yuvarla(x, b) { var k = Math.pow(10, b); return Math.round(x * k) / k; }
  function aralikta(x, a, b) { return sonluMu(x) && x >= a && x <= b; }
  function kisit(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function mod360(d) { return ((d % 360) + 360) % 360; }

  // Kontrol karakterlerini atip kirpar (mantik.js'teki metin ile ayni kural; o disa acik degil).
  function metin(x, azami) {
    if (typeof x !== 'string') return '';
    var t = x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    return t.length > azami ? t.slice(0, azami) : t;
  }

  /* ---------- yon / geometri ---------- */
  // Gercek kuzeye gore ileri kerteriz (initial bearing) + haversine mesafe.
  // Gecersiz girdide null. Cikti: {yon_derece: [0,360), mesafe_m}
  function hedefYonuHesapla(en1, bo1, en2, bo2) {
    if (!aralikta(en1, -90, 90) || !aralikta(en2, -90, 90) || !aralikta(bo1, -180, 180) || !aralikta(bo2, -180, 180)) return null;
    var r = Math.PI / 180, f1 = en1 * r, f2 = en2 * r, dl = (bo2 - bo1) * r;
    var y = Math.sin(dl) * Math.cos(f2);
    var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    var yon = mod360(Math.atan2(y, x) / r);
    if (yon >= 359.95) yon = 0; // 1 basamaga yuvarlayinca 360 cikmasin
    return { yon_derece: yuvarla(yon, 1), mesafe_m: M.haversine(en1, bo1, en2, bo2) };
  }

  function manyetiktenGercege(yon, sapma) {
    if (!sonluMu(yon)) return null;
    var s = sonluMu(sapma) ? sapma : VARSAYILAN_SAPMA;
    var d = yuvarla(mod360(yon + s), 1);
    return d >= 360 ? 0 : d;
  }

  // Dairesel ortalama (0/360 gecisinde dogru). Bos ya da birbirini goturen (R~0) dizide null.
  function dairselOrtalama(dizi) {
    var ss = 0, cc = 0, n = 0;
    (dizi || []).forEach(function (d) {
      if (!sonluMu(d)) return;
      ss += Math.sin(d * Math.PI / 180); cc += Math.cos(d * Math.PI / 180); n++;
    });
    if (!n) return null;
    var R = Math.sqrt(ss * ss + cc * cc) / n;
    if (R < 1e-6) return null;
    return mod360(Math.atan2(ss / n, cc / n) * 180 / Math.PI);
  }

  // Dairesel standart sapma (derece).
  function dairselSapma(dizi) {
    var ss = 0, cc = 0, n = 0;
    (dizi || []).forEach(function (d) {
      if (!sonluMu(d)) return;
      ss += Math.sin(d * Math.PI / 180); cc += Math.cos(d * Math.PI / 180); n++;
    });
    if (!n) return null;
    var R = Math.min(1, Math.sqrt(ss * ss + cc * cc) / n);
    if (R <= 1e-9) return 180;
    return Math.sqrt(Math.max(0, -2 * Math.log(R))) * 180 / Math.PI;
  }

  function yonAdi(derece) {
    if (!sonluMu(derece)) return '';
    return YON_ADLARI[Math.round(mod360(derece) / 45) % 8];
  }

  // Android: W3C DeviceOrientation (alpha/beta/gamma) -> cihazin ARKA yuzunun gosterdigi pusula yonu.
  function pusulaYonuAlfaBeta(alpha, beta, gamma) {
    if (!sonluMu(alpha) || !sonluMu(beta) || !sonluMu(gamma)) return null;
    var r = Math.PI / 180, x = beta * r, y = gamma * r, z = alpha * r;
    var cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    var vx = -cZ * sY - sZ * sX * cY, vy = -sZ * sY + cZ * sX * cY;
    if (Math.abs(vx) < 1e-9 && Math.abs(vy) < 1e-9) return null; // telefon yatay, arka yuz yukari/asagi
    return mod360(Math.atan2(vx, vy) / r);
  }

  /* ---------- pusula okumasi ---------- */
  function pusulaHata(kod) {
    var mesaj;
    switch (kod) {
      case 'izin_yok':
        mesaj = 'Pusula izni verilmedi. iPhone: Safari adres çubuğundaki "aA" > Web Sitesi Ayarları > Hareket ve Yön erişimi > İzin ver; sonra sayfayı yenileyip tekrar deneyin. Ya da yönü elle girin.';
        break;
      case 'desteklenmiyor':
        mesaj = 'Bu telefon/tarayıcı pusula verisi vermiyor. Yönü elle girin ya da hedef nokta yöntemini kullanın.';
        break;
      case 'yetersiz':
        mesaj = 'Yeterli pusula okuması alınamadı. Telefonu düz tutup 8 çizerek kalibre edin, tekrar deneyin ya da yönü elle girin.';
        break;
      default:
        mesaj = 'Pusula okunamadı. Yönü elle girin.';
    }
    return { kod: kod, mesaj: mesaj };
  }

  // pencere: window benzeri {addEventListener, removeEventListener, DeviceOrientationEvent}.
  // iOS'ta izin istegi KULLANICI DOKUNUSUNUN icinden, senkron cagrilmalidir: bu islevi dugme tiklamasindan cagirin.
  // ayar: {sure_s=3, min_okuma=8, setTimeout, clearTimeout}
  // cb: {onOkuma(derece, sayi), onBitti({yon_manyetik_derece, pusula_dogruluk, okuma_sayisi, kaynak}), onHata({kod, mesaj})}
  function pusulaOkumasi(pencere, ayar, cb) {
    ayar = ayar || {}; cb = cb || {};
    var setT = ayar.setTimeout || setTimeout, clrT = ayar.clearTimeout || clearTimeout;
    var sureMs = (sonluMu(ayar.sure_s) ? ayar.sure_s : 3) * 1000;
    var minOkuma = ayar.min_okuma || 8;
    var okumalar = [], dogruluklar = [], bitti = false, zamanlayici = null, dinliyor = false, kaynak = null;
    var iptalNesnesi = { iptal: function () { if (!bitti) temizle(); } };
    function hata(kod) { if (cb.onHata) cb.onHata(pusulaHata(kod)); }
    if (!pencere || typeof pencere.addEventListener !== 'function') { hata('desteklenmiyor'); return iptalNesnesi; }

    function isle(e) {
      if (bitti || !e) return;
      var derece = null;
      if (sonluMu(e.webkitCompassHeading)) {
        derece = mod360(e.webkitCompassHeading); // iOS: egimden bagimsiz, manyetik kuzeye gore
        kaynak = 'ios';
        if (sonluMu(e.webkitCompassHeadingAccuracy) && e.webkitCompassHeadingAccuracy >= 0) dogruluklar.push(e.webkitCompassHeadingAccuracy);
      } else if (e.absolute === true) {
        derece = pusulaYonuAlfaBeta(e.alpha, e.beta, e.gamma);
        kaynak = kaynak || 'android';
      }
      if (derece === null) return;
      okumalar.push(derece);
      if (cb.onOkuma) cb.onOkuma(derece, okumalar.length);
    }
    function dinle() {
      if (bitti) return;
      dinliyor = true;
      pencere.addEventListener('deviceorientationabsolute', isle, true);
      pencere.addEventListener('deviceorientation', isle, true);
      zamanlayici = setT(bitir, sureMs);
    }
    function temizle() {
      bitti = true;
      if (zamanlayici !== null) clrT(zamanlayici);
      if (dinliyor && typeof pencere.removeEventListener === 'function') {
        pencere.removeEventListener('deviceorientationabsolute', isle, true);
        pencere.removeEventListener('deviceorientation', isle, true);
      }
    }
    function bitir() {
      if (bitti) return;
      temizle();
      if (!okumalar.length) { hata('desteklenmiyor'); return; }
      var ort = okumalar.length >= minOkuma ? dairselOrtalama(okumalar) : null;
      if (ort === null) { hata('yetersiz'); return; }
      var sap = dairselSapma(okumalar), isDog = dogruluklar.length ? Math.max.apply(null, dogruluklar) : 0;
      cb.onBitti({
        yon_manyetik_derece: yuvarla(ort, 1) >= 360 ? 0 : yuvarla(ort, 1),
        pusula_dogruluk: yuvarla(Math.max(sap === null ? 0 : sap, isDog), 1),
        okuma_sayisi: okumalar.length, kaynak: kaynak
      });
    }

    var DOE = pencere.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      var vaat;
      try { vaat = DOE.requestPermission(); } catch (e) { hata('izin_yok'); return iptalNesnesi; }
      Promise.resolve(vaat).then(function (s) {
        if (bitti) return;
        if (s === 'granted') dinle(); else { bitti = true; hata('izin_yok'); }
      }).catch(function () { if (!bitti) { bitti = true; hata('izin_yok'); } });
    } else {
      dinle();
    }
    return iptalNesnesi;
  }

  /* ---------- model sablonlari / kanal ---------- */
  // Paketin `modeller` listesi bos/yoksa kullanilan sabit sablon (docs/SOLAR_PLAN.md).
  var MODELLER = [
    { ad: 'AV-S446', marka: 'Avenir', kanal_sayisi: 4, ptz_kanallar: [2, 3, 4] },
    { ad: 'O-Kam', marka: 'O-Kam', kanal_sayisi: 4, ptz_kanallar: [] },
    { ad: 'INOX', marka: 'INOX', kanal_sayisi: 4, ptz_kanallar: [] },
    { ad: 'Diğer', marka: '', kanal_sayisi: 4, ptz_kanallar: [] }
  ];
  var DIGER_MODEL = 'Diğer';
  var MAKS_KANAL = 8;
  var CALISMA_DURUMLARI = ['calisiyor', 'arizali', 'bakimda', 'bilinmiyor'];
  var CALISMA_ETIKETLERI = { calisiyor: 'Çalışıyor', arizali: 'Arızalı', bakimda: 'Bakımda', bilinmiyor: 'Bilinmiyor' };

  function kanalNoGecerli(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 1 && n <= MAKS_KANAL; }

  function modelNormalize(m) {
    if (!m || typeof m !== 'object') return null;
    var ad = metin(m.ad, SINIRLAR.model);
    if (!ad) return null;
    var sayi = kanalNoGecerli(m.kanal_sayisi) ? m.kanal_sayisi : 4, ptz = [];
    (Array.isArray(m.ptz_kanallar) ? m.ptz_kanallar : []).forEach(function (n) {
      if (kanalNoGecerli(n) && n <= sayi && ptz.indexOf(n) === -1) ptz.push(n);
    });
    ptz.sort(function (a, b) { return a - b; });
    return { ad: ad, marka: metin(m.marka, SINIRLAR.marka), kanal_sayisi: sayi, ptz_kanallar: ptz };
  }

  // Secim listesi: paketin modelleri oncelikli (bos ise sabit MODELLER); "Diger" her zaman sonda bulunur.
  function modelListesi(paket) {
    var kaynak = paket && Array.isArray(paket.modeller) && paket.modeller.length ? paket.modeller : MODELLER;
    var liste = [], gorulen = {};
    kaynak.forEach(function (m) {
      var n = modelNormalize(m);
      if (!n || gorulen[n.ad.toLowerCase()]) return;
      gorulen[n.ad.toLowerCase()] = true;
      liste.push(n);
    });
    if (!gorulen[DIGER_MODEL.toLowerCase()]) liste.push({ ad: DIGER_MODEL, marka: '', kanal_sayisi: 4, ptz_kanallar: [] });
    return liste;
  }
  function modeliBul(liste, ad) {
    var a = String(ad || '').trim().toLowerCase();
    if (!a) return null;
    for (var i = 0; i < liste.length; i++) { if (liste[i].ad.toLowerCase() === a) return liste[i]; }
    return null;
  }

  function varsayilanKanalSayisi(paket) {
    var v = paket && paket.varsayilanlar ? paket.varsayilanlar.kanal_sayisi : null;
    return kanalNoGecerli(v) ? v : 4;
  }

  function yeniGorus(vars) {
    var v = vars || VARSAYILAN;
    return {
      yon_derece: null, yon_kaynak: null, yon_manyetik_derece: null, pusula_dogruluk: null,
      aciklik_derece: v.aciklik_derece, menzil_m: v.menzil_m, hedef: null
    };
  }
  function yeniKanal(kanalNo, ptz, vars) {
    return { kanal_no: kanalNo, ad: 'Kanal ' + kanalNo, bolge: '', ptz: !!ptz, gorus: yeniGorus(vars), gorus_foto: null, 'not': '' };
  }

  // Model sablonundan kanal listesi. mevcut: onceki kameralar (kanal_no ile eslenir, verisi KORUNUR).
  function kanalSablonuUygula(mevcut, model, vars) {
    var sayi = model && kanalNoGecerli(model.kanal_sayisi) ? model.kanal_sayisi : 4;
    var ptz = model && Array.isArray(model.ptz_kanallar) ? model.ptz_kanallar : [];
    var eski = {};
    (mevcut || []).forEach(function (k) { if (k && kanalNoGecerli(k.kanal_no)) eski[k.kanal_no] = k; });
    var sonuc = [], n;
    for (n = 1; n <= sayi; n++) {
      var k = eski[n] || yeniKanal(n, false, vars);
      k.ptz = ptz.indexOf(n) !== -1;
      sonuc.push(k);
    }
    // sablonda olmayan ama verisi dolu kanallar silinmez
    Object.keys(eski).map(Number).sort(function (a, b) { return a - b; }).forEach(function (no) {
      if (no > sayi && !kanalBosMu(eski[no])) sonuc.push(eski[no]);
    });
    return sonuc;
  }

  // Kullanicinin hic dokunmadigi kanal mi (varsayilan ad, bos alan, yon/foto yok)?
  function kanalBosMu(k) {
    if (!k) return true;
    var g = k.gorus || {};
    return (!k.ad || k.ad === 'Kanal ' + k.kanal_no) && !k.bolge && !k['not'] && !k.gorus_foto &&
      (g.yon_derece === null || g.yon_derece === undefined);
  }

  function kanalYonluMu(k) { return !!(k && k.gorus && sonluMu(k.gorus.yon_derece)); }
  // {yonlu, toplam}: liste ekraninda "3/4 kamera yonlu"
  function yonOzeti(kameralar) {
    var toplam = 0, yonlu = 0;
    (kameralar || []).forEach(function (k) {
      toplam++;
      var y = k && k.gorus ? k.gorus.yon_derece : (k ? k.yon_derece : null);
      if (sonluMu(y)) yonlu++;
    });
    return { yonlu: yonlu, toplam: toplam };
  }

  /* ---------- IMEI / ICCID bicimi (Luhn uyumsuzlugu UYARIDIR, kaydi engellemez) ---------- */
  function yalnizRakam(s) { return String(s === null || s === undefined ? '' : s).replace(/\D+/g, ''); }
  function luhnGecerliMi(rakamlar) {
    var s = String(rakamlar || '');
    if (!/^\d+$/.test(s)) return false;
    var toplam = 0, cift = false, i;
    for (i = s.length - 1; i >= 0; i--) {
      var d = s.charCodeAt(i) - 48;
      if (cift) { d *= 2; if (d > 9) d -= 9; }
      toplam += d; cift = !cift;
    }
    return toplam % 10 === 0;
  }
  function imeiGecerliMi(s) { var r = yalnizRakam(s); return r.length === 15 && luhnGecerliMi(r); }
  function iccidGecerliMi(s) { var r = yalnizRakam(s); return r.length >= 18 && r.length <= 20 && luhnGecerliMi(r); }
  // Bos metin = uyari yok; aksi halde Turkce uyari metni.
  function imeiUyarisi(s) {
    var r = yalnizRakam(s);
    if (!r) return '';
    if (r.length !== 15) return 'IMEI 15 haneli olmalı (' + r.length + ' hane girildi). Kayıt engellenmez; kontrol edin.';
    if (!luhnGecerliMi(r)) return 'IMEI sağlama (Luhn) kontrolünden geçmedi; bir hane yanlış olabilir. Kayıt engellenmez.';
    return '';
  }
  function iccidUyarisi(s) {
    var r = yalnizRakam(s);
    if (!r) return '';
    if (r.length < 18 || r.length > 20) return 'ICCID 18-20 haneli olmalı (' + r.length + ' hane girildi). Kayıt engellenmez; kontrol edin.';
    if (!luhnGecerliMi(r)) return 'ICCID sağlama (Luhn) kontrolünden geçmedi; bir hane yanlış olabilir. Kayıt engellenmez.';
    return '';
  }

  /* ---------- paket dogrulama (surum 2) ---------- */
  function paketKamerasi(c, varsayilan) {
    if (!c || typeof c !== 'object' || !kanalNoGecerli(c.kanal_no)) return null;
    return {
      kanal_no: c.kanal_no, ad: metin(c.ad, SINIRLAR.ad) || ('Kanal ' + c.kanal_no), bolge: metin(c.bolge, SINIRLAR.bolge),
      ptz: c.ptz === true || c.ptz === 1,
      yon_derece: aralikta(c.yon_derece, 0, 360) ? (c.yon_derece >= 360 ? 0 : c.yon_derece) : null,
      aciklik_derece: aralikta(c.aciklik_derece, SINIRLAR.aciklik_min, SINIRLAR.aciklik_maks) ? c.aciklik_derece : varsayilan.aciklik_derece,
      menzil_m: aralikta(c.menzil_m, SINIRLAR.menzil_min, SINIRLAR.menzil_maks) ? c.menzil_m : varsayilan.menzil_m
    };
  }

  function paketDogrula_kayit(k, varsayilan) {
    if (!k || typeof k !== 'object') return null;
    if (typeof k.kayit_id !== 'string' || !UUID_DESENI.test(k.kayit_id)) return null;
    var ad = metin(k.ad, SINIRLAR.ad);
    if (!ad) return null;
    var konumVar = aralikta(k.enlem, -90, 90) && aralikta(k.boylam, -180, 180);
    var kameralar = [], gorulen = {};
    (Array.isArray(k.kameralar) ? k.kameralar : []).forEach(function (c) {
      var n = paketKamerasi(c, varsayilan);
      if (!n || gorulen[n.kanal_no] || kameralar.length >= MAKS_KANAL) return;
      gorulen[n.kanal_no] = true;
      kameralar.push(n);
    });
    kameralar.sort(function (a, b) { return a.kanal_no - b.kanal_no; });
    return {
      kayit_id: k.kayit_id.toLowerCase(), ad: ad,
      sira_no: sonluMu(k.sira_no) && Math.floor(k.sira_no) === k.sira_no && k.sira_no >= 1 && k.sira_no <= 100000 ? k.sira_no : null,
      konum_adi: metin(k.konum_adi, SINIRLAR.konum_adi), is_adi: metin(k.is_adi, SINIRLAR.is_adi),
      enlem: konumVar ? k.enlem : null, boylam: konumVar ? k.boylam : null,
      marka: metin(k.marka, SINIRLAR.marka), model: metin(k.model, SINIRLAR.model), seri_no: metin(k.seri_no, SINIRLAR.seri_no),
      kameralar: kameralar
    };
  }

  function solarPaketDogrula(veri) {
    var hatalar = [], uyarilar = [], cikti = null;
    function bitir() { return { ok: hatalar.length === 0, hatalar: hatalar, uyarilar: uyarilar, paket: hatalar.length ? null : cikti }; }
    if (!veri || typeof veri !== 'object' || Array.isArray(veri)) {
      hatalar.push('Dosya geçerli bir solar paketi değil.');
      return bitir();
    }
    if (veri.tur !== PAKET_TURU) hatalar.push('Bu dosya bir solar paketi değil (tür uyuşmuyor).');
    if (veri.surum !== PAKET_SURUMU) {
      hatalar.push(veri.surum === 1
        ? 'Bu solar paketi eski sürüm (1) ve artık desteklenmiyor; masaüstü uygulamasından yeni bir solar paketi üretin.'
        : 'Desteklenmeyen paket sürümü: ' + String(veri.surum).slice(0, 20) + ' (beklenen: ' + PAKET_SURUMU + ').');
    }
    var pid = veri.paket_id;
    if (typeof pid !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(pid)) hatalar.push('Paket kimliği (paket_id) geçersiz.');
    var lok = veri.lokasyon;
    var lokAd = lok && typeof lok === 'object' ? metin(lok.ad, SINIRLAR.lokasyon) : '';
    if (!lokAd) hatalar.push('Lokasyon adı eksik.');
    if (!Array.isArray(veri.kayitlar)) hatalar.push('Kayıt listesi (kayitlar) eksik.');
    else if (veri.kayitlar.length > SINIRLAR.kayit) hatalar.push('Pakette çok fazla kayıt var (en çok ' + SINIRLAR.kayit + ').');

    var esikler = {}, eh = veri.esikler && typeof veri.esikler === 'object' ? veri.esikler : {};
    Object.keys(VARSAYILAN_ESIKLER).forEach(function (k) {
      var v = eh[k];
      if (v === undefined || v === null) { esikler[k] = VARSAYILAN_ESIKLER[k]; return; }
      if (!sonluMu(v) || v <= 0) { hatalar.push('Eşik değeri geçersiz: ' + k); return; }
      esikler[k] = v;
    });
    if (!hatalar.length && !(esikler.iyi_m <= esikler.kabul_m && esikler.kabul_m <= esikler.red_m)) {
      hatalar.push('Doğruluk eşikleri tutarsız (iyi <= kabul <= red olmalı).');
    }
    var vh = veri.varsayilanlar && typeof veri.varsayilanlar === 'object' ? veri.varsayilanlar : {};
    var varsayilan = {
      aciklik_derece: aralikta(vh.aciklik_derece, SINIRLAR.aciklik_min, SINIRLAR.aciklik_maks) ? vh.aciklik_derece : VARSAYILAN.aciklik_derece,
      menzil_m: aralikta(vh.menzil_m, SINIRLAR.menzil_min, SINIRLAR.menzil_maks) ? vh.menzil_m : VARSAYILAN.menzil_m,
      kanal_sayisi: kanalNoGecerli(vh.kanal_sayisi) ? vh.kanal_sayisi : VARSAYILAN.kanal_sayisi
    };
    var sapma = VARSAYILAN_SAPMA;
    if (veri.manyetik_sapma_derece !== undefined && veri.manyetik_sapma_derece !== null) {
      if (!aralikta(veri.manyetik_sapma_derece, -45, 45)) hatalar.push('Manyetik sapma değeri geçersiz.');
      else sapma = veri.manyetik_sapma_derece;
    }
    if (hatalar.length) return bitir();

    var modeller = [], mGorulen = {};
    (Array.isArray(veri.modeller) ? veri.modeller : []).slice(0, 30).forEach(function (m) {
      var n = modelNormalize(m);
      if (!n || mGorulen[n.ad.toLowerCase()]) return;
      mGorulen[n.ad.toLowerCase()] = true;
      modeller.push(n);
    });

    var kayitlar = [], gorulen = {}, atlanan = 0;
    veri.kayitlar.forEach(function (k) {
      var n = paketDogrula_kayit(k, varsayilan);
      if (!n || gorulen[n.kayit_id]) { atlanan++; return; }
      gorulen[n.kayit_id] = true;
      kayitlar.push(n);
    });
    if (atlanan) uyarilar.push(atlanan + ' kayıt geçersiz/yinelenen olduğu için atlandı.');

    cikti = {
      tur: PAKET_TURU, surum: PAKET_SURUMU, paket_id: pid, olusturma: metin(veri.olusturma, 40),
      lokasyon: {
        id: sonluMu(lok.id) ? lok.id : null, ad: lokAd,
        enlem: aralikta(lok.enlem, -90, 90) ? lok.enlem : null, boylam: aralikta(lok.boylam, -180, 180) ? lok.boylam : null
      },
      esikler: esikler, varsayilanlar: varsayilan, manyetik_sapma_derece: sapma, modeller: modeller, kayitlar: kayitlar
    };
    return bitir();
  }

  /* ---------- sonuc (surum 2) ---------- */
  function fotoDegeri(f) { return M.jpegDataUrlGecerliMi(f, SINIRLAR.foto_baytlari) ? f : null; }
  function sayiVeyaNull(x, a, b, basamak) { return aralikta(x, a, b) ? yuvarla(x, basamak) : null; }
  function metinNull(x, azami) { var t = metin(x, azami); return t ? t : null; }
  function rakamNull(x, azami) { var r = yalnizRakam(x).slice(0, azami); return r ? r : null; }
  function tarihNull(x) {
    if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
    var p = x.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2] ? x : null;
  }

  // Bir kameranin gorus blogu -> sonuc sozlesmesi. Pusulada yon_derece = (manyetik + sapma) mod 360 BURADA hesaplanir.
  function gorusSatiri(g, paket) {
    g = g && typeof g === 'object' ? g : {};
    var vars = paket && paket.varsayilanlar ? paket.varsayilanlar : VARSAYILAN;
    var sapma = paket && sonluMu(paket.manyetik_sapma_derece) ? paket.manyetik_sapma_derece : VARSAYILAN_SAPMA;
    var yon = sayiVeyaNull(g.yon_derece, 0, 360, 1);
    if (yon !== null && yon >= 360) yon = 0;
    var kaynak = yon !== null && KAYNAKLAR.indexOf(g.yon_kaynak) !== -1 ? g.yon_kaynak : (yon !== null ? 'elle' : null);
    var manyetik = null;
    if (kaynak === 'pusula') {
      manyetik = sayiVeyaNull(g.yon_manyetik_derece, 0, 360, 1);
      if (manyetik === null) kaynak = 'elle'; // ham olcum yoksa pusula iddiasi tasinmaz
      else yon = manyetiktenGercege(manyetik, sapma);
    }
    var hedef = null;
    if (kaynak === 'hedef_nokta' && g.hedef && aralikta(g.hedef.enlem, -90, 90) && aralikta(g.hedef.boylam, -180, 180)) {
      hedef = {
        enlem: g.hedef.enlem, boylam: g.hedef.boylam,
        dogruluk_m: sonluMu(g.hedef.dogruluk_m) && g.hedef.dogruluk_m > 0 ? g.hedef.dogruluk_m : null
      };
    }
    return {
      yon_derece: yon, yon_kaynak: kaynak, yon_manyetik_derece: manyetik,
      pusula_dogruluk: kaynak === 'pusula' ? sayiVeyaNull(g.pusula_dogruluk, 0, 360, 1) : null,
      aciklik_derece: aralikta(g.aciklik_derece, SINIRLAR.aciklik_min, SINIRLAR.aciklik_maks) ? g.aciklik_derece : vars.aciklik_derece,
      menzil_m: aralikta(g.menzil_m, SINIRLAR.menzil_min, SINIRLAR.menzil_maks) ? Math.round(g.menzil_m) : vars.menzil_m,
      hedef: hedef
    };
  }

  function kameraSatiri(c, paket) {
    if (!c || typeof c !== 'object' || !kanalNoGecerli(c.kanal_no)) return null;
    return {
      kanal_no: c.kanal_no, ad: metin(c.ad, SINIRLAR.ad) || ('Kanal ' + c.kanal_no), bolge: metinNull(c.bolge, SINIRLAR.bolge),
      ptz: c.ptz === true, gorus: gorusSatiri(c.gorus, paket), gorus_foto: fotoDegeri(c.gorus_foto),
      'not': metinNull(c['not'], SINIRLAR.not)
    };
  }

  // Telefon kaydi (cihaz + kameralar[]) -> sonuc satiri. Gecersiz (ad ya da kimlik eksik) ise null.
  // Bos birakilan alan null gider: masaustunde eskisini EZMEZ.
  function kayitSatiri(o, paket) {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.olcum_id !== 'string' || typeof o.kayit_id !== 'string') return null;
    var ad = metin(o.ad, SINIRLAR.ad);
    if (!ad) return null;
    var konumVar = aralikta(o.enlem, -90, 90) && aralikta(o.boylam, -180, 180);
    var kameralar = [], gorulen = {};
    (Array.isArray(o.kameralar) ? o.kameralar : []).forEach(function (c) {
      var s = kameraSatiri(c, paket);
      if (!s || gorulen[s.kanal_no] || kameralar.length >= MAKS_KANAL) return;
      gorulen[s.kanal_no] = true;
      kameralar.push(s);
    });
    kameralar.sort(function (a, b) { return a.kanal_no - b.kanal_no; });
    var durum = CALISMA_DURUMLARI.indexOf(o.calisma_durumu) !== -1 ? o.calisma_durumu : null;
    return {
      olcum_id: o.olcum_id, kayit_id: o.kayit_id, yeni: o.yeni === true,
      ad: ad,
      sira_no: sonluMu(o.sira_no) && Math.floor(o.sira_no) === o.sira_no && o.sira_no >= 1 && o.sira_no <= 100000 ? o.sira_no : null,
      konum_adi: metinNull(o.konum_adi, SINIRLAR.konum_adi), is_adi: metinNull(o.is_adi, SINIRLAR.is_adi),
      enlem: konumVar ? o.enlem : null, boylam: konumVar ? o.boylam : null,
      dogruluk_m: konumVar && sonluMu(o.dogruluk_m) && o.dogruluk_m > 0 ? o.dogruluk_m : null,
      okuma_sayisi: konumVar && sonluMu(o.okuma_sayisi) ? Math.max(0, Math.trunc(o.okuma_sayisi)) : null,
      sure_s: konumVar && sonluMu(o.sure_s) ? o.sure_s : null,
      zaman: String(o.zaman || ''),
      marka: metinNull(o.marka, SINIRLAR.marka), model: metinNull(o.model, SINIRLAR.model), seri_no: metinNull(o.seri_no, SINIRLAR.seri_no),
      imei: rakamNull(o.imei, 20), bulut_cihaz_id: metinNull(o.bulut_cihaz_id, SINIRLAR.marka), bulut_hesap: metinNull(o.bulut_hesap, SINIRLAR.ad),
      hat_no: metinNull(o.hat_no, SINIRLAR.hat_no), iccid: rakamNull(o.iccid, 20),
      operator: metinNull(o.operator, SINIRLAR.marka), tarife: metinNull(o.tarife, SINIRLAR.marka),
      panel_bilgi: metinNull(o.panel_bilgi, SINIRLAR.donanim), batarya_bilgi: metinNull(o.batarya_bilgi, SINIRLAR.donanim),
      kurulum_tarihi: tarihNull(o.kurulum_tarihi), calisma_durumu: durum,
      'not': metinNull(o['not'], SINIRLAR.not),
      foto: fotoDegeri(o.foto),
      kameralar: kameralar
    };
  }

  // girdi: {paket, olcen, kayitlar:[telefon kaydi], simdi:Date, user_agent}
  // Ayni kayit_id icin en yeni zamanli olan alinir.
  function solarSonucOlustur(girdi) {
    var paket = girdi.paket, simdi = girdi.simdi || new Date();
    var son = {}, sira = [];
    (girdi.kayitlar || []).forEach(function (o) {
      var s = kayitSatiri(o, paket);
      if (!s) return;
      var onceki = son[s.kayit_id];
      if (!onceki) sira.push(s.kayit_id);
      if (!onceki || String(s.zaman) >= String(onceki.zaman)) son[s.kayit_id] = s;
    });
    var kayitlar = sira.map(function (id) { return son[id]; });
    if (kayitlar.length > SINIRLAR.kayit) throw new Error('Kayıt sayısı sınırı aşıldı (en çok ' + SINIRLAR.kayit + ').');
    return {
      tur: SONUC_TURU, surum: PAKET_SURUMU, paket_id: paket.paket_id,
      lokasyon: { id: paket.lokasyon.id, ad: paket.lokasyon.ad },
      olusturma: M.isoYerel(simdi),
      olcen: metin(girdi.olcen || '', SINIRLAR.olcen),
      uygulama: { surum: M.UYGULAMA_SURUMU, user_agent: String(girdi.user_agent || '').slice(0, 300) },
      kayitlar: kayitlar
    };
  }

  function dosyaAdi(lokasyonAd, d) {
    function iki(n) { return (n < 10 ? '0' : '') + n; }
    return 'solar_' + M.slug(lokasyonAd) + '_' + d.getFullYear() + iki(d.getMonth() + 1) + iki(d.getDate()) +
      '_' + iki(d.getHours()) + iki(d.getMinutes()) + '.txt';
  }

  return {
    PAKET_TURU: PAKET_TURU, SONUC_TURU: SONUC_TURU, PAKET_SURUMU: PAKET_SURUMU, SINIRLAR: SINIRLAR, VARSAYILAN: VARSAYILAN,
    VARSAYILAN_SAPMA: VARSAYILAN_SAPMA, ACIKLIK_HAZIR: ACIKLIK_HAZIR, KAYNAKLAR: KAYNAKLAR,
    MODELLER: MODELLER, DIGER_MODEL: DIGER_MODEL, MAKS_KANAL: MAKS_KANAL,
    CALISMA_DURUMLARI: CALISMA_DURUMLARI, CALISMA_ETIKETLERI: CALISMA_ETIKETLERI,
    solarPaketDogrula: solarPaketDogrula, solarSonucOlustur: solarSonucOlustur, solarDosyaAdi: dosyaAdi,
    modelListesi: modelListesi, modeliBul: modeliBul, varsayilanKanalSayisi: varsayilanKanalSayisi,
    yeniKanal: yeniKanal, yeniGorus: yeniGorus, kanalSablonuUygula: kanalSablonuUygula, kanalBosMu: kanalBosMu,
    kanalYonluMu: kanalYonluMu, yonOzeti: yonOzeti,
    luhnGecerliMi: luhnGecerliMi, imeiGecerliMi: imeiGecerliMi, iccidGecerliMi: iccidGecerliMi,
    imeiUyarisi: imeiUyarisi, iccidUyarisi: iccidUyarisi, yalnizRakam: yalnizRakam,
    hedefYonuHesapla: hedefYonuHesapla, manyetiktenGercege: manyetiktenGercege,
    dairselOrtalama: dairselOrtalama, dairselSapma: dairselSapma, yonAdi: yonAdi,
    pusulaYonuAlfaBeta: pusulaYonuAlfaBeta, pusulaOkumasi: pusulaOkumasi, pusulaHata: pusulaHata
  };
});
