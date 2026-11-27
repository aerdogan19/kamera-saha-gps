# Saha GPS (mobil sayfa)

Sahadaki kişi cep telefonuyla kameraların dibinde GPS konumu alır, sonucu bir dosya olarak
WhatsApp / e-posta ile geri gönderir. Saf HTML + CSS + JS; framework, derleme, sunucu, harici
CDN yoktur. Sayfa hiçbir ağ isteği yapmaz; veriler yalnız telefonun IndexedDB deposunda durur.

Sözleşme (paket / sonuç şeması, kararlar): `docs/SAHA_GPS_PLAN.md`.

## 1. GitHub Pages'e yayınlama

Saha verisi sayfada YOKTUR (paket telefona dosyayla gelir); yine de bu klasör, projenin geri
kalanından (veritabanı, şifreler, WireGuard notları) AYRI ve herkese açık bir depoda yayınlanmalıdır.
Ana projenin deposunu Pages'e AÇMAYIN.

1. GitHub'da yeni bir depo açın (ör. `saha-gps`), görünürlük **Public**.
2. Bu klasörün içeriğini (`index.html`, `style.css`, `mantik.js`, `solar_mantik.js`, `depo.js`, `app.js`, `sw.js`,
   `manifest.webmanifest`, `ikon-192.png`, `ikon-512.png`, `README.md`; `test/` isteğe bağlı)
   yeni deponun KÖKÜNE kopyalayın.
