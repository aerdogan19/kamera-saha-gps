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
2. Bu klasörün içeriğini (`index.html`, `style.css`, `mantik.js`, `depo.js`, `app.js`, `sw.js`,
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

## Geliştirici notları

- `mantik.js` DOM'suzdur; testler `test/test.html` içinde tarayıcıda koşar. Headless Edge ile:
  `msedge --headless=old --disable-gpu --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom file:///.../mobil/saha_gps/test/test.html`
  Başlık `TESTS PASS n/n` olmalıdır.
- Güvenlik: `innerHTML`/`eval`/`fetch`/XHR yoktur; resimler yalnız `data:image/jpeg;base64,...` desenine
  uyarsa atanır; CSP `index.html` içindedir (inline script/style yok).
