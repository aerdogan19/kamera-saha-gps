/* mantik.js testleri (tarayicida kosar). Sonuc: document.title + <pre id="sonuc"> */
(function () {
  'use strict';
  var M = window.SahaMantik;
  var testler = [], gecen = 0, hatalar = [];
  function test(ad, fn) { testler.push({ ad: ad, fn: fn }); }
  function esit(a, b, m) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) throw new Error((m || 'esit degil') + ': beklenen ' + y + ' gelen ' + x);
  }
  function dogru(c, m) { if (!c) throw new Error(m || 'dogru degil'); }
  function yakin(a, b, tol, m) { if (!(Math.abs(a - b) <= tol)) throw new Error((m || 'yakin degil') + ': ' + a + ' vs ' + b); }

  var JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  function ornekPaket() {
    return {
      tur: 'kamera_tespit.saha_gps_paketi', surum: 1, paket_id: 'abcdef0123456789', olusturma: '2026-10-01T10:00:00+03:00',
      lokasyon: { id: 5, ad: 'DELİCE Şantiyesi', enlem: 40.03, boylam: 34.08 },
      esikler: { iyi_m: 5, kabul_m: 15, red_m: 30, olcum_suresi_s: 20 },
      gruplar: [
        { grup_id: 'BILINMEYEN', ad: "AP'si bilinmeyen", sektor_mac: null, istasyonlar: [{ istasyon_mac: null, cihazlar: ['CC:CC:CC:CC:CC:CC'] }] },
        { grup_id: 'S:AA', ad: 'Sektor 1', sektor_mac: 'AA:AA:AA:AA:AA:AA',
          istasyonlar: [{ istasyon_mac: 'BB:BB:BB:BB:BB:BB', cihazlar: ['DD:DD:DD:DD:DD:DD', 'YOK:YOK'] }] }
      ],
      cihazlar: [
        { mac: 'AA:AA:AA:AA:AA:AA', tip: 'access_point', ad: 'AP1', model: 'LBE', seri_no: 'S1', kanal: null, konum: null, snapshot: null },
        { mac: 'BB:BB:BB:BB:BB:BB', tip: 'access_point', ad: 'ST1', model: 'NS', seri_no: 'S2', kanal: null, konum: null, snapshot: null },
        { mac: 'CC:CC:CC:CC:CC:CC', tip: 'kamera', ad: 'K1', model: 'DS', seri_no: 'S3', kanal: { nvr_ad: 'NVR', kanal_no: 3, kamera_adi: 'Kapi' },
          konum: { enlem: 40.0, boylam: 34.0, kaynak: 'harita_elle' }, snapshot: JPEG, sifre: 'gizli', ip: '1.2.3.4' },
        { mac: 'DD:DD:DD:DD:DD:DD', tip: 'kamera', ad: 'K2', model: 'DS', seri_no: 'S4', kanal: null, konum: null, snapshot: 'javascript:alert(1)' },
        { mac: 'EE:EE:EE:EE:EE:EE', tip: 'kamera', ad: 'K3', model: '', seri_no: '', kanal: null, konum: null, snapshot: null }
      ]
    };
  }
  function okuma(acc, en, bo) { return { enlem: en === undefined ? 40 : en, boylam: bo === undefined ? 34 : bo, dogruluk: acc, zaman: 0 }; }

  /* ---- saf islevler ---- */
  test('medyan tek/cift/bos', function () {
    esit(M.medyan([3, 1, 2]), 2); esit(M.medyan([4, 1, 2, 3]), 2.5); esit(M.medyan([]), null);
  });
  test('haversine bilinen mesafe', function () {
    yakin(M.haversine(40, 34, 40, 34), 0, 1e-6);
    yakin(M.haversine(40, 34, 41, 34), 111195, 200, '1 derece enlem');
    yakin(M.haversine(40, 34, 40, 34.001), 85.2, 1, '0.001 boylam');
  });
  test('okumalariSuz ilk 2 atilir', function () {
    var s = M.okumalariSuz([okuma(1), okuma(1), okuma(5), okuma(6)]);
    esit(s.length, 2);
  });
  test('okumalariSuz esik max(2*en iyi, 30)', function () {
    var s = M.okumalariSuz([okuma(1), okuma(1), okuma(5), okuma(29), okuma(31), okuma(60)]);
    esit(s.map(function (o) { return o.dogruluk; }), [5, 29]);
    var s2 = M.okumalariSuz([okuma(1), okuma(1), okuma(20), okuma(40), okuma(41)]);
    esit(s2.map(function (o) { return o.dogruluk; }), [20, 40], 'en iyi 20 -> esik 40');
  });
  test('okumalariSuz gecersiz/yetersiz', function () {
    esit(M.okumalariSuz([okuma(5), okuma(5)]), []);
    esit(M.okumalariSuz([okuma(5), okuma(5), okuma(0), okuma(NaN)]), []);
    esit(M.okumalariSuz(null), []);
  });
  test('agirlikliOrtalama w=1/acc^2', function () {
    var r = M.agirlikliOrtalama([okuma(1, 40, 34), okuma(2, 40.0001, 34.0001)]);
    // w1=1, w2=0.25 -> 40 + 0.0001*0.25/1.25
    yakin(r.enlem, 40.00002, 1e-9); yakin(r.boylam, 34.00002, 1e-9);
  });
  test('olcumHesapla sonuc ve medyan dogruluk', function () {
    var ok = [okuma(50), okuma(50), okuma(4, 40, 34), okuma(6, 40, 34), okuma(8, 40, 34), okuma(100)];
    var r = M.olcumHesapla(ok, 12.34);
    esit(r.okuma_sayisi, 3); esit(r.dogruluk_m, 6); esit(r.sure_s, 12.3);
    esit(M.olcumHesapla([okuma(5)], 1), null);
  });
  test('dogrulukSinifi', function () {
    var e = { iyi_m: 5, kabul_m: 15, red_m: 30 };
    esit(M.dogrulukSinifi(5, e), 'iyi'); esit(M.dogrulukSinifi(5.1, e), 'kabul');
    esit(M.dogrulukSinifi(15, e), 'kabul'); esit(M.dogrulukSinifi(15.1, e), 'kotu');
    esit(M.dogrulukSinifi(30, e), 'kotu'); esit(M.dogrulukSinifi(30.1, e), 'red');
    esit(M.dogrulukSinifi(NaN, e), 'red');
  });
  test('turkiye kutusu', function () {
    dogru(M.turkiyeKutusundaMi(40, 34)); dogru(!M.turkiyeKutusundaMi(0, 0));
    dogru(!M.turkiyeKutusundaMi(NaN, 34)); dogru(!M.turkiyeKutusundaMi(Infinity, 34));
  });
  test('jpeg data url deseni', function () {
    dogru(M.jpegDataUrlGecerliMi(JPEG));
    dogru(!M.jpegDataUrlGecerliMi('data:image/png;base64,AAAA'));
    dogru(!M.jpegDataUrlGecerliMi('data:image/jpeg;base64,AA"onerror=x'));
    dogru(!M.jpegDataUrlGecerliMi('javascript:alert(1)'));
    dogru(!M.jpegDataUrlGecerliMi('data:image/jpeg;base64,AAAA\n<script>'));
    dogru(!M.jpegDataUrlGecerliMi(null));
  });
  test('slug ve dosya adi', function () {
    esit(M.slug('ÇAMLIK İĞNE YOLU-Ağaçlı Şantiyesi'), 'camlik_igne_yolu_agacli_santiyesi');
    esit(M.slug('???'), 'saha');
    var d = new Date(2026, 9, 1, 9, 5);
    esit(M.dosyaAdi('Örnek-ABC', d), 'sahagps_ornek_abc_20261001_0905.txt');
  });
  test('isoYerel bicimi', function () {
    dogru(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(M.isoYerel(new Date())));
  });
  test('yeniId farkli ve uuid bicimli', function () {
    var a = M.yeniId(), b = M.yeniId();
    dogru(a !== b); dogru(/^[0-9a-f-]{36}$/.test(a));
  });

  /* ---- paket dogrulama ---- */
  test('paketDogrula gecerli paket', function () {
    var r = M.paketDogrula(ornekPaket());
    dogru(r.ok, r.hatalar.join('|'));
    var p = r.paket;
    esit(p.cihazlar.length, 5);
    esit(p.cihazlar[2].snapshot, JPEG);
    esit(p.cihazlar[3].snapshot, null, 'gecersiz snapshot atilmali');
    dogru(!('sifre' in p.cihazlar[2]) && !('ip' in p.cihazlar[2]), 'beyaz liste disi alan kalmamali');
  });
  test('paketDogrula BILINMEYEN en sonda, yetim cihaz oraya', function () {
    var p = M.paketDogrula(ornekPaket()).paket;
    esit(p.gruplar[p.gruplar.length - 1].grup_id, 'BILINMEYEN');
    var son = p.gruplar[p.gruplar.length - 1];
    var hepsi = [];
    son.istasyonlar.forEach(function (i) { hepsi = hepsi.concat(i.cihazlar); });
    dogru(hepsi.indexOf('EE:EE:EE:EE:EE:EE') !== -1, 'gruplanmamis cihaz BILINMEYEN altinda olmali');
    var s1 = p.gruplar[0];
    esit(s1.istasyonlar[0].cihazlar, ['DD:DD:DD:DD:DD:DD'], 'bilinmeyen mac atilmali');
  });
  test('paketDogrula reddeder', function () {
    dogru(!M.paketDogrula(null).ok);
    dogru(!M.paketDogrula([]).ok);
    var p = ornekPaket(); p.tur = 'x'; dogru(!M.paketDogrula(p).ok, 'tur');
    p = ornekPaket(); p.surum = 2; dogru(!M.paketDogrula(p).ok, 'surum');
    p = ornekPaket(); p.paket_id = '../x'; dogru(!M.paketDogrula(p).ok, 'paket_id');
    p = ornekPaket(); p.lokasyon.ad = ''; dogru(!M.paketDogrula(p).ok, 'lokasyon');
    p = ornekPaket(); p.cihazlar = []; dogru(!M.paketDogrula(p).ok, 'cihaz yok');
    p = ornekPaket(); p.esikler.iyi_m = 50; dogru(!M.paketDogrula(p).ok, 'esik sirasi');
    p = ornekPaket(); p.esikler.iyi_m = -1; dogru(!M.paketDogrula(p).ok, 'negatif esik');
    p = ornekPaket(); p.gruplar = 'x'; dogru(!M.paketDogrula(p).ok, 'gruplar');
  });
  test('paketDogrula esik varsayilanlari', function () {
    var p = ornekPaket(); delete p.esikler;
    var r = M.paketDogrula(p); dogru(r.ok);
    esit(r.paket.esikler, { iyi_m: 5, kabul_m: 15, red_m: 30, olcum_suresi_s: 20 });
  });
  test('paketDogrula Turkiye disi paket konumunu atar', function () {
    var p = ornekPaket(); p.cihazlar[2].konum = { enlem: 0, boylam: 0, kaynak: 'x' };
    esit(M.paketDogrula(p).paket.cihazlar[2].konum, null);
  });

  /* ---- sonuc ---- */
  function olcum(id, mac, zaman, ek) {
    var o = { olcum_id: id, mac: mac, enlem: 40.1, boylam: 34.1, dogruluk_m: 4.2, okuma_sayisi: 13, sure_s: 20, zaman: zaman,
      kopya_kaynagi_mac: null, 'not': 'n', foto: JPEG };
    for (var k in (ek || {})) o[k] = ek[k];
    return o;
  }
  test('sonucOlustur bicim ve alan adlari', function () {
    var paket = M.paketDogrula(ornekPaket()).paket;
    var s = M.sonucOlustur({ paket: paket, olcen: 'Ali Veli', simdi: new Date(2026, 9, 1, 10, 0),
      olcumler: [olcum('1', 'CC:CC:CC:CC:CC:CC', '2026-10-01T10:00:00+03:00')],
      ekstralar: [{ olcum_id: '9', enlem: 40.2, boylam: 34.2, dogruluk_m: 7, zaman: 'z', 'not': 'direk 12', foto: null }],
      user_agent: 'UA' });
    esit(s.tur, 'kamera_tespit.saha_gps_sonucu'); esit(s.surum, 1); esit(s.paket_id, 'abcdef0123456789');
    esit(s.lokasyon, { id: 5, ad: 'DELİCE Şantiyesi' }); esit(s.olcen, 'Ali Veli');
    esit(s.uygulama, { surum: M.UYGULAMA_SURUMU, user_agent: 'UA' });
    esit(Object.keys(s.olcumler[0]), ['olcum_id', 'mac', 'enlem', 'boylam', 'dogruluk_m', 'okuma_sayisi', 'sure_s', 'zaman', 'kopya_kaynagi_mac', 'not', 'foto']);
    esit(Object.keys(s.ekstralar[0]), ['olcum_id', 'enlem', 'boylam', 'dogruluk_m', 'zaman', 'not', 'foto']);
    window.ORNEK_SONUC = s;
  });
  test('sonucOlustur MAC basina yalniz son olcum', function () {
    var paket = M.paketDogrula(ornekPaket()).paket;
    var s = M.sonucOlustur({ paket: paket, olcen: 'x', olcumler: [
      olcum('a', 'CC', '2026-10-01T10:00:00+03:00'), olcum('b', 'CC', '2026-10-01T11:00:00+03:00'),
      olcum('c', 'CC', '2026-10-01T09:00:00+03:00'), olcum('d', 'DD', '2026-10-01T09:00:00+03:00')] });
    esit(s.olcumler.length, 2); esit(s.olcumler[0].olcum_id, 'b');
  });
  test('sonucOlustur sinirlar ve gecersizler', function () {
    var paket = M.paketDogrula(ornekPaket()).paket;
    var uzun = new Array(700).join('a');
    var s = M.sonucOlustur({ paket: paket, olcen: new Array(300).join('b'), olcumler: [
      olcum('a', 'CC', 'z', { 'not': uzun, foto: 'javascript:1' }),
      olcum('b', 'DD', 'z', { enlem: 0, boylam: 0 }),
      olcum('c', 'EE', 'z', { dogruluk_m: 0 }),
      olcum('d', 'FF', 'z', { enlem: NaN })] });
    esit(s.olcumler.length, 1); esit(s.olcumler[0]['not'].length, 500); esit(s.olcumler[0].foto, null);
    dogru(s.olcen.length <= 100, 'olcen sinirli');
  });
  test('sonucOlustur kopya_kaynagi_mac korunur', function () {
    var paket = M.paketDogrula(ornekPaket()).paket;
    var s = M.sonucOlustur({ paket: paket, olcen: 'x', olcumler: [olcum('a', 'DD', 'z', { kopya_kaynagi_mac: 'CC:CC:CC:CC:CC:CC' })] });
    esit(s.olcumler[0].kopya_kaynagi_mac, 'CC:CC:CC:CC:CC:CC');
  });
  test('sonucOlustur 2000 sinir asimi hata verir', function () {
    var paket = M.paketDogrula(ornekPaket()).paket, ek = [], i;
    for (i = 0; i < 2001; i++) ek.push({ olcum_id: String(i), enlem: 40, boylam: 34, dogruluk_m: 5, zaman: 'z', 'not': '', foto: null });
    var hata = false;
    try { M.sonucOlustur({ paket: paket, olcen: 'x', olcumler: [], ekstralar: ek }); } catch (e) { hata = true; }
    dogru(hata);
  });

  /* ---- sahte geolocation ---- */
  function sahteGeo() {
    var g = { id: 0, temizlendi: false, secenek: null };
    g.watchPosition = function (ok, hata, sec) { g.ok = ok; g.hata = hata; g.secenek = sec; return ++g.id; };
    g.clearWatch = function () { g.temizlendi = true; };
    g.gonder = function (acc, en, bo) { g.ok({ coords: { latitude: en || 40, longitude: bo || 34, accuracy: acc }, timestamp: 1 }); };
    return g;
  }
  function sahteZaman() {
    var z = { fn: null, iptal: false };
    z.setTimeout = function (fn) { z.fn = fn; return 7; };
    z.clearTimeout = function () { z.iptal = true; };
    return z;
  }
  test('olcumBaslat 60 okumada biter, secenekler dogru', function () {
    var g = sahteGeo(), z = sahteZaman(), bitti = null, sayi = 0, i;
    M.olcumBaslat(g, { sure_s: 20, setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () { sayi++; }, onBitti: function (o) { bitti = o; }, onHata: function (h) { throw new Error('hata ' + h.mesaj); }
    });
    esit(g.secenek.enableHighAccuracy, true); esit(g.secenek.maximumAge, 0);
    for (i = 0; i < 59; i++) g.gonder(5);
    esit(bitti, null, '59 okumada bitmemeli');
    g.gonder(5);
    esit(sayi, 60); esit(bitti.length, 60); dogru(g.temizlendi, 'clearWatch'); dogru(z.iptal, 'zamanlayici iptal');
  });
  test('olcumBaslat sure dolunca biter', function () {
    var g = sahteGeo(), z = sahteZaman(), bitti = null;
    M.olcumBaslat(g, { sure_s: 20, setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () {}, onBitti: function (o) { bitti = o; }, onHata: function () { throw new Error('hata'); }
    });
    g.gonder(5); g.gonder(5); g.gonder(5);
    z.fn();
    esit(bitti.length, 3); dogru(g.temizlendi);
    g.gonder(5); esit(bitti.length, 3, 'bittikten sonra okuma eklenmez');
  });
  test('olcumBaslat izin reddi', function () {
    var g = sahteGeo(), z = sahteZaman(), h = null;
    M.olcumBaslat(g, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () {}, onBitti: function () { throw new Error('bitmemeli'); }, onHata: function (x) { h = x; }
    });
    g.hata({ code: 1 });
    esit(h.kod, 1); dogru(/izni reddedildi/.test(h.mesaj)); dogru(g.temizlendi);
  });
  test('olcumBaslat okumasiz zaman asimi', function () {
    var g = sahteGeo(), z = sahteZaman(), h = null;
    M.olcumBaslat(g, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () {}, onBitti: function () { throw new Error('bitmemeli'); }, onHata: function (x) { h = x; }
    });
    g.hata({ code: 3 }); esit(h, null, 'gecici hata hemen bitirmemeli');
    z.fn(); esit(h.kod, 3); dogru(/zaman a/.test(h.mesaj));
  });
  test('olcumBaslat https degil / geolocation yok', function () {
    var h = null;
    M.olcumBaslat(sahteGeo(), { guvenli: false }, { onOkuma: function () {}, onBitti: function () {}, onHata: function (x) { h = x; } });
    esit(h.kod, 'https');
    M.olcumBaslat(undefined, {}, { onOkuma: function () {}, onBitti: function () {}, onHata: function (x) { h = x; } });
    esit(h.kod, 'desteklenmiyor');
  });
  test('olcumBaslat iptal', function () {
    var g = sahteGeo(), z = sahteZaman(), cagri = 0;
    var o = M.olcumBaslat(g, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () { cagri++; }, onBitti: function () { cagri += 100; }, onHata: function () { cagri += 100; }
    });
    o.iptal(); dogru(g.temizlendi);
    g.gonder(5); z.fn && z.fn();
    esit(cagri, 0);
  });
  test('etkinOlcumSuresi en az 45 sn', function () {
    esit(M.etkinOlcumSuresi({ olcum_suresi_s: 20 }), 45);
    esit(M.etkinOlcumSuresi({ olcum_suresi_s: 90 }), 90);
    esit(M.etkinOlcumSuresi(null), 45);
  });
  test('erkenBitebilirMi: okuma, sure ve son 5 okuma esigi', function () {
    var iyi = [], i;
    for (i = 0; i < 15; i++) iyi.push(okuma(4));
    dogru(M.erkenBitebilirMi(iyi, 15, 5));
    dogru(!M.erkenBitebilirMi(iyi.slice(1), 15, 5), '14 okuma yetmez');
    dogru(!M.erkenBitebilirMi(iyi, 14.9, 5), 'sure yetmez');
    dogru(!M.erkenBitebilirMi(iyi.concat([okuma(6)]), 20, 5), 'son okuma esik ustu');
    dogru(!M.erkenBitebilirMi(iyi, 20, undefined), 'esik yoksa erken bitmez');
  });
  test('olcumBaslat dogruluk iyiyse erken biter', function () {
    var g = sahteGeo(), z = sahteZaman(), bitti = null, t = 0, i;
    M.olcumBaslat(g, { sure_s: 45, erken_esik_m: 5, setTimeout: z.setTimeout, clearTimeout: z.clearTimeout,
                        simdi: function () { return t; } }, {
      onOkuma: function () {}, onBitti: function (o) { bitti = o; }, onHata: function () { throw new Error('hata'); }
    });
    for (i = 0; i < 10; i++) { t += 1000; g.gonder(20); }
    for (i = 0; i < 4; i++) { t += 1000; g.gonder(4); }
    esit(bitti, null, '14 okuma: henuz bitmez');
    t += 1000; g.gonder(4);
    esit(bitti.length, 15); dogru(g.temizlendi);
  });
  test('okumalariSuz uzun olcumde son yariyi kullanir', function () {
    var ok = [okuma(50), okuma(50)], i;
    for (i = 0; i < 10; i++) ok.push(okuma(25));
    for (i = 0; i < 10; i++) ok.push(okuma(4));
    var r = M.okumalariSuz(ok);
    esit(r.length, 10); dogru(r.every(function (o) { return o.dogruluk === 4; }));
  });
  test('uctan uca: sahte okumalar -> hesap -> sinif', function () {
    var g = sahteGeo(), z = sahteZaman(), son = null, i;
    M.olcumBaslat(g, { sure_s: 20, setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () {}, onBitti: function (o) { son = o; }, onHata: function () {}
    });
    g.gonder(60); g.gonder(40);
    for (i = 0; i < 13; i++) g.gonder(4 + (i % 3), 40.0001, 34.0001);
    z.fn();
    var r = M.olcumHesapla(son, 15);
    esit(r.okuma_sayisi, 7, '13 kullanilabilir okumanin son yarisi'); esit(M.dogrulukSinifi(r.dogruluk_m, M.VARSAYILAN_ESIKLER), 'iyi');
    yakin(r.enlem, 40.0001, 1e-6);
  });

  /* ---- calistir ---- */
  testler.forEach(function (t) {
    try { t.fn(); gecen++; } catch (e) { hatalar.push(t.ad + ' -> ' + (e && e.message)); }
  });
  var toplam = testler.length;
  var metin = (hatalar.length ? 'TESTS FAIL ' + gecen + '/' + toplam : 'TESTS PASS ' + gecen + '/' + toplam);
  document.title = metin;
  document.getElementById('sonuc').textContent = metin + '\n' + hatalar.join('\n') +
    '\nORNEK_SONUC=' + JSON.stringify(window.ORNEK_SONUC || null);
})();