3. Yeni depoda: `git init`, `git add .`, `git commit`, `git remote add origin <adres>`,
   `git push -u origin main` (push'u kullanıcı kendisi yapar).
4. GitHub > Settings > Pages > Source: "Deploy from a branch", Branch: `main`, klasör `/ (root)` > Save.
5. Birkaç dakika sonra adres `https://<kullanici>.github.io/saha-gps/` olur. HTTPS zorunludur;
   telefonlar konumu yalnız HTTPS'te verir.
6. Güncelleme yaparken `mantik.js` içindeki `UYGULAMA_SURUMU` değerini artırın (ör. `1.0.0` > `1.0.1`).
   Service worker (`sw.js`) önbellek adını bu değerden türetir (`saha-gps-<surum>`); sürüm tek yerde
   tutulur. Sürüm değişmezse telefonlar eski önbelleği kullanmaya devam eder. Yeni sürüm yüklenirken
   dosyalar HTTP önbelleği atlanarak (`cache: 'reload'`) alınır. Telefon yeni sürümü bulunca sayfanın
   üstünde "Yeni sürüm var" bandı ve "Yenile" düğmesi çıkar; sayfa kendiliğinden yenilenmez, ölçüm
   sürerken "Yenile" reddedilir.
7. Telefonda adresi açın; isterseniz "Ana ekrana ekle" ile uygulama gibi kullanın. İlk açılıştan
   sonra sayfa çevrimdışı da açılır.

Kullanım: masaüstü uygulamadan "Saha GPS Paketi" dosyasını alın > telefonda "Paket yükle" >
AP'nin yanına gidin > cihazı seçin > "Konumu al" > kaydedin > "Sonucu gönder".

## 2. Sahada elle test kontrol listesi

Her madde için gerçek bir Android Chrome ve bir iPhone Safari ile deneyin.

- [ ] **İzin verme:** İlk "Konumu al"da tarayıcı izin ister; "İzin ver" ile ölçüm başlar.
- [ ] **İzin reddi:** İzni reddedin; Türkçe, anlaşılır hata ve ayar yönlendirmesi görünür; izin
      açılınca "Tekrar dene" çalışır.
- [ ] **Doğruluk renkleri:** Açık alanda ≤ 5 m yeşil; bina dibinde sarı/kırmızı; kırmızıda onay kutusu
      işaretlenmeden "Kaydet" pasif.
- [ ] **İptal:** Ölçüm sırasında "İptal" ölçümü durdurur, kayıt oluşmaz.
- [ ] **Uçak modu:** Uçak modunda (GPS açık) sayfa açılır, paket yüklenir, ölçüm alınır, kaydedilir
      (sayfa ağa ihtiyaç duymaz; ilk açılışta önbelleğe alınmış olmalı).
- [ ] **Sayfayı kapatıp açma:** Birkaç ölçümden sonra sekmeyi kapatın / tarayıcıyı sonlandırın; yeniden
      açınca paket listesi ve "ölçülen/toplam" ilerleme aynen duruyor, ölçen adı hatırlanıyor.
- [ ] **Birden çok paket:** İki farklı paket yükleyin; ölçümler birbirine karışmıyor. Aynı paketi
      yeniden yüklemek ölçümleri silmiyor.
- [ ] **Aynı direk:** "Önceki ölçümü kopyala" önceki cihazın koordinatını getirir; sonuç dosyasında
      `kopya_kaynagi_mac` dolu.
- [ ] **Listede olmayan cihaz:** Not zorunlu; sonuçta `ekstralar` içinde.
- [ ] **Fotoğraf:** Kamera açılır, fotoğraf eklenir, önizleme görünür; sonuç dosyası makul boyutta.
- [ ] **Paylaşım:** "Paylaş" düğmesi (destekleniyorsa) WhatsApp / e-posta ile `.txt` dosyasını açar;
      "Dosyayı indir" HER ZAMAN çalışır. Gönderilmemiş sayısı işlemden sonra düşer.
- [ ] **İndirme ve "gönderildi" onayı:** "Dosyayı indir"e basmak ölçümleri "gönderildi" yapmaz; indirme
      sonrası çıkan "Dosya karşıya ulaştı" düğmesine basılınca işaretlenir. Web Share başarılı olursa
      otomatik işaretlenir.
- [ ] **iOS ana ekran (standalone) modunda indirme:** Ana ekrana eklenmiş uygulamada "Dosyayı indir"
      çalışmayabilir ya da dosya görünmeyebilir. Çalışmazsa "Paylaş" düğmesini kullanın ya da sayfayı
      Safari sekmesinde açıp gönderin (aşağıdaki depolama uyarısına bakın).
- [ ] **Dosyanın masaüstüne ulaşması:** Gelen `.txt` dosyası masaüstü uygulamada "Saha GPS Sonucu" ile
      içe aktarılabiliyor.
- [ ] **Koyu / açık tema:** Telefonun teması değişince sayfa uyumlu; güneşte okunabilir.
- [ ] **Ekran kilidi:** Ölçüm sırasında ekran kapanmıyor (Wake Lock desteklenen tarayıcılarda).

### iOS 7 gün depolama uyarısı

iOS Safari, bir siteyi 7 gün hiç açmazsanız o sitenin yerel verisini (IndexedDB dahil) silebilir.
"Ana ekrana ekle" ile eklenen uygulamalar bundan etkilenmez, ancak Safari sekmesinden ayrı bir
depo kullanır. Bu yüzden:

- Ölçümü bitirince sonucu HEMEN gönderin; telefonda gönderilmemiş ölçüm bırakmayın.
- Uzun süre sahaya gidilmeyecekse sonucu gönderip paketi silin.
- **Safari sekmesi ile "Ana ekrana ekle" uygulaması iOS'ta AYRI depolama kullanır.** Birinde yüklenen
  paket ve ölçümler diğerinde görünmez. Ölçüme başlamadan ÖNCE hangisini kullanacağınıza karar verin,
  paketi o ortamda yükleyin ve tüm ölçümleri aynı ortamda yapıp gönderin. Yarıda değiştirmeyin.
- Ana ekran uygulaması 7 gün kuralından etkilenmez ama indirme sorunu olabilir (yukarıya bakın);
  Safari sekmesi indirmede daha güvenilirdir ama 7 gün kuralına tabidir.
- IndexedDB açılamazsa ilk ekranda uyarı ve "Sayfayı yenile" düğmesi çıkar; bu durumda ölçümler
  kalıcı değildir.

## 3. Solar modu (1.2.0, sözleşme v2)

Ağda olmayan (IP/MAC/şifre yok), GSM (M2M) hattıyla çalışan solar kamera cihazları için. Masaüstünden
"📤 Solar Paketi" dosyasını (paket sürümü 2) "Paket yükle" ile açın; sayfa paketin `tur` alanına göre Solar
ekranlarına geçer. Eski (sürüm 1) solar paketleri reddedilir; masaüstünden yenisini üretin. Sözleşme: `docs/SOLAR_PLAN.md`.
Kod: `solar_mantik.js` (DOM'suz mantık: paket/sonuç v2, IMEI/ICCID, model şablonları), `app.js` (ekranlar).

Akış (kayıt birimi = SOLAR CİHAZ; içinde 4 kamera):

1. **Liste:** her cihaz için satır + "3/4 kamera yönlü" rozeti + konum rozeti; "➕ Yeni solar cihaz".
2. **Cihaz formu:** Kimlik (ad *, bulunduğu konum "Km 2", işin adı, model şablonu, marka, seri no), M2M hat
   (hat no, ICCID, IMEI, operatör, tarife), Bulut (cihaz ID; hesap ve ŞİFRE YOK), Güç/durum (panel, batarya, kurulum
   tarihi, çalışma durumu), Konum (TEK GPS ölçümü), Kameralar (kanal kartları: ad, PTZ, "yön tamam/eksik"),
   cihaz fotoğrafı, not. Model seçimi kanal şablonunu kurar (AV-S446: 4 kanal, 2-4 PTZ; O-Kam, INOX, Diğer: 4 kanal;
   paketin `modeller` listesi öncelikli). Kanal sayısı sabit değildir ("Kanal ekle", en çok 8).
3. **Kanal ekranı** (karta dokunun): ad, bölge, PTZ işareti, yön (hedef nokta / pusula / elle), açıklık hazır
   değerleri + elle, menzil, görüş fotoğrafı, not. PTZ kamerada yön "ana / park yönü" demektir.
4. **Sonucu gönder:** `solar_<saha>_<tarih>.txt`. Dosya hat no / IMEI içerir; yalnız güvenli kanaldan paylaşın.

Her alan değişikliğinde ve her kanal kaydında cihaz kaydı telefona (IndexedDB) yeni bir ölçüm kimliğiyle yazılır;
iOS sekmeyi atsa da taslak kaybolmaz. Paketten gelen cihazlarda M2M/IMEI alanları BOŞ görünür (paket bunları taşımaz);
"Masaüstünde kayıtlı olabilir; boş bırakırsanız değişmez." Boş bırakılan alan sonuçta `null` gider ve masaüstündeki
eski değeri ezmez. IMEI (15 hane) ve ICCID (18-20 hane) için Luhn uyumsuzluğu yalnız UYARIDIR, kaydı engellemez.
Barkod/QR okuma ve cihazdan WiFi ile bilgi okuma yoktur (Faz 2).

Saha kontrol listesi (gerçek Android + iPhone):

- [ ] **Cihaz konumu:** direğin yanında "Cihaz konumunu al"; ±5 m altı yeşil. Tek ölçüm tüm kameralara uygulanır.
- [ ] **Hedef nokta yöntemi (ÖNERİLEN):** cihaz konumu alındıktan sonra kanal ekranında, kameranın baktığı yönde 10-30 m
      ilerideki bir noktaya yürüyüp "Hedef nokta ölç"; yön (gerçek kuzeye göre) ve menzil otomatik dolar.
      3 m'den yakın hedef reddedilir. Cihaz konumu yeniden ölçülürse hedef noktalı kameraların yönü yeniden hesaplanır.
- [ ] **Pusula (tahmini):** telefonu arka yüzü kameranın baktığı yöne bakacak şekilde düz ve sabit tutup
      "Pusula oku". Sonuç "tahmini"dir (metal direk, panel, elektronik yakınında ±10-20° sapar); yönü
      hedef noktayla doğrulayın. Pusula yönü manyetik sapma (+5,5°, pakette gelir) eklenerek gerçek kuzeye çevrilir;
      ham manyetik değer de sonuçta saklanır.
- [ ] **iPhone pusula izni:** "Pusula oku" düğmesine basınca iOS "Hareket ve Yön Erişimi" izni sorar (yalnız
      dokunuşla çıkar). Reddedildiyse: Safari "aA" > Web Sitesi Ayarları > Hareket ve Yön erişimi > İzin ver, sayfayı
      yenileyip tekrar deneyin. Ana ekran uygulamasında da aynı izin geçerlidir.
- [ ] **Android pusula:** Chrome `deviceorientationabsolute` kullanır; veri gelmezse (eski cihaz) yönü elle girin.
- [ ] **Elle yön:** kaydırıcı 0-359° (0 = kuzey, 90 = doğu); "Yönü temizle" ile yön boş bırakılır (masaüstünde sektör çizilmez).
- [ ] **Açıklık:** 2,8 mm ≈ 100°, 4 mm ≈ 85°, 6 mm ≈ 55°, PTZ/bilinmiyor = 360°; elle 1-360 girilebilir.
- [ ] **PTZ kamera:** kanal ekranında PTZ işaretli; başlık "Ana / park yönü (PTZ)" olur.
- [ ] **M2M/IMEI:** hat no, ICCID, IMEI girilir; yanlış Luhn uyarı verir ama kayıt yapılır. Paketten gelen cihazda alanlar boştur.
- [ ] **Fotoğraflar:** cihaz fotoğrafı + her kanal için görüş fotoğrafı (her biri ≤ 400 KB'a küçültülür).
- [ ] **Sayfayı yenileme:** 1.2.0'a geçişte "Yeni sürüm var" bandında "Yenile"ye basın (ölçüm sürerken basmayın).
      Veritabanı sürümü 1 > 2 yükselir; mevcut Saha GPS ölçümleri korunur. Başka sekmede eski sürüm açıksa
      onu kapatın, yoksa yükseltme bloklanır ve sayfa "kalıcı depolama açılamadı" uyarısı verebilir.
- [ ] **Gönderme:** `solar_<saha>_<tarih>.txt` masaüstünde "📥 Solar Sonucu" ile içe aktarılır.

### 1.2.1 notları (Aşama A)

- **Cihaz kimliği = seri no son 5 hane.** Cihaz formunda "Seri no" en üstte; yanında "Kimlik: son 5 hane" alanı
  seri no yazılınca kendiliğinden dolar (yalnız `A-Z0-9`, büyük harf; 5 haneden kısaysa boş). Yalnız 5 hane de
  elle yazılabilir. Listede başlığın yanında `#30516` rozeti çıkar; liste (5'ten fazla cihazda) kimlik/ad/model ile aranabilir.
- **Sonuç sözleşmesi (surum 2, eklemeli):** her kayıtta isteğe bağlı `seri_son5` (`^[A-Z0-9]{5}$`, büyük harf;
  geçersiz/yoksa `null`; seri_no 5+ haneli ise ondan türetilir). `seri_no` tam hâliyle kalır. Paket cihaz başına
  `seri_son5` taşıyabilir; gelirse formda gösterilir ve korunur.
- **Çakışma:** aynı kimlik iki farklı kayıtta girilirse uyarı çıkar (engellemez). Yeni cihaz eklerken aynı kimlikli kayıt
  varsa "Bu cihaz zaten kayıtlı — konumunu güncellemek ister misiniz?" sorulur; onaylanırsa o kaydın `kayit_id`'siyle
  form açılır, böylece masaüstü aynı cihazı günceller.
- **Bulut hesabı alanı kaldırıldı** (form, sonuç, kayıt şeması); eski kayıtlardaki değer sessizce atılır. Bulut cihaz ID kalır.
- **Fotoğraf reddi** artık kısa toast yerine kalıcı kırmızı uyarı kutusu gösterir (Kapat düğmesi; yeni başarılı
  fotoğrafta kapanır). Okunamayan/HEIC için yönlendirici mesaj verir.
- IndexedDB şema sürümü DEĞİŞMEDİ (2): yeni alan yalnız kayıt içeriğidir.

## Geliştirici notları

- `mantik.js` DOM'suzdur; testler `test/test.html` içinde tarayıcıda koşar. Headless Edge ile:
  `msedge --headless=old --disable-gpu --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom file:///.../mobil/saha_gps/test/test.html`
  Başlık `TESTS PASS n/n` olmalıdır.
- Güvenlik: `innerHTML`/`eval`/`fetch`/XHR yoktur; resimler yalnız `data:image/jpeg;base64,...` desenine
  uyarsa atanır; CSP `index.html` içindedir (inline script/style yok).
