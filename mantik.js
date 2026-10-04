/* Saha GPS - DOM'suz saf mantik. Tarayicida global `SahaMantik`, Node'da module.exports. */
(function (kok, fabrika) {
  'use strict';
  var m = fabrika();
  if (typeof module === 'object' && module.exports) { module.exports = m; }
  kok.SahaMantik = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UYGULAMA_SURUMU = '1.1.0';
  var PAKET_TURU = 'kamera_tespit.saha_gps_paketi';
  var SONUC_TURU = 'kamera_tespit.saha_gps_sonucu';
  var JPEG_DESENI = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  var SINIRLAR = {
    not: 500, olcen: 100, olcum_toplam: 2000, foto_baytlari: 400 * 1024,
    dosya_bayt: 60 * 1024 * 1024, cihaz: 5000, metin: 200
  };
  var VARSAYILAN_ESIKLER = { iyi_m: 5, kabul_m: 15, red_m: 30, olcum_suresi_s: 20 };
  var ILK_ATILAN = 2;
  // 1.1.0: GPS ilk 15-20 sn'de henuz oturmuyor (sahada ±10-15 m cikti). Olcum en az
  // ASGARI_OLCUM_S surer (paketteki sure daha kisa olsa da), dogruluk iyiyse erken biter.
  var HEDEF_OKUMA = 60;
  var ASGARI_OLCUM_S = 45;
  var ERKEN_MIN_OKUMA = 15;
  var ERKEN_MIN_S = 15;
  var ERKEN_SON_N = 5;
  var OTURMA_MIN_OKUMA = 10;   // bu kadar okumadan sonra yalniz son yari (oturmus) kullanilir

  function sonluMu(x) { return typeof x === 'number' && isFinite(x); }

  function turkiyeKutusundaMi(enlem, boylam) {
    return sonluMu(enlem) && sonluMu(boylam) &&
      enlem >= 35.5 && enlem <= 42.5 && boylam >= 25.5 && boylam <= 45.0;
  }

  function jpegDataUrlGecerliMi(s, azamiBayt) {
    if (typeof s !== 'string') return false;
    if (azamiBayt && s.length > azamiBayt) return false;
    return JPEG_DESENI.test(s);
  }

  function metin(x, azami) {
    if (typeof x !== 'string') return '';
    // kontrol karakterlerini at
    var t = x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    return t.length > azami ? t.slice(0, azami) : t;
  }

  /* ---------- sayisal ---------- */
  function medyan(dizi) {
    var a = [];
    for (var i = 0; i < dizi.length; i++) if (sonluMu(dizi[i])) a.push(dizi[i]);
    if (!a.length) return null;
    a.sort(function (x, y) { return x - y; });
    var o = Math.floor(a.length / 2);
    return a.length % 2 ? a[o] : (a[o - 1] + a[o]) / 2;
  }

  function haversine(en1, bo1, en2, bo2) {
    var R = 6371008.8, r = Math.PI / 180;
    var dEn = (en2 - en1) * r, dBo = (bo2 - bo1) * r;
    var a = Math.sin(dEn / 2) * Math.sin(dEn / 2) +
      Math.cos(en1 * r) * Math.cos(en2 * r) * Math.sin(dBo / 2) * Math.sin(dBo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function yuvarla(x, basamak) { var k = Math.pow(10, basamak); return Math.round(x * k) / k; }

  /* ---------- okuma isleme ---------- */
  // okuma: {enlem, boylam, dogruluk, zaman}
  function okumalariSuz(okumalar) {
    var kalan = (okumalar || []).slice(ILK_ATILAN).filter(function (o) {
      return o && sonluMu(o.enlem) && sonluMu(o.boylam) && sonluMu(o.dogruluk) && o.dogruluk > 0;
    });
    if (!kalan.length) return [];
    // Uzun olcumde ilk okumalar GPS oturmadan gelir; yalniz son yari kullanilir.
    if (kalan.length >= OTURMA_MIN_OKUMA) kalan = kalan.slice(Math.floor(kalan.length / 2));
    var en = Infinity;
    kalan.forEach(function (o) { if (o.dogruluk < en) en = o.dogruluk; });
    var esik = Math.max(2 * en, 30);
    return kalan.filter(function (o) { return o.dogruluk <= esik; });
  }

  function agirlikliOrtalama(okumalar) {
    var sw = 0, se = 0, sb = 0;
    okumalar.forEach(function (o) {
      var a = Math.max(o.dogruluk, 1);
      var w = 1 / (a * a);
      sw += w; se += w * o.enlem; sb += w * o.boylam;
    });
    if (!sw) return null;
    return { enlem: se / sw, boylam: sb / sw };
  }

  // Ham okumalardan sonuc; kullanilabilir okuma yoksa null.
  function olcumHesapla(okumalar, sure_s) {
    var kullanilan = okumalariSuz(okumalar);
    if (!kullanilan.length) return null;
    var konum = agirlikliOrtalama(kullanilan);
    var dog = medyan(kullanilan.map(function (o) { return o.dogruluk; }));
    return {
      enlem: yuvarla(konum.enlem, 7),
      boylam: yuvarla(konum.boylam, 7),
      dogruluk_m: Math.max(0.1, yuvarla(dog, 1)),
      okuma_sayisi: kullanilan.length,
      sure_s: sonluMu(sure_s) ? yuvarla(sure_s, 1) : 0
    };
  }

  // 'iyi' | 'kabul' | 'kotu' | 'red'
  function dogrulukSinifi(m, esikler) {
    var e = esikler || VARSAYILAN_ESIKLER;
    if (!sonluMu(m)) return 'red';
    if (m <= e.iyi_m) return 'iyi';
    if (m <= e.kabul_m) return 'kabul';
    if (m <= e.red_m) return 'kotu';
    return 'red';
  }

  /* ---------- paket dogrulama ---------- */
  function paketDogrula(veri) {
    var hatalar = [], uyarilar = [];
    function bitir() { return { ok: hatalar.length === 0, hatalar: hatalar, uyarilar: uyarilar, paket: hatalar.length ? null : cikti }; }
    var cikti = null;
    if (!veri || typeof veri !== 'object' || Array.isArray(veri)) {
      hatalar.push('Dosya geçerli bir saha GPS paketi değil.');
      return bitir();
    }
    if (veri.tur !== PAKET_TURU) hatalar.push('Bu dosya bir saha GPS paketi değil (tür uyuşmuyor).');
    if (veri.surum !== 1) hatalar.push('Desteklenmeyen paket sürümü: ' + String(veri.surum).slice(0, 20));
    var pid = veri.paket_id;
    if (typeof pid !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(pid)) hatalar.push('Paket kimliği (paket_id) geçersiz.');
    var lok = veri.lokasyon;
    var lokAd = lok && typeof lok === 'object' ? metin(lok.ad, SINIRLAR.metin) : '';
    if (!lokAd) hatalar.push('Lokasyon adı eksik.');
    if (!Array.isArray(veri.cihazlar) || !veri.cihazlar.length) hatalar.push('Pakette cihaz yok.');
    else if (veri.cihazlar.length > SINIRLAR.cihaz) hatalar.push('Pakette çok fazla cihaz var (en çok ' + SINIRLAR.cihaz + ').');
    if (!Array.isArray(veri.gruplar)) hatalar.push('Grup listesi eksik.');

    var esikler = {};
    var eh = veri.esikler && typeof veri.esikler === 'object' ? veri.esikler : {};
    Object.keys(VARSAYILAN_ESIKLER).forEach(function (k) {
      var v = eh[k];
      if (v === undefined || v === null) { esikler[k] = VARSAYILAN_ESIKLER[k]; return; }
      if (!sonluMu(v) || v <= 0) { hatalar.push('Eşik değeri geçersiz: ' + k); return; }
      esikler[k] = v;
    });
    if (!hatalar.length && !(esikler.iyi_m <= esikler.kabul_m && esikler.kabul_m <= esikler.red_m)) {
      hatalar.push('Doğruluk eşikleri tutarsız (iyi <= kabul <= red olmalı).');
    }
    if (hatalar.length) return bitir();

    var cihazlar = [], macler = {}, atlanan = 0;
    veri.cihazlar.forEach(function (c) {
      if (!c || typeof c !== 'object' || typeof c.mac !== 'string') { atlanan++; return; }
      var mac = metin(c.mac, 80);
      if (!mac || macler[mac]) { atlanan++; return; }
      macler[mac] = true;
      var kanal = null;
      if (c.kanal && typeof c.kanal === 'object') {
        kanal = {
          nvr_ad: metin(c.kanal.nvr_ad, SINIRLAR.metin),
          kanal_no: sonluMu(c.kanal.kanal_no) ? Math.trunc(c.kanal.kanal_no) : null,
          kamera_adi: metin(c.kanal.kamera_adi, SINIRLAR.metin)
        };
      }
      var konum = null;
      if (c.konum && typeof c.konum === 'object' && turkiyeKutusundaMi(c.konum.enlem, c.konum.boylam)) {
        konum = { enlem: c.konum.enlem, boylam: c.konum.boylam, kaynak: metin(c.konum.kaynak, 40) };
      }
      cihazlar.push({
        mac: mac,
        tip: metin(c.tip, 40) || 'diger',
        ad: metin(c.ad, SINIRLAR.metin),
        model: metin(c.model, SINIRLAR.metin),
        seri_no: metin(c.seri_no, SINIRLAR.metin),
        kanal: kanal,
        konum: konum,
        snapshot: jpegDataUrlGecerliMi(c.snapshot, 2 * 1024 * 1024) ? c.snapshot : null
      });
    });
    if (atlanan) uyarilar.push(atlanan + ' cihaz kaydı geçersiz/yinelenen olduğu için atlandı.');
    if (!cihazlar.length) { hatalar.push('Pakette geçerli cihaz yok.'); return bitir(); }

    var gruplar = [], gruplu = {};
    function bilinenMi(mac) { return typeof mac === 'string' && macler[mac]; }
    veri.gruplar.forEach(function (g) {
      if (!g || typeof g !== 'object') return;
      var sm = bilinenMi(g.sektor_mac) ? g.sektor_mac : null;
      if (sm) gruplu[sm] = true;
      var ist = [];
      (Array.isArray(g.istasyonlar) ? g.istasyonlar : []).forEach(function (i) {
        if (!i || typeof i !== 'object') return;
        var im = bilinenMi(i.istasyon_mac) ? i.istasyon_mac : null;
        if (im) gruplu[im] = true;
        var lst = [];
        (Array.isArray(i.cihazlar) ? i.cihazlar : []).forEach(function (mac) {
          if (bilinenMi(mac)) { lst.push(mac); gruplu[mac] = true; }
        });
        if (im || lst.length) ist.push({ istasyon_mac: im, cihazlar: lst });
      });
      var gid = metin(g.grup_id, 100) || ('G' + gruplar.length);
      if (!sm && !ist.length) return;
      gruplar.push({ grup_id: gid, ad: metin(g.ad, SINIRLAR.metin) || 'Grup', sektor_mac: sm, istasyonlar: ist });
    });
    // Hicbir grupta olmayan cihazlar "AP'si bilinmeyen" grubuna
    var yetim = cihazlar.filter(function (c) { return !gruplu[c.mac]; }).map(function (c) { return c.mac; });
    var bil = null;
    gruplar.forEach(function (g) { if (g.grup_id === 'BILINMEYEN') bil = g; });
    if (yetim.length) {
      if (!bil) {
        bil = { grup_id: 'BILINMEYEN', ad: "AP'si bilinmeyen", sektor_mac: null, istasyonlar: [] };
        gruplar.push(bil);
      }
      bil.istasyonlar.push({ istasyon_mac: null, cihazlar: yetim });
    }
    // BILINMEYEN en sonda
    gruplar.sort(function (a, b) {
      return (a.grup_id === 'BILINMEYEN' ? 1 : 0) - (b.grup_id === 'BILINMEYEN' ? 1 : 0);
    });

    cikti = {
      tur: PAKET_TURU, surum: 1, paket_id: pid,
      olusturma: metin(veri.olusturma, 40),
      lokasyon: {
        id: sonluMu(lok.id) ? lok.id : null, ad: lokAd,
        enlem: sonluMu(lok.enlem) ? lok.enlem : null, boylam: sonluMu(lok.boylam) ? lok.boylam : null
      },
      esikler: esikler, gruplar: gruplar, cihazlar: cihazlar
    };
    return bitir();
  }

  /* ---------- zaman / ad / kimlik ---------- */
  function iki(n) { return (n < 10 ? '0' : '') + n; }

  function isoYerel(d) {
    var off = -d.getTimezoneOffset(), isr = off < 0 ? '-' : '+';
    off = Math.abs(off);
    return d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate()) + 'T' +
      iki(d.getHours()) + ':' + iki(d.getMinutes()) + ':' + iki(d.getSeconds()) +
      isr + iki(Math.floor(off / 60)) + ':' + iki(off % 60);
  }

  function slug(s) {
    var harita = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
    var t = String(s || '').replace(/İ/g, 'i').toLowerCase()
      .replace(/[çğıöşüâîû]/g, function (h) { return harita[h]; });
    t = t.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/g, '');
    return t || 'saha';
  }

  function dosyaAdi(lokasyonAd, d) {
    return 'sahagps_' + slug(lokasyonAd) + '_' + d.getFullYear() + iki(d.getMonth() + 1) + iki(d.getDate()) +
      '_' + iki(d.getHours()) + iki(d.getMinutes()) + '.txt';
  }

  function yeniId() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = new Array(16), i;
    if (c && c.getRandomValues) { var u = new Uint8Array(16); c.getRandomValues(u); for (i = 0; i < 16; i++) b[i] = u[i]; }
    else for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = b.map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- olcum kaydi ---------- */
  function olcumGecerliMi(o) {
    return !!o && turkiyeKutusundaMi(o.enlem, o.boylam) && sonluMu(o.dogruluk_m) && o.dogruluk_m > 0;
  }

  function fotoDegeri(f) { return jpegDataUrlGecerliMi(f, SINIRLAR.foto_baytlari) ? f : null; }

  // girdi: {paket, olcen, olcumler:[...], ekstralar:[...], simdi:Date, user_agent}
  // olcum: {olcum_id, mac, enlem, boylam, dogruluk_m, okuma_sayisi, sure_s, zaman, kopya_kaynagi_mac, not, foto}
  function sonucOlustur(girdi) {
    var paket = girdi.paket, simdi = girdi.simdi || new Date();
    var son = {}, sira = [];
    (girdi.olcumler || []).forEach(function (o) {
      if (!olcumGecerliMi(o) || typeof o.mac !== 'string' || !o.mac) return;
      var onceki = son[o.mac];
      if (!onceki) sira.push(o.mac);
      if (!onceki || String(o.zaman) >= String(onceki.zaman)) son[o.mac] = o;
    });
    var olcumler = sira.map(function (mac) {
      var o = son[mac];
      return {
        olcum_id: o.olcum_id, mac: mac, enlem: o.enlem, boylam: o.boylam, dogruluk_m: o.dogruluk_m,
        okuma_sayisi: sonluMu(o.okuma_sayisi) ? Math.max(0, Math.trunc(o.okuma_sayisi)) : 0,
        sure_s: sonluMu(o.sure_s) ? o.sure_s : 0,
        zaman: o.zaman,
        kopya_kaynagi_mac: typeof o.kopya_kaynagi_mac === 'string' ? o.kopya_kaynagi_mac : null,
        'not': metin(o['not'] || '', SINIRLAR.not),
        foto: fotoDegeri(o.foto)
      };
    });
    var ekstralar = (girdi.ekstralar || []).filter(olcumGecerliMi).map(function (o) {
      return {
        olcum_id: o.olcum_id, enlem: o.enlem, boylam: o.boylam, dogruluk_m: o.dogruluk_m,
        zaman: o.zaman, 'not': metin(o['not'] || '', SINIRLAR.not), foto: fotoDegeri(o.foto)
      };
    });
    if (olcumler.length + ekstralar.length > SINIRLAR.olcum_toplam) {
      throw new Error('Ölçüm sayısı sınırı aşıldı (en çok ' + SINIRLAR.olcum_toplam + ').');
    }
    return {
      tur: SONUC_TURU, surum: 1, paket_id: paket.paket_id,
      lokasyon: { id: paket.lokasyon.id, ad: paket.lokasyon.ad },
      olusturma: isoYerel(simdi),
      olcen: metin(girdi.olcen || '', SINIRLAR.olcen),
      uygulama: { surum: UYGULAMA_SURUMU, user_agent: String(girdi.user_agent || '').slice(0, 300) },
      olcumler: olcumler, ekstralar: ekstralar
    };
  }

  /* ---------- hata metinleri ---------- */
  function hataMetni(kod) {
    switch (kod) {
      case 1:
        return 'Konum izni reddedildi. Tarayıcı ayarlarından bu site için konuma "İzin ver" deyin ve tekrar deneyin. ' +
          '(iPhone: Ayarlar > Gizlilik ve Güvenlik > Konum Servisleri > Safari.)';
      case 2:
        return 'Konum alınamadı. Telefonun konum (GPS) servisinin açık olduğundan emin olun ve açık gökyüzü görünen bir yere geçin.';
      case 3:
        return 'Konum zaman aşımına uğradı. Açık alanda tekrar deneyin; konum servisi ve izin açık olmalı.';
      case 'https':
        return 'Konum yalnız güvenli (https) bağlantıda çalışır. Sayfayı https:// adresinden açın.';
      case 'desteklenmiyor':
        return 'Bu tarayıcı konum almayı desteklemiyor. Android Chrome ya da iPhone Safari kullanın.';
      case 'yetersiz':
        return 'Yeterli konum okuması alınamadı (ilk okumalar atılır, en az 3 okuma gerekir). Açık alanda tekrar deneyin.';
      default:
        return 'Konum alınırken bilinmeyen bir hata oluştu.';
    }
  }

  /* ---------- olcum oturumu (geolocation enjekte edilebilir) ---------- */
  // Paketteki olcum suresi ne olursa olsun en az ASGARI_OLCUM_S.
  function etkinOlcumSuresi(esikler) {
    var s = esikler && sonluMu(esikler.olcum_suresi_s) ? esikler.olcum_suresi_s : VARSAYILAN_ESIKLER.olcum_suresi_s;
    return Math.max(s, ASGARI_OLCUM_S);
  }

  // Erken bitis: yeterli okuma + sure gectiyse ve son ERKEN_SON_N okumanin hepsi esik altindaysa.
  function erkenBitebilirMi(okumalar, gecen_s, esik_m) {
    if (!sonluMu(esik_m) || !okumalar || okumalar.length < ERKEN_MIN_OKUMA || !(gecen_s >= ERKEN_MIN_S)) return false;
    return okumalar.slice(-ERKEN_SON_N).every(function (o) {
      return o && sonluMu(o.dogruluk) && o.dogruluk > 0 && o.dogruluk <= esik_m;
    });
  }

  // ayar: {sure_s, hedef_okuma, erken_esik_m, guvenli, setTimeout, clearTimeout, simdi}
  // cb: {onOkuma(okuma, tumu), onBitti(okumalar, bilgi), onHata({kod, mesaj})}
  function olcumBaslat(geo, ayar, cb) {
    ayar = ayar || {};
    var setT = ayar.setTimeout || setTimeout, clrT = ayar.clearTimeout || clearTimeout;
    var simdi = ayar.simdi || function () { return Date.now(); };
    var sure = (sonluMu(ayar.sure_s) ? ayar.sure_s : VARSAYILAN_ESIKLER.olcum_suresi_s) * 1000;
    var hedef = ayar.hedef_okuma || HEDEF_OKUMA;
    var okumalar = [], bitti = false, id = null, zamanlayici = null, sonHata = null, bas = simdi();

    function hata(kod) { return { kod: kod, mesaj: hataMetni(kod) }; }
    if (ayar.guvenli === false) { cb.onHata(hata('https')); return { iptal: function () {} }; }
    if (!geo || typeof geo.watchPosition !== 'function') { cb.onHata(hata('desteklenmiyor')); return { iptal: function () {} }; }

    function temizle() {
      bitti = true;
      if (zamanlayici !== null) clrT(zamanlayici);
      if (id !== null) { try { geo.clearWatch(id); } catch (e) { /* yut */ } }
    }
    function bitir() {
      if (bitti) return;
      temizle();
      if (!okumalar.length) { cb.onHata(sonHata || hata(3)); return; }
      cb.onBitti(okumalar.slice(), { sure_s: Math.min((simdi() - bas) / 1000, sure / 1000) });
    }

    zamanlayici = setT(bitir, sure);
    try {
      id = geo.watchPosition(function (poz) {
        if (bitti) return;
        var c = poz && poz.coords;
        if (!c) return;
        var o = { enlem: c.latitude, boylam: c.longitude, dogruluk: c.accuracy, zaman: poz.timestamp };
        okumalar.push(o);
        cb.onOkuma(o, okumalar.slice());
        if (okumalar.length >= hedef ||
            erkenBitebilirMi(okumalar, (simdi() - bas) / 1000, ayar.erken_esik_m)) bitir();
      }, function (h) {
        if (bitti) return;
        var kod = h && h.code;
        sonHata = hata(kod);
        if (kod === 1) { temizle(); cb.onHata(sonHata); }
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    } catch (e) {
      temizle(); cb.onHata(hata(2));
    }
    return { iptal: function () { if (!bitti) temizle(); } };
  }

  return {
    UYGULAMA_SURUMU: UYGULAMA_SURUMU, PAKET_TURU: PAKET_TURU, SONUC_TURU: SONUC_TURU,
    SINIRLAR: SINIRLAR, VARSAYILAN_ESIKLER: VARSAYILAN_ESIKLER, ILK_ATILAN: ILK_ATILAN, HEDEF_OKUMA: HEDEF_OKUMA,
    turkiyeKutusundaMi: turkiyeKutusundaMi, jpegDataUrlGecerliMi: jpegDataUrlGecerliMi,
    medyan: medyan, haversine: haversine, okumalariSuz: okumalariSuz, agirlikliOrtalama: agirlikliOrtalama,
    olcumHesapla: olcumHesapla, etkinOlcumSuresi: etkinOlcumSuresi, erkenBitebilirMi: erkenBitebilirMi,
    ASGARI_OLCUM_S: ASGARI_OLCUM_S, dogrulukSinifi: dogrulukSinifi, paketDogrula: paketDogrula,
    isoYerel: isoYerel, slug: slug, dosyaAdi: dosyaAdi, yeniId: yeniId,
    olcumGecerliMi: olcumGecerliMi, sonucOlustur: sonucOlustur, hataMetni: hataMetni, olcumBaslat: olcumBaslat
  };
});
