/* solar_mantik.js + depo.js (Solar deposu / IDB 1->2 yukseltme) testleri (tarayicida kosar).
   Testler window.EK_TESTLER'a eklenir; calistirma ve baslik yazma test_mantik.js'tedir (bu dosyadan SONRA yuklenir). */
(function () {
  'use strict';
  var S = window.SolarMantik, M = window.SahaMantik, D = window.SahaDepo;
  var testler = (window.EK_TESTLER = window.EK_TESTLER || []);
  function test(ad, fn) { testler.push({ ad: 'solar: ' + ad, fn: fn }); }
  function esit(a, b, m) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) throw new Error((m || 'esit degil') + ': beklenen ' + y + ' gelen ' + x);
  }
  function dogru(c, m) { if (!c) throw new Error(m || 'dogru degil'); }
  function yakin(a, b, tol, m) { if (!(Math.abs(a - b) <= tol)) throw new Error((m || 'yakin degil') + ': ' + a + ' vs ' + b); }
  function dairesel(a, b) { var d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }

  var JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  var U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
  var U3 = '33333333-3333-4333-8333-333333333333', U4 = '44444444-4444-4444-8444-444444444444';
  var O1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', O2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  var O3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  // uydurma ama Luhn gecerli degerler
  var IMEI_OK = '490154203237518', ICCID19_OK = '8990011234567890120', ICCID18_OK = '899001123456789019', ICCID20_OK = '89900112345678901231';

  function ornekPaket() {
    return {
      tur: 'kamera_tespit.solar_paketi', surum: 2, paket_id: '99999999-9999-4999-8999-999999999999',
      olusturma: '2026-11-26 10:00:00', lokasyon: { id: 5, ad: 'DELİCE Şantiyesi', enlem: 40.03, boylam: 34.08 },
      esikler: { iyi_m: 5, kabul_m: 15, red_m: 30, olcum_suresi_s: 45 },
      varsayilanlar: { aciklik_derece: 90, menzil_m: 30, kanal_sayisi: 4 }, manyetik_sapma_derece: 5.5,
      modeller: [{ ad: 'AV-S446', marka: 'Avenir', kanal_sayisi: 4, ptz_kanallar: [2, 3, 4] }, { ad: 'INOX', marka: 'INOX', kanal_sayisi: 2, ptz_kanallar: [] }],
      kayitlar: [
        { kayit_id: U1, ad: 'Solar-1', sira_no: 3, konum_adi: 'Km 2', is_adi: 'Demir Stok Sahası', enlem: 40.03, boylam: 34.08,
          marka: 'Avenir', model: 'AV-S446', seri_no: 'SN-1', sifre: 'GIZLI', ip: '192.168.1.5', sanal_ip: '10.10.1.5', imei: '123456789012345',
          kameralar: [
            { kanal_no: 1, ad: 'Ön', bolge: 'Kuzey kapı', ptz: false, yon_derece: 120, aciklik_derece: 100, menzil_m: 40 },
            { kanal_no: 2, ad: 'PTZ-1', bolge: 'Saha', ptz: true, yon_derece: null, aciklik_derece: 360, menzil_m: 60 }
          ] },
        { kayit_id: U2, ad: 'Solar-2', enlem: null, boylam: null }
      ]
    };
  }
  function cihazKamerasi(no, ek) {
    var k = {
      kanal_no: no, ad: 'Kanal ' + no, bolge: 'Bölge ' + no, ptz: no > 1,
      gorus: { yon_derece: 123.4, yon_kaynak: 'hedef_nokta', yon_manyetik_derece: null, pusula_dogruluk: null,
        aciklik_derece: 100, menzil_m: 35, hedef: { enlem: 40.0303, boylam: 34.0803, dogruluk_m: 6 } },
      gorus_foto: null, 'not': ''
    };
    Object.keys(ek || {}).forEach(function (a) { k[a] = ek[a]; });
    return k;
  }
  function kayit(o) {
    var k = {
      olcum_id: O1, kayit_id: U1, yeni: false, ad: 'Solar-1', sira_no: 3, konum_adi: 'Km 2', is_adi: 'Demir Stok Sahası',
      enlem: 40.0301, boylam: 34.0801, dogruluk_m: 4.2, okuma_sayisi: 20, sure_s: 45, zaman: '2026-11-26T10:00:00+03:00',
      marka: 'Avenir', model: 'AV-S446', seri_no: 'S', imei: '', iccid: '', hat_no: '', operator: '', tarife: '',
      bulut_cihaz_id: '', panel_bilgi: '', batarya_bilgi: '', kurulum_tarihi: '', calisma_durumu: '',
      'not': 'x', foto: JPEG, kameralar: [cihazKamerasi(1), cihazKamerasi(2), cihazKamerasi(3), cihazKamerasi(4)]
    };
    Object.keys(o || {}).forEach(function (a) { k[a] = o[a]; });
    return k;
  }
  function geoPaket() { return S.solarPaketDogrula(ornekPaket()).paket; }


  /* ---- 1.2.1: cihaz kimligi (seri no son 5 hane), bulut_hesap kaldirildi ---- */
  test('seriSon5Turet: buyuk harf, yalniz alfanumerik, 5ten kisa bos', function () {
    esit(S.seriSon5Turet('DS-A12/b30516'), 'B30516'.slice(-5)); esit(S.seriSon5Turet('av-s446 00030516'), '30516');
    esit(S.seriSon5Turet('ab1c2'), 'AB1C2'); esit(S.seriSon5Turet('1234'), ''); esit(S.seriSon5Turet('--12-'), ''); esit(S.seriSon5Turet(null), '');
    esit(S.seriSon5Turet('ğüş12345'), '12345');
  });
  test('seriSon5Normalize yalniz ^[A-Z0-9]{5}$ kabul eder', function () {
    esit(S.seriSon5Normalize('ab12c'), 'AB12C'); esit(S.seriSon5Normalize(' 30516 '), '30516');
    esit(S.seriSon5Normalize('1234'), ''); esit(S.seriSon5Normalize('123456'), ''); esit(S.seriSon5Normalize('12 45'), ''); esit(S.seriSon5Normalize(12345), '');
  });
  test('sonuc: seri_son5 acik deger > seri_no turevi > null; gecersiz yazilmaz', function () {
    esit(sonuc([kayit({ seri_no: 'XYZ-30516' })]).kayitlar[0].seri_son5, '30516');
    esit(sonuc([kayit({ seri_no: 'XYZ-30516', seri_son5: 'ab999' })]).kayitlar[0].seri_son5, 'AB999');
    esit(sonuc([kayit({ seri_no: 'XYZ-30516', seri_son5: '12' })]).kayitlar[0].seri_son5, '30516', 'gecersiz acik deger yok sayilir');
    esit(sonuc([kayit({ seri_no: 'A1', seri_son5: '!!!!!' })]).kayitlar[0].seri_son5, null);
    esit(sonuc([kayit({ seri_no: 'XYZ-30516' })]).kayitlar[0].seri_no, 'XYZ-30516', 'tam seri no de kalir');
  });
  test('sonuc: bulut_hesap girdide olsa bile sonuca yazilmaz; bulut_cihaz_id kalir', function () {
    var s = sonuc([kayit({ bulut_hesap: 'hesap@ornek.test', bulut_cihaz_id: 'B-1' })]);
    dogru(!/bulut_hesap|hesap@ornek/.test(JSON.stringify(s)));
    esit(s.kayitlar[0].bulut_cihaz_id, 'B-1');
  });
  test('paket: cihaz basina seri_son5 dogrulanir (yoksa null)', function () {
    var p = ornekPaket(); p.kayitlar[0].seri_son5 = 'ab123'; if (p.kayitlar[1]) p.kayitlar[1].seri_son5 = 'x';
    var d = S.solarPaketDogrula(p);
    dogru(d.ok); esit(d.paket.kayitlar[0].seri_son5, 'AB123');
    if (d.paket.kayitlar[1]) esit(d.paket.kayitlar[1].seri_son5, null);
    esit(S.solarPaketDogrula(ornekPaket()).paket.kayitlar[0].seri_son5, null);
  });
  test('kimlikCakismasi: baska kayitta ayni kimlik bulunur, kendisi sayilmaz', function () {
    var tel = [{ kayit_id: 'k1', seri_no: 'AA-30516' }, { kayit_id: 'k2', seri_son5: 'ZZ001' }, { kayit_id: 'k3', seri_no: 'kisa' }];
    var pk = [{ kayit_id: 'p1', seri_son5: '77777' }];
    esit(S.kimlikCakismasi('30516', 'yeni', tel, pk), { kaynak: 'telefon', kayit_id: 'k1' });
    esit(S.kimlikCakismasi('30516', 'k1', tel, pk), null, 'kendisi');
    esit(S.kimlikCakismasi('zz001', 'yeni', tel, pk), null, 'kucuk harf gecersiz biçim');
    esit(S.kimlikCakismasi('ZZ001', 'yeni', tel, pk), { kaynak: 'telefon', kayit_id: 'k2' });
    esit(S.kimlikCakismasi('77777', 'yeni', tel, pk), { kaynak: 'paket', kayit_id: 'p1' });
    esit(S.kimlikCakismasi('', 'yeni', tel, pk), null); esit(S.kimlikCakismasi('99999', 'yeni', tel, pk), null);
    esit(S.kayitKimligi({ seri_no: 'ab-12345' }), '12345'); esit(S.kayitKimligi({ seri_son5: 'q1w2e', seri_no: '000-99999' }), 'Q1W2E');
  });

  test('taslakGirdisiVar / kimlikYonlendirmeMetni: girdi varsa metin tasima/atilma uyarir', function () {
    var bos = { enlem: null, foto: null, 'not': '', kameralar: [cihazKamerasi(1, { gorus: { yon_derece: null, yon_kaynak: null } })] };
    esit(S.taslakGirdisiVar(bos), false); esit(S.taslakGirdisiVar(null), false);
    esit(S.taslakGirdisiVar({ enlem: 40.1, boylam: 34.1, kameralar: [] }), true);
    esit(S.taslakGirdisiVar({ foto: JPEG, kameralar: [] }), true);
    esit(S.taslakGirdisiVar({ kameralar: [cihazKamerasi(2)] }), true, 'yonlu kamera');
    dogru(!/taşın/.test(S.kimlikYonlendirmeMetni('30516', false)));
    dogru(/taşın/.test(S.kimlikYonlendirmeMetni('30516', true)) && /atılır/.test(S.kimlikYonlendirmeMetni('30516', true)) && /İptal/.test(S.kimlikYonlendirmeMetni('30516', true)));
  });
  test('taslagiBirlestir: yalniz hedefin bos alanlari dolar, dolu alan ezilmez', function () {
    var bosK = function (n) { return cihazKamerasi(n, { gorus: { yon_derece: null, yon_kaynak: null, aciklik_derece: 90, menzil_m: 30, hedef: null } }); };
    var hedef = { ad: 'H', enlem: null, boylam: null, foto: null, 'not': 'eski', kameralar: [bosK(1), cihazKamerasi(2, { gorus_foto: null })] };
    var kaynak = { enlem: 40.5, boylam: 34.5, dogruluk_m: 3, okuma_sayisi: 9, sure_s: 45, foto: JPEG, 'not': 'yeni',
      kameralar: [cihazKamerasi(1), cihazKamerasi(2, { gorus: { yon_derece: 10, yon_kaynak: 'elle', aciklik_derece: 80, menzil_m: 20, hedef: null } })] };
    var r = S.taslagiBirlestir(hedef, kaynak);
    esit(r.f.enlem, 40.5); esit(r.f.foto, JPEG); esit(r.f['not'], 'eski', 'dolu not ezilmez');
    esit(r.f.kameralar[0].gorus.yon_derece, 123.4, 'bos yon dolar'); esit(r.f.kameralar[1].gorus.yon_derece, 123.4, 'dolu yon ezilmez');
    dogru(r.tasinan.indexOf('konum') !== -1 && r.tasinan.indexOf('not') === -1);
    esit(hedef.enlem, null, 'girdi nesnesi degismez');
    var h2 = { enlem: 41, boylam: 35, foto: JPEG, kameralar: [] };
    esit(S.taslagiBirlestir(h2, kaynak).f.enlem, 41, 'dolu konum ezilmez');
  });

  /* ---- yon / geometri ---- */
  test('surum 1.2.1', function () { esit(M.UYGULAMA_SURUMU, '1.2.1'); });
  test('hedefYonuHesapla ana yonler', function () {
    var k = S.hedefYonuHesapla(40, 34, 40.001, 34); yakin(k.yon_derece, 0, 0.05); yakin(k.mesafe_m, 111.2, 0.5);
    var d = S.hedefYonuHesapla(40, 34, 40, 34.001); yakin(d.yon_derece, 90, 0.1); yakin(d.mesafe_m, 85.2, 0.5);
    yakin(S.hedefYonuHesapla(40, 34, 39.999, 34).yon_derece, 180, 0.05);
    yakin(S.hedefYonuHesapla(40, 34, 40, 33.999).yon_derece, 270, 0.1);
  });
  test('hedefYonuHesapla bilinen cift (Londra -> Paris)', function () {
    var r = S.hedefYonuHesapla(51.5074, -0.1278, 48.8566, 2.3522);
    yakin(r.yon_derece, 148.1, 0.3, 'baslangic kerterizi'); yakin(r.mesafe_m, 343500, 1500, 'mesafe');
  });
  test('hedefYonuHesapla ekvatorda 45 dereceye yakin, 0-360 araliginda', function () {
    yakin(S.hedefYonuHesapla(0, 0, 1, 1).yon_derece, 45, 0.1);
    var r = S.hedefYonuHesapla(40, 34, 40.001, 33.99999999);
    dogru(r.yon_derece >= 0 && r.yon_derece < 360, 'aralik: ' + r.yon_derece);
  });
  test('hedefYonuHesapla gecersiz girdi', function () {
    esit(S.hedefYonuHesapla(NaN, 34, 40, 34), null); esit(S.hedefYonuHesapla(91, 34, 40, 34), null);
    esit(S.hedefYonuHesapla(40, 34, 40, 181), null); esit(S.hedefYonuHesapla(null, 34, 40, 34), null);
    esit(S.hedefYonuHesapla('40', 34, 40, 34), null);
    esit(S.hedefYonuHesapla(40, 34, 40, 34).mesafe_m, 0);
  });
  test('manyetiktenGercege', function () {
    esit(S.manyetiktenGercege(10, 5.5), 15.5); esit(S.manyetiktenGercege(359, 5.5), 4.5);
    esit(S.manyetiktenGercege(350, -20), 330); esit(S.manyetiktenGercege(354.5, 5.5), 0);
    esit(S.manyetiktenGercege(NaN, 5.5), null); esit(S.manyetiktenGercege(10), 15.5, 'sapma yoksa varsayilan 5.5');
  });
  test('dairselOrtalama 0/360 gecisi', function () {
    dogru(dairesel(S.dairselOrtalama([350, 10]), 0) < 1e-6, '350 ve 10');
    dogru(dairesel(S.dairselOrtalama([359, 1, 0, 2, 358]), 0) < 0.5);
    yakin(S.dairselOrtalama([10, 20, 30]), 20, 1e-6);
    yakin(S.dairselOrtalama([170, 190]), 180, 1e-6);
    esit(S.dairselOrtalama([90, 270]), null, 'birbirini goturur'); esit(S.dairselOrtalama([]), null);
    esit(S.dairselOrtalama([NaN, 'a']), null);
  });
  test('dairselSapma kucuk/buyuk', function () {
    dogru(S.dairselSapma([100, 100, 100]) < 1e-3);
    dogru(S.dairselSapma([350, 10, 355, 5]) < 10, '0/360 gecisinde sapma kucuk kalir');
    dogru(S.dairselSapma([0, 90, 180, 270]) >= 90);
  });
  test('pusulaYonuAlfaBeta bilinen durumlar (telefon dik, arka yuz ileri)', function () {
    yakin(S.pusulaYonuAlfaBeta(0, 90, 0), 0, 1e-6); yakin(S.pusulaYonuAlfaBeta(90, 90, 0), 270, 1e-6);
    yakin(S.pusulaYonuAlfaBeta(180, 90, 0), 180, 1e-6); yakin(S.pusulaYonuAlfaBeta(270, 90, 0), 90, 1e-6);
    esit(S.pusulaYonuAlfaBeta(0, 0, 0), null, 'yatay telefon: yon tanimsiz'); esit(S.pusulaYonuAlfaBeta(null, 90, 0), null);
  });
  test('yonAdi', function () {
    esit(S.yonAdi(0), 'K'); esit(S.yonAdi(45), 'KD'); esit(S.yonAdi(90), 'D'); esit(S.yonAdi(359), 'K'); esit(S.yonAdi(225), 'GB');
    esit(S.yonAdi(NaN), '');
  });

  /* ---- pusula okumasi (sahte pencere) ---- */
  function sahtePencere(ios, izin) {
    var w = { dinleyiciler: {}, izinCagrildi: 0 };
    w.addEventListener = function (ad, fn) { (w.dinleyiciler[ad] = w.dinleyiciler[ad] || []).push(fn); };
    w.removeEventListener = function (ad, fn) { w.dinleyiciler[ad] = (w.dinleyiciler[ad] || []).filter(function (x) { return x !== fn; }); };
    w.say = function () { var n = 0; Object.keys(w.dinleyiciler).forEach(function (k) { n += w.dinleyiciler[k].length; }); return n; };
    w.gonder = function (ad, olay) { (w.dinleyiciler[ad] || []).slice().forEach(function (fn) { fn(olay); }); };
    if (ios) {
      w.DeviceOrientationEvent = { requestPermission: function () { w.izinCagrildi++; return Promise.resolve(izin || 'granted'); } };
    }
    return w;
  }
  function sahteZamanlayici() {
    var z = { fn: null, temizlendi: false };
    z.setTimeout = function (fn) { z.fn = fn; return 7; };
    z.clearTimeout = function () { z.temizlendi = true; };
    return z;
  }
  function bekle() { return new Promise(function (c) { setTimeout(c, 0); }); }

  test('pusula iOS: izin dokunusta senkron istenir, webkitCompassHeading dairesel ortalanir', function () {
    var w = sahtePencere(true, 'granted'), z = sahteZamanlayici(), sonuc = null, hata = null;
    S.pusulaOkumasi(w, { sure_s: 3, setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onOkuma: function () {}, onBitti: function (r) { sonuc = r; }, onHata: function (h) { hata = h; }
    });
    esit(w.izinCagrildi, 1, 'requestPermission cagri donmeden ONCE (senkron) cagrilmali');
    return bekle().then(function () {
      dogru(w.say() > 0, 'izinden sonra dinleyici baglanmali');
      [358, 359, 1, 2, 0, 359, 1, 0, 358, 2].forEach(function (d) {
        w.gonder('deviceorientation', { webkitCompassHeading: d, webkitCompassHeadingAccuracy: 12 });
      });
      z.fn();
      esit(hata, null);
      dogru(sonuc && dairesel(sonuc.yon_manyetik_derece, 0) < 1, 'ortalama ~0 (180 DEGIL): ' + (sonuc && sonuc.yon_manyetik_derece));
      esit(sonuc.okuma_sayisi, 10); esit(sonuc.kaynak, 'ios');
      dogru(sonuc.pusula_dogruluk >= 12, 'iOS dogruluk degeri korunur');
      esit(w.say(), 0, 'dinleyiciler temizlenmeli');
    });
  });
  test('pusula iOS: izin reddi -> izin_yok, dinleyici yok', function () {
    var w = sahtePencere(true, 'denied'), z = sahteZamanlayici(), hata = null, sonuc = null;
    S.pusulaOkumasi(w, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onBitti: function (r) { sonuc = r; }, onHata: function (h) { hata = h; }
    });
    return bekle().then(function () {
      esit(hata && hata.kod, 'izin_yok'); esit(sonuc, null); esit(w.say(), 0);
      dogru(/izni/.test(hata.mesaj) && /elle/.test(hata.mesaj), 'Turkce yonlendirme');
    });
  });
  test('pusula Android: deviceorientationabsolute alpha/beta/gamma', function () {
    var w = sahtePencere(false), z = sahteZamanlayici(), sonuc = null, i;
    S.pusulaOkumasi(w, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, {
      onBitti: function (r) { sonuc = r; }, onHata: function (h) { throw new Error('hata ' + h.kod); }
    });
    dogru(w.say() > 0, 'izin gerekmez: hemen dinler');
    for (i = 0; i < 10; i++) w.gonder('deviceorientationabsolute', { absolute: true, alpha: 90, beta: 90, gamma: 0 });
    w.gonder('deviceorientation', { absolute: false, alpha: 10, beta: 90, gamma: 0 }); // goreli olay yok sayilir
    z.fn();
    yakin(sonuc.yon_manyetik_derece, 270, 0.2); esit(sonuc.okuma_sayisi, 10); esit(sonuc.kaynak, 'android');
    esit(w.say(), 0);
  });
  test('pusula: veri gelmezse desteklenmiyor, azsa yetersiz', function () {
    var w = sahtePencere(false), z = sahteZamanlayici(), hata = null;
    S.pusulaOkumasi(w, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, { onBitti: function () { throw new Error('olmamali'); }, onHata: function (h) { hata = h; } });
    w.gonder('deviceorientation', { absolute: false, alpha: 10, beta: 90, gamma: 0 });
    z.fn(); esit(hata.kod, 'desteklenmiyor'); dogru(/elle/.test(hata.mesaj));
    var w2 = sahtePencere(false), z2 = sahteZamanlayici(), hata2 = null;
    S.pusulaOkumasi(w2, { setTimeout: z2.setTimeout, clearTimeout: z2.clearTimeout }, { onBitti: function () { throw new Error('olmamali'); }, onHata: function (h) { hata2 = h; } });
    for (var i = 0; i < 3; i++) w2.gonder('deviceorientationabsolute', { absolute: true, alpha: 0, beta: 90, gamma: 0 });
    z2.fn(); esit(hata2.kod, 'yetersiz');
    var hata3 = null; S.pusulaOkumasi(null, {}, { onHata: function (h) { hata3 = h; } }); esit(hata3.kod, 'desteklenmiyor');
  });
  test('pusula iptal dinleyicileri birakir', function () {
    var w = sahtePencere(false), z = sahteZamanlayici();
    var o = S.pusulaOkumasi(w, { setTimeout: z.setTimeout, clearTimeout: z.clearTimeout }, { onBitti: function () { throw new Error('olmamali'); }, onHata: function () {} });
    dogru(w.say() > 0); o.iptal(); esit(w.say(), 0); dogru(z.temizlendi);
  });

  /* ---- paket (surum 2) ---- */
  test('solarPaketDogrula gecerli v2 paket, kameralar ve beyaz liste', function () {
    var r = S.solarPaketDogrula(ornekPaket());
    dogru(r.ok, JSON.stringify(r.hatalar));
    esit(r.paket.surum, 2); esit(r.paket.kayitlar.length, 2); esit(r.paket.manyetik_sapma_derece, 5.5);
    var c = r.paket.kayitlar[0];
    esit(c.sira_no, 3); esit(c.konum_adi, 'Km 2'); esit(c.is_adi, 'Demir Stok Sahası'); esit(c.model, 'AV-S446');
    esit(c.kameralar.length, 2); esit(c.kameralar[0].yon_derece, 120); esit(c.kameralar[0].ptz, false); esit(c.kameralar[1].ptz, true);
    esit(c.kameralar[1].yon_derece, null); esit(c.kameralar[1].aciklik_derece, 360);
    esit(r.paket.kayitlar[1].enlem, null); esit(r.paket.kayitlar[1].kameralar, []);
    esit(r.paket.varsayilanlar, { aciklik_derece: 90, menzil_m: 30, kanal_sayisi: 4 });
    esit(r.paket.modeller.length, 2); esit(r.paket.modeller[0].ptz_kanallar, [2, 3, 4]);
    var s = JSON.stringify(r.paket);
    ['GIZLI', '192.168.1.5', '10.10.1.5', 'sifre', 'sanal_ip', '123456789012345', 'imei'].forEach(function (y) { dogru(s.indexOf(y) === -1, 'sizinti: ' + y); });
  });
  test('solarPaketDogrula surum 1 ACIKCA reddedilir, 3 de reddedilir', function () {
    var p = ornekPaket(); p.surum = 1;
    var r = S.solarPaketDogrula(p);
    dogru(!r.ok && r.paket === null); dogru(/eski sürüm \(1\)/.test(r.hatalar.join(' ')), r.hatalar.join('|'));
    dogru(/yeni bir solar paketi/.test(r.hatalar.join(' ')), 'yonlendirme mesaji');
    p.surum = 3; dogru(!S.solarPaketDogrula(p).ok);
    p.surum = '2'; dogru(!S.solarPaketDogrula(p).ok, 'metin surum');
    delete p.surum; dogru(!S.solarPaketDogrula(p).ok);
  });
  test('solarPaketDogrula red durumlari', function () {
    function degis(f) { var p = ornekPaket(); f(p); return S.solarPaketDogrula(p); }
    dogru(!S.solarPaketDogrula(null).ok); dogru(!S.solarPaketDogrula([]).ok); dogru(!S.solarPaketDogrula({}).ok);
    dogru(!degis(function (p) { p.tur = 'kamera_tespit.saha_gps_paketi'; }).ok, 'tur');
    dogru(!degis(function (p) { p.paket_id = 'a'; }).ok, 'paket_id');
    dogru(!degis(function (p) { p.lokasyon.ad = ''; }).ok, 'lokasyon');
    dogru(!degis(function (p) { delete p.kayitlar; }).ok, 'kayitlar yok');
    dogru(!degis(function (p) { p.esikler.iyi_m = 50; }).ok, 'esik sirasi');
    dogru(!degis(function (p) { p.manyetik_sapma_derece = 99; }).ok, 'sapma araligi');
    dogru(!degis(function (p) { p.manyetik_sapma_derece = 'x'; }).ok, 'sapma tur');
  });
  test('solarPaketDogrula kayit eleme: uuid, ad, yinelenen, aralik, uzun metin, kanal', function () {
    var p = ornekPaket();
    p.kayitlar.push({ kayit_id: 'x', ad: 'kimliksiz' }, { kayit_id: U3, ad: '   ' }, { kayit_id: U1, ad: 'kopya' },
      { kayit_id: U4, ad: 'A'.repeat(300), konum_adi: 'K'.repeat(300), is_adi: 'I'.repeat(300), enlem: 99, boylam: 34, sira_no: -2,
        kameralar: [{ kanal_no: 1, ad: '', bolge: 'B'.repeat(300), yon_derece: 400, aciklik_derece: 0, menzil_m: 9999 },
          { kanal_no: 1, ad: 'kopya kanal' }, { kanal_no: 0, ad: 'sifir' }, { kanal_no: 9, ad: 'dokuz' }, { kanal_no: 2.5, ad: 'kesirli' }, 'x'] });
    var r = S.solarPaketDogrula(p);
    dogru(r.ok); esit(r.paket.kayitlar.length, 3); dogru(r.uyarilar.length === 1, 'atlanan uyarisi');
    var u4 = r.paket.kayitlar[2];
    esit(u4.ad.length, 100); esit(u4.konum_adi.length, 100); esit(u4.is_adi.length, 100); esit(u4.sira_no, null);
    esit(u4.enlem, null); esit(u4.kameralar.length, 1, 'yinelenen/gecersiz kanal elendi');
    var k = u4.kameralar[0];
    esit(k.ad, 'Kanal 1'); esit(k.bolge.length, 100); esit(k.yon_derece, null); esit(k.aciklik_derece, 90); esit(k.menzil_m, 30);
  });
  test('solarPaketDogrula en cok 8 kanal; ptz 1 de gecerli; yon 360 -> 0', function () {
    var p = ornekPaket(); var kam = [];
    for (var i = 1; i <= 12; i++) kam.push({ kanal_no: i <= 8 ? i : 8, ad: 'K' + i, ptz: i === 1 ? 1 : 0, yon_derece: i === 1 ? 360 : 10 });
    p.kayitlar = [{ kayit_id: U1, ad: 'S', kameralar: kam }];
    var c = S.solarPaketDogrula(p).paket.kayitlar[0];
    esit(c.kameralar.length, 8); esit(c.kameralar[0].ptz, true); esit(c.kameralar[0].yon_derece, 0); esit(c.kameralar[1].ptz, false);
  });
  test('solarPaketDogrula bos kayit listesi gecerli; sapma/varsayilan/modeller yoksa varsayilanlar', function () {
    var p = ornekPaket(); p.kayitlar = []; delete p.manyetik_sapma_derece; delete p.varsayilanlar; delete p.modeller;
    var r = S.solarPaketDogrula(p); dogru(r.ok); esit(r.paket.manyetik_sapma_derece, 5.5);
    esit(r.paket.varsayilanlar, { aciklik_derece: 90, menzil_m: 30, kanal_sayisi: 4 }); esit(r.paket.modeller, []);
  });

  /* ---- model sablonu / kanal ---- */
  test('MODELLER sabiti: AV-S446 4 kanal ptz [2,3,4]; O-Kam, INOX, Diger', function () {
    var ad = S.MODELLER.map(function (m) { return m.ad; });
    esit(ad, ['AV-S446', 'O-Kam', 'INOX', 'Diğer']);
    esit(S.MODELLER[0], { ad: 'AV-S446', marka: 'Avenir', kanal_sayisi: 4, ptz_kanallar: [2, 3, 4] });
    S.MODELLER.forEach(function (m) { esit(m.kanal_sayisi, 4); });
  });
  test('modelListesi: paketin modelleri oncelikli, Diger her zaman sonda; paket bossa sabit sablon', function () {
    var l = S.modelListesi(geoPaket());
    esit(l.map(function (m) { return m.ad; }), ['AV-S446', 'INOX', 'Diğer']); esit(l[1].kanal_sayisi, 2);
    var l2 = S.modelListesi({ modeller: [] }); esit(l2.map(function (m) { return m.ad; }), ['AV-S446', 'O-Kam', 'INOX', 'Diğer']);
    esit(S.modelListesi(null).length, 4);
    esit(S.modeliBul(l, ' av-s446 ').ad, 'AV-S446'); esit(S.modeliBul(l, 'yok'), null); esit(S.modeliBul(l, ''), null);
  });
  test('kanalSablonuUygula: AV-S446 -> 4 kanal, 2-4 PTZ, kanal 1 sabit', function () {
    var k = S.kanalSablonuUygula([], S.MODELLER[0], { aciklik_derece: 90, menzil_m: 30 });
    esit(k.map(function (x) { return x.kanal_no; }), [1, 2, 3, 4]); esit(k.map(function (x) { return x.ptz; }), [false, true, true, true]);
    esit(k[0].ad, 'Kanal 1'); esit(k[0].gorus.yon_derece, null); esit(k[0].gorus.aciklik_derece, 90);
  });
  test('kanalSablonuUygula: mevcut kanal verisi korunur, sablonda olmayan bos kanal atilir, dolu kanal korunur', function () {
    var vars = { aciklik_derece: 90, menzil_m: 30 };
    var eski = S.kanalSablonuUygula([], { kanal_sayisi: 6, ptz_kanallar: [] }, vars);
    eski[0].ad = 'Ön'; eski[0].gorus.yon_derece = 77; eski[4].bolge = 'Dolu'; // 5. kanal dolu, 6. bos
    var yeni = S.kanalSablonuUygula(eski, S.MODELLER[0], vars);
    esit(yeni.map(function (x) { return x.kanal_no; }), [1, 2, 3, 4, 5], '6 bos atildi, 5 dolu kaldi');
    esit(yeni[0].ad, 'Ön'); esit(yeni[0].gorus.yon_derece, 77); esit(yeni[1].ptz, true); esit(yeni[4].bolge, 'Dolu'); esit(yeni[4].ptz, false);
  });
  test('kanalBosMu / kanalYonluMu / yonOzeti', function () {
    var k = S.yeniKanal(2, true, { aciklik_derece: 90, menzil_m: 30 });
    dogru(S.kanalBosMu(k)); dogru(!S.kanalYonluMu(k));
    k.gorus.yon_derece = 0; dogru(!S.kanalBosMu(k), 'yon 0 da veridir'); dogru(S.kanalYonluMu(k), '0 derece yonludur');
    esit(S.yonOzeti([{ gorus: { yon_derece: 10 } }, { gorus: { yon_derece: null } }, { gorus: { yon_derece: 0 } }, { yon_derece: 5 }]), { yonlu: 3, toplam: 4 });
    esit(S.yonOzeti(undefined), { yonlu: 0, toplam: 0 });
  });

  /* ---- IMEI / ICCID ---- */
  test('luhnGecerliMi / imeiGecerliMi', function () {
    dogru(S.luhnGecerliMi('79927398713')); dogru(!S.luhnGecerliMi('79927398710')); dogru(!S.luhnGecerliMi('')); dogru(!S.luhnGecerliMi('12a4'));
    dogru(S.imeiGecerliMi(IMEI_OK)); dogru(S.imeiGecerliMi('49-015420-323751-8'), 'ayiraclar atilir');
    dogru(!S.imeiGecerliMi('490154203237519'), 'luhn'); dogru(!S.imeiGecerliMi('49015420323751'), '14 hane'); dogru(!S.imeiGecerliMi('4901542032375180'), '16 hane');
    dogru(!S.imeiGecerliMi('')); dogru(!S.imeiGecerliMi(null));
  });
  test('iccidGecerliMi 18/19/20 hane + Luhn', function () {
    dogru(S.iccidGecerliMi(ICCID18_OK)); dogru(S.iccidGecerliMi(ICCID19_OK)); dogru(S.iccidGecerliMi(ICCID20_OK));
    dogru(!S.iccidGecerliMi('89900112345678901'), '17 hane'); dogru(!S.iccidGecerliMi('899001123456789012312'), '21 hane');
    dogru(!S.iccidGecerliMi('8990011234567890121'), 'luhn'); dogru(S.iccidGecerliMi('8990 0112 3456 7890 120'), 'bosluk atilir');
  });
  test('imeiUyarisi / iccidUyarisi: bos=uyari yok, bicim ve luhn uyarisi (Turkce)', function () {
    esit(S.imeiUyarisi(''), ''); esit(S.imeiUyarisi(IMEI_OK), '');
    dogru(/15 haneli/.test(S.imeiUyarisi('1234'))); dogru(/Luhn/.test(S.imeiUyarisi('490154203237519')));
    dogru(/engellenmez/.test(S.imeiUyarisi('490154203237519')));
    esit(S.iccidUyarisi(''), ''); esit(S.iccidUyarisi(ICCID19_OK), '');
    dogru(/18-20/.test(S.iccidUyarisi('123'))); dogru(/Luhn/.test(S.iccidUyarisi('8990011234567890121')));
  });

  /* ---- sonuc (surum 2) ---- */
  var SONUC_ANAHTAR = ['tur', 'surum', 'paket_id', 'lokasyon', 'olusturma', 'olcen', 'uygulama', 'kayitlar'];
  var KAYIT_ANAHTAR = ['olcum_id', 'kayit_id', 'yeni', 'ad', 'sira_no', 'konum_adi', 'is_adi', 'enlem', 'boylam', 'dogruluk_m', 'okuma_sayisi',
    'sure_s', 'zaman', 'marka', 'model', 'seri_no', 'seri_son5', 'imei', 'bulut_cihaz_id', 'hat_no', 'iccid', 'operator', 'tarife',
    'panel_bilgi', 'batarya_bilgi', 'kurulum_tarihi', 'calisma_durumu', 'not', 'foto', 'kameralar'];
  var KAMERA_ANAHTAR = ['kanal_no', 'ad', 'bolge', 'ptz', 'gorus', 'gorus_foto', 'not'];
  var GORUS_ANAHTAR = ['yon_derece', 'yon_kaynak', 'yon_manyetik_derece', 'pusula_dogruluk', 'aciklik_derece', 'menzil_m', 'hedef'];
  function sonuc(kayitlar, ek) {
    var g = { paket: geoPaket(), olcen: 'Test', kayitlar: kayitlar, simdi: new Date(2026, 10, 26, 14, 5), user_agent: 'UA' };
    Object.keys(ek || {}).forEach(function (k) { g[k] = ek[k]; });
    return S.solarSonucOlustur(g);
  }
  test('solarSonucOlustur v2 sema BIREBIR (cihaz, kamera, gorus anahtarlari)', function () {
    var s = sonuc([kayit()]);
    esit(Object.keys(s).sort(), SONUC_ANAHTAR.slice().sort());
    esit(s.tur, 'kamera_tespit.solar_sonucu'); esit(s.surum, 2); esit(s.paket_id, geoPaket().paket_id);
    esit(s.lokasyon, { id: 5, ad: 'DELİCE Şantiyesi' }); esit(s.olcen, 'Test');
    esit(s.uygulama, { surum: '1.2.1', user_agent: 'UA' });
    dogru(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s.olusturma), s.olusturma);
    esit(s.kayitlar.length, 1);
    var k = s.kayitlar[0];
    esit(Object.keys(k).sort(), KAYIT_ANAHTAR.slice().sort());
    esit(k.kameralar.length, 4);
    k.kameralar.forEach(function (c) {
      esit(Object.keys(c).sort(), KAMERA_ANAHTAR.slice().sort()); esit(Object.keys(c.gorus).sort(), GORUS_ANAHTAR.slice().sort());
    });
    esit(k.sira_no, 3); esit(k.konum_adi, 'Km 2'); esit(k.is_adi, 'Demir Stok Sahası'); esit(k.yeni, false); esit(k.foto, JPEG);
    var c1 = k.kameralar[0];
    esit(c1.kanal_no, 1); esit(c1.bolge, 'Bölge 1'); esit(c1.ptz, false); esit(k.kameralar[1].ptz, true);
    esit(c1.gorus.yon_derece, 123.4); esit(c1.gorus.yon_kaynak, 'hedef_nokta'); esit(c1.gorus.hedef, { enlem: 40.0303, boylam: 34.0803, dogruluk_m: 6 });
    esit(c1.gorus_foto, null); esit(Object.keys(c1.gorus.hedef).sort(), ['boylam', 'dogruluk_m', 'enlem']);
  });
  test('solarSonucOlustur: bos birakilan alanlar null (masaustunde eskisini ezmez), dolu alanlar tam', function () {
    var k = sonuc([kayit()]).kayitlar[0];
    ['imei', 'iccid', 'hat_no', 'operator', 'tarife', 'bulut_cihaz_id', 'panel_bilgi', 'batarya_bilgi', 'kurulum_tarihi', 'calisma_durumu']
      .forEach(function (a) { esit(k[a], null, a); });
    esit(k.kameralar[0]['not'], null); esit(k.kameralar[0].bolge, 'Bölge 1');
    var d = sonuc([kayit({ konum_adi: '', is_adi: '  ', marka: '', model: '', seri_no: '', 'not': '', sira_no: undefined })]).kayitlar[0];
    ['konum_adi', 'is_adi', 'marka', 'model', 'seri_no', 'seri_son5', 'not', 'sira_no'].forEach(function (a) { esit(d[a], null, a); });
    var m = sonuc([kayit({ imei: '49-015420 323751-8', iccid: ICCID19_OK, hat_no: '+90 555 000 00 00', operator: 'Op', tarife: 'T1',
      bulut_cihaz_id: 'B-1', panel_bilgi: '2x100W', batarya_bilgi: '100Ah',
      kurulum_tarihi: '2026-05-17', calisma_durumu: 'arizali' })]).kayitlar[0];
    esit(m.imei, IMEI_OK, 'imei yalniz rakam'); esit(m.iccid, ICCID19_OK); esit(m.hat_no, '+90 555 000 00 00'); esit(m.operator, 'Op');
    esit(m.bulut_cihaz_id, 'B-1'); esit(m.kurulum_tarihi, '2026-05-17'); esit(m.calisma_durumu, 'arizali');
    esit(m.panel_bilgi, '2x100W'); esit(m.batarya_bilgi, '100Ah'); esit(m.tarife, 'T1');
  });
  test('solarSonucOlustur: gecersiz tarih/durum null; Luhn hatali IMEI yine gonderilir (uyari, engel degil)', function () {
    var k = sonuc([kayit({ kurulum_tarihi: '2026-02-31', calisma_durumu: 'cok_iyi', imei: '490154203237519', iccid: '123' })]).kayitlar[0];
    esit(k.kurulum_tarihi, null); esit(k.calisma_durumu, null); esit(k.imei, '490154203237519'); esit(k.iccid, '123');
    ['calisiyor', 'arizali', 'bakimda', 'bilinmiyor'].forEach(function (d) { esit(sonuc([kayit({ calisma_durumu: d })]).kayitlar[0].calisma_durumu, d); });
    esit(sonuc([kayit({ kurulum_tarihi: '2024-02-29' })]).kayitlar[0].kurulum_tarihi, '2024-02-29');
    esit(sonuc([kayit({ imei: 'abc' })]).kayitlar[0].imei, null);
  });
  test('solarSonucOlustur sifre/parola/password anahtari HICBIR yerde yok (girdide olsa bile)', function () {
    var kam = cihazKamerasi(1); kam.sifre = 'x'; kam.gorus.password = 'y';
    var s = sonuc([kayit({ bulut_sifre: 'z', sifre: 'q', parola: 'p', password: 'w', kameralar: [kam] })]);
    var json = JSON.stringify(s);
    dogru(!/sifre|parola|password/i.test(json), 'sifre anahtari sizdi: ' + json.slice(0, 300));
  });
  test('solarSonucOlustur pusula: yon_derece = (manyetik + sapma) mod 360 BURADA hesaplanir, ham manyetik saklanir, hedef null', function () {
    var kam = cihazKamerasi(1, { gorus: { yon_derece: 7, yon_kaynak: 'pusula', yon_manyetik_derece: 100, pusula_dogruluk: 8.2, aciklik_derece: 85, menzil_m: 30, hedef: { enlem: 40, boylam: 34 } } });
    var c = sonuc([kayit({ kameralar: [kam] })]).kayitlar[0].kameralar[0];
    esit(c.gorus.yon_derece, 105.5, 'girdideki yon degil, manyetik+sapma'); esit(c.gorus.yon_manyetik_derece, 100); esit(c.gorus.pusula_dogruluk, 8.2); esit(c.gorus.hedef, null);
    var kam2 = cihazKamerasi(1, { gorus: { yon_derece: 0, yon_kaynak: 'pusula', yon_manyetik_derece: 355, aciklik_derece: 85, menzil_m: 30 } });
    esit(sonuc([kayit({ kameralar: [kam2] })]).kayitlar[0].kameralar[0].gorus.yon_derece, 0.5, '355 + 5.5 = 360.5 -> 0.5');
    var p = geoPaket(); p.manyetik_sapma_derece = -3;
    esit(S.solarSonucOlustur({ paket: p, kayitlar: [kayit({ kameralar: [kam] })], simdi: new Date() }).kayitlar[0].kameralar[0].gorus.yon_derece, 97, 'paketin sapmasi kullanilir');
  });
  test('solarSonucOlustur pusula iddiasi ham olcum olmadan tasinmaz -> elle', function () {
    var kam = cihazKamerasi(1, { gorus: { yon_derece: 33, yon_kaynak: 'pusula', yon_manyetik_derece: null, aciklik_derece: 85, menzil_m: 30 } });
    var g = sonuc([kayit({ kameralar: [kam] })]).kayitlar[0].kameralar[0].gorus;
    esit(g.yon_kaynak, 'elle'); esit(g.yon_derece, 33); esit(g.yon_manyetik_derece, null); esit(g.pusula_dogruluk, null);
  });
  test('solarSonucOlustur yon girilmediyse yon_derece=null (kanal basina)', function () {
    var kam = cihazKamerasi(1, { gorus: { yon_derece: null, yon_kaynak: 'elle', aciklik_derece: 100, menzil_m: 35 } });
    var g = sonuc([kayit({ kameralar: [kam] })]).kayitlar[0].kameralar[0].gorus;
    esit(g.yon_derece, null); esit(g.yon_kaynak, null); esit(g.yon_manyetik_derece, null); esit(g.hedef, null); esit(g.aciklik_derece, 100);
  });
  test('solarSonucOlustur yon 360 -> 0, kaynak bilinmiyorsa elle, aralik disi aciklik/menzil varsayilana', function () {
    var kam = cihazKamerasi(1, { gorus: { yon_derece: 360, yon_kaynak: 'sacma', aciklik_derece: 999, menzil_m: 0 } });
    var g = sonuc([kayit({ kameralar: [kam] })]).kayitlar[0].kameralar[0].gorus;
    esit(g.yon_derece, 0); esit(g.yon_kaynak, 'elle'); esit(g.aciklik_derece, 90); esit(g.menzil_m, 30);
  });
  test('solarSonucOlustur kanal kurallari: kanal_no 1-8, tekrar yok, en cok 8, siralanir, ad bossa Kanal N, kameralar yoksa []', function () {
    var kam = [cihazKamerasi(3), cihazKamerasi(1, { ad: '  ' }), cihazKamerasi(3, { ad: 'tekrar' }), cihazKamerasi(0), cihazKamerasi(9), { x: 1 }];
    var c = sonuc([kayit({ kameralar: kam })]).kayitlar[0].kameralar;
    esit(c.map(function (x) { return x.kanal_no; }), [1, 3]); esit(c[0].ad, 'Kanal 1'); esit(c[1].ad, 'Kanal 3');
    var cok = []; for (var i = 1; i <= 8; i++) cok.push(cihazKamerasi(i));
    esit(sonuc([kayit({ kameralar: cok })]).kayitlar[0].kameralar.length, 8);
    esit(sonuc([kayit({ kameralar: undefined })]).kayitlar[0].kameralar, []);
    esit(sonuc([kayit({ kameralar: 'x' })]).kayitlar[0].kameralar, []);
  });
  test('solarSonucOlustur ad zorunlu, kimlik zorunlu, konumsuz kayit null koordinatla gecer', function () {
    var s = sonuc([kayit({ ad: '  ' }), kayit({ olcum_id: undefined }), kayit({ kayit_id: U2, olcum_id: O2, enlem: null, boylam: null, dogruluk_m: null })]);
    esit(s.kayitlar.length, 1); esit(s.kayitlar[0].enlem, null); esit(s.kayitlar[0].dogruluk_m, null); esit(s.kayitlar[0].okuma_sayisi, null);
  });
  test('solarSonucOlustur ayni kayit_id icin en yeni zaman', function () {
    var s = sonuc([kayit({ olcum_id: O1, zaman: '2026-11-26T10:00:00+03:00', ad: 'eski' }), kayit({ olcum_id: O2, zaman: '2026-11-26T11:00:00+03:00', ad: 'yeni' }),
      kayit({ olcum_id: O3, kayit_id: U2, ad: 'baska' })]);
    esit(s.kayitlar.length, 2); esit(s.kayitlar[0].ad, 'yeni'); esit(s.kayitlar[0].olcum_id, O2);
  });
  test('solarSonucOlustur foto (cihaz + kanal) yalniz gecerli JPEG ve boyut sinirinda', function () {
    var buyuk = 'data:image/jpeg;base64,' + 'A'.repeat(400 * 1024);
    var k = sonuc([kayit({ foto: 'data:image/png;base64,AAAA', kameralar: [cihazKamerasi(1, { gorus_foto: buyuk }), cihazKamerasi(2, { gorus_foto: 'data:image/png;base64,AAAA' })] })]).kayitlar[0];
    esit(k.foto, null); esit(k.kameralar[0].gorus_foto, null); esit(k.kameralar[1].gorus_foto, null);
    var k2 = sonuc([kayit({ foto: JPEG, kameralar: [cihazKamerasi(1, { gorus_foto: JPEG })] })]).kayitlar[0];
    esit(k2.foto, JPEG); esit(k2.kameralar[0].gorus_foto, JPEG);
  });
  test('solarSonucOlustur metin sinirlari ve kontrol karakterleri', function () {
    var k = sonuc([kayit({ ad: 'A\u0000B'.repeat(80), konum_adi: 'x'.repeat(200), 'not': 'n'.repeat(900), marka: 'm'.repeat(90), panel_bilgi: 'p'.repeat(300),
      kameralar: [cihazKamerasi(1, { bolge: 'b'.repeat(200), 'not': 'q'.repeat(900) })] })]).kayitlar[0];
    esit(k.ad.length, 100); dogru(k.ad.indexOf('\u0000') === -1); esit(k.konum_adi.length, 100); esit(k['not'].length, 500); esit(k.marka.length, 60);
    esit(k.panel_bilgi.length, 120); esit(k.kameralar[0].bolge.length, 100); esit(k.kameralar[0]['not'].length, 500);
  });
  test('solarSonucOlustur JSON gidis-donus kayipsiz (yeni kayit isareti)', function () {
    var s = sonuc([kayit({ yeni: true, kayit_id: U4, olcum_id: O3 })]);
    esit(JSON.parse(JSON.stringify(s)), s); esit(s.kayitlar[0].yeni, true);
  });
  test('solarDosyaAdi', function () {
    esit(S.solarDosyaAdi('DELİCE Şantiyesi', new Date(2026, 10, 26, 14, 5)), 'solar_delice_santiyesi_20261126_1405.txt');
  });


  /* ---- IndexedDB 1 -> 2 yukseltme: mevcut Saha GPS verisi korunur ---- */
  // IDB testleri yalniz gercek zamanli kosuda (CDP, ?idb=1): headless --virtual-time-budget altinda IndexedDB hic cevap vermez.
  var IDB_ACIK = /[?&]idb=1/.test(location.search);
  function idbTest(ad, fn) { if (IDB_ACIK) test(ad, fn); }
  function istek(r) { return new Promise(function (coz, red) { r.onsuccess = function () { coz(r.result); }; r.onerror = function () { red(r.error); }; }); }
  function eskiVeritabaniKur() {
    return new Promise(function (coz, red) {
      var sil = indexedDB.deleteDatabase('saha_gps');
      sil.onerror = function () { red(sil.error); };
      sil.onblocked = function () { red(new Error('deleteDatabase bloklandi')); };
      sil.onsuccess = function () {
        var a = indexedDB.open('saha_gps', 1);
        a.onerror = function () { red(a.error); };
        a.onupgradeneeded = function () { // 1.1.0'daki sema
          var db = a.result;
          db.createObjectStore('paketler', { keyPath: 'paket_id' });
          db.createObjectStore('paket_veri', { keyPath: 'paket_id' });
          db.createObjectStore('olcumler', { keyPath: 'olcum_id' }).createIndex('paket_id', 'paket_id', { unique: false });
          db.createObjectStore('fotolar', { keyPath: 'olcum_id' });
          db.createObjectStore('ayarlar', { keyPath: 'k' });
        };
        a.onsuccess = function () {
          var db = a.result;
          var tx = db.transaction(['paketler', 'paket_veri', 'olcumler', 'fotolar', 'ayarlar'], 'readwrite');
          tx.objectStore('paketler').put({ paket_id: 'ESKIPAKET1', lokasyon_ad: 'Eski Saha', olusturma: '2026-10-01', yuklenme: '2026-10-01T10:00:00Z', cihaz_sayisi: 3 });
          tx.objectStore('paket_veri').put({ paket_id: 'ESKIPAKET1', paket: { paket_id: 'ESKIPAKET1', cihazlar: [{ mac: 'AA' }] } });
          tx.objectStore('olcumler').put({ olcum_id: 'eski-olcum-1', paket_id: 'ESKIPAKET1', mac: 'AA:BB:CC:DD:EE:FF', enlem: 40.1, boylam: 34.1, dogruluk_m: 4, zaman: '2026-10-01T10:00:00+03:00', gonderildi: null });
          tx.objectStore('fotolar').put({ olcum_id: 'eski-olcum-1', foto: JPEG });
          tx.objectStore('ayarlar').put({ k: 'olcen', v: 'Eski Olcen' });
          tx.oncomplete = function () { db.close(); coz(); };
          tx.onerror = function () { red(tx.error); };
        };
      };
    });
  }
  idbTest('IDB 1->2 yukseltme: eski olcum/foto/paket/ayar korunur, solar deposu eklenir', function () {
    dogru(typeof indexedDB !== 'undefined' && indexedDB, 'indexedDB yok (test ortami)');
    return eskiVeritabaniKur().then(function () { return D.hazirla(); }).then(function () {
      dogru(D.kaliciMi(), 'depo kalici modda acilmali (bellek moduna dusmemeli)');
      return Promise.all([D.olcumlerGetir('ESKIPAKET1'), D.fotoGetir('eski-olcum-1'), D.paketGetir('ESKIPAKET1'), D.ayarGetir('olcen'), D.paketListesi()]);
    }).then(function (s) {
      esit(s[0].length, 1, 'eski olcum'); esit(s[0][0].mac, 'AA:BB:CC:DD:EE:FF'); esit(s[0][0].dogruluk_m, 4);
      esit(s[1], JPEG, 'eski foto'); esit(s[2].paket_id, 'ESKIPAKET1'); esit(s[3], 'Eski Olcen', 'ayar');
      esit(s[4].length, 1); esit(s[4][0].olculen, 1); esit(s[4][0].gonderilmemis, 1);
      return indexedDB.open('saha_gps');
    }).then(function (acma) { return istek(acma); }).then(function (db) {
      var ad = Array.prototype.slice.call(db.objectStoreNames).sort(), surum = db.version;
      var idx = db.transaction('solar_kayitlar', 'readonly').objectStore('solar_kayitlar').indexNames.contains('paket_id');
      db.close();
      esit(surum, 2); esit(ad, ['ayarlar', 'fotolar', 'olcumler', 'paket_veri', 'paketler', 'solar_kayitlar']);
      dogru(idx, 'solar_kayitlar paket_id dizini');
    });
  });
  idbTest('solar deposu: kaydet, ayni kayit_id tek kalir, liste/sil, paket ozeti, paketSil', function () {
    var paket = geoPaket(), pid = paket.paket_id;
    return D.paketKaydet(paket).then(function () {
      return D.solarKaydet(Object.assign(kayit(), { paket_id: pid }));
    }).then(function () {
      return D.solarKaydet(Object.assign(kayit({ olcum_id: O2, ad: 'Guncel' }), { paket_id: pid })); // ayni kayit_id, yeni olcum
    }).then(function () {
      return D.solarKaydet(Object.assign(kayit({ olcum_id: O3, kayit_id: U4, yeni: true, ad: 'Telefonda eklenen' }), { paket_id: pid }));
    }).then(function () { return D.solarKayitlariGetir(pid); }).then(function (l) {
      esit(l.length, 2, 'ayni kayit_id icin tek kayit'); dogru(l.some(function (x) { return x.olcum_id === O2 && x.ad === 'Guncel'; }));
      dogru(!l.some(function (x) { return x.olcum_id === O1; }), 'eski olcum silinmeli');
      return D.paketListesi();
    }).then(function (liste) {
      var p = liste.filter(function (x) { return x.paket_id === pid; })[0];
      esit(p.tur, 'solar'); esit(p.cihaz_sayisi, 2); esit(p.olculen, 1); esit(p.ekstra, 1); esit(p.gonderilmemis, 2);
      return D.solarGonderildiIsaretle([{ olcum_id: O2 }], '2026-11-26T12:00:00Z');
    }).then(function () { return D.solarKayitlariGetir(pid); }).then(function (l) {
      esit(l.filter(function (x) { return !!x.gonderildi; }).length, 1);
      return D.paketSil(pid);
    }).then(function () { return Promise.all([D.solarKayitlariGetir(pid), D.paketGetir(pid), D.olcumlerGetir('ESKIPAKET1')]); }).then(function (s) {
      esit(s[0].length, 0, 'paketSil solar kayitlarini da siler'); esit(s[1], null); esit(s[2].length, 1, 'baska paketin olcumu kalir');
    });
  });
})();
