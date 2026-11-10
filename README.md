# Uniturk Workspace · CRM / Efor Takip / Case Management

**Render üzerinde yayınlanmaya hazır, HTML + CSS + JavaScript arayüzü ve Node.js API / PostgreSQL veritabanı ile çalışan ortak iş takip sistemi.** `.bat`, Python, PHP veya elle SQL kurma zorunluluğu yoktur.

## 1. Kullanıcı hesapları (istenen ilk sürüm)

| Giriş tipi | Kullanıcı adı | Şifre | Ekranlar |
|---|---|---|---|
| Teknik (Salih Akkaya) | `teknik` | `Aa12345678` | Salih efor formu, geçmiş Salih kayıtları, Case Management |
| Teknik (Enes Yılmaz) | `teknik` | `Aa12345678` | Enes efor formu, geçmiş Enes kayıtları, Case Management |
| Aleyna / Yönetim | `detay` | `detay` | Yönetim Paneli, Aleyna efor defteri, Bekleyen İşler, Fırsatlar, Toplam İşler, Listeler, Case Management |

**Teknik girişte personel seçimi gereklidir.** İki çalışan aynı kullanıcı adı ve şifreyi kullandığından birbirlerinin adını seçerek giriş yapabilir. Dolayısıyla bu ilk sürümde *Salih ile Enes arasında kimlik doğrulamaya dayalı kesin ayrım yoktur*; bunu sağlamak için kişi başı ayrı şifreye geçilmesi gerekir. Oturuma bağlanan personelin efor kayıtları API'de ayrı filtrelenir. Teknik oturumlar detay/management API verilerini alamaz.

> **Güvenlik:** Bu kimlik bilgileri talebiniz üzerine başlangıç değeri olarak tanımlanmıştır. Özellikle `detay / detay` şifresi internete açık gerçek kullanım için çok zayıftır. Yayınlamadan önce Render > Service > Environment bölümünden `TECH_PASSWORD` ve `DETAIL_PASSWORD` değişkenlerini güvenli değerlere değiştirmeniz ve ekipçe ayrı kimlik doğrulama kullanmanız önerilir. Kullanıcı adlarını `TECH_USERNAME`, `DETAIL_USERNAME` ile güncelleyebilirsiniz. Şifreler HTML/JS dosyalarına gömülü değildir; sunucuda kontrol edilir.

## 2. Render'a yayınlama (önerilen yöntem)

1. ZIP dosyasını bilgisayarınızda açın. **`Uniturk_CRM_Render` klasörünün içindeki** `server.js`, `render.yaml`, `package.json`, `public/` ve `src/` dosyalarını yeni bir GitHub deposunun **köküne** yükleyin. ZIP'i tek parça olarak GitHub'a koymayın, açılmış dosyalarını yükleyin.
2. <https://dashboard.render.com> adresinde **New → Blueprint** yoluna gidin. GitHub deponuzu bağlayıp `render.yaml` dosyasını seçin.
3. Render iki kaynak oluşturur: `uniturk-crm` **Node Web Service** ve `uniturk-crm-db` **PostgreSQL**. PostgreSQL bağlantısı otomatik olarak `DATABASE_URL` üzerinden ayarlanır.
4. Deploy tamamlandığında Render'ın sağladığı `https://uniturk-crm-....onrender.com` adresini açın. İlk oturum açılışıyla eforlar ve caseler ortak veritabanına yazılır. Girişte yukarıdaki kullanıcı adları ve şifreler geçerlidir.
5. Güvenlik için en azından `DETAIL_PASSWORD` değişkenini hemen değiştirin. Farklı bir değer girerseniz girişte yeni şifre kullanılır; eski şifre çalışmaz.

### Render ücretsiz plan hakkında önemli uyarı

`render.yaml` **test/demo amaçlı** ücretsiz Web Service ve ücretsiz PostgreSQL ayarına sahiptir. **Render'ın ücretsiz PostgreSQL veritabanı 30 gün sonra sona erer** ve daha sonra silinebilir. Ücretsiz Web Service uykuya geçer; sonraki istekte tekrar açılır. Kalıcı şirket verisi için veritabanını zamanında ücretli Postgres planına yükseltin veya süre sınırı olmayan bir PostgreSQL hizmetine bağlayın. **Render Web Service dosya alanı kalıcı değildir**; bu nedenle SQLite dosyası Render üzerinde kullanılmaz. Yönetim panelindeki **Yedek Al (JSON)** özelliğiyle düzenli veri kopyası alın. Bu JSON dosyası gelecekte aktarım için saklanır; otomatik içeri aktarma bu sürümde yoktur.

Resmî bilgiler: <https://render.com/docs/free> ve <https://render.com/docs/blueprint-spec>

## 3. Yerel deneme (isteğe bağlı)

Node.js **22+** kuruluysa proje klasöründe yalnızca `npm start` komutunu çalıştırın; <http://localhost:3000> adresine gidin. PostgreSQL bağlantısı olmadan yerelde Node.js 22'nin yerleşik SQLite desteği kullanılır, kayıtlar `.data/uniturk.sqlite` dosyasında tutulur. Bu **yalnızca yerel deneme** içindir. Render'da `DATABASE_URL` zorunludur. Başlatma `.bat` dosyası yoktur.

## 4. Efor ve CRM ekranları

- **Personel Efor Defteri:** Excel'in Tarih, Müşteri, Proje / İş Paketi, Çalışma Türü, Süre (Saat), Durum, Çalışma Şekli, Yapılan Çalışma / Not sütunları; ekleme, düzenleme, silme, arama ve CSV dışa aktarma.
- **Yönetim Paneli:** Toplam saat / kayıt / açık case / açık fırsat, personel ve müşteri bazında dağılım, son çalışmalar ve yedek alma.
- **Aleyna Efor Defteri:** Detay girişindeki Aleyna'ya ait günlük efor girişi ve geçmiş kayıtları.
- **Bekleyen İşler:** Görev adı, müşteri, ilgili kişi, termin tarihi, durum ve notlar; ekleme/düzenleme/silme.
- **Takip Edilen Fırsatlar:** Müşteri, fırsat, aşama, tahmini efor, takip tarihi ve sonraki aksiyon; 5 sütunlu CRM kanbanı.
- **Toplam İşler:** Üç personelin tüm efor kayıtları ve personel filtresi.
- **Listeler / DB:** Müşteriler, projeler, çalışma türleri, durumlar ve çalışma şekilleri için ekleme/düzenleme/silme. Müşteriyi “Özel” işaretleme seçeneği; teknik personele listelenmez.
- **Case Management (herkes için ortak):** Case Adı, İlgilenen, Case Açılış Tarihi, Durum; Tamamlandı durumunda **zorunlu Case Kapanış Tarihi**. Açık/İşlemde/Beklemede caseleri Aktif sekmesinde; Tamamlananları ayrı sekmede. Düzenleme, yeniden açma, arama ve silme.

### Excel başlangıç verisi

`Efor Takip Çizelgesi.xlsx` dosyasından Salih, Aleyna ve Enes'in 01.11.2026 tarihli **3 adet 5 saatlik = 15 saat** efor kaydı ve beş kategoride açılır liste tanımları alınmıştır. İlk açılışta **yalnızca bir defa** aktarılır; uygulama yeniden başladığında mevcut veriler korunur. Eski çevrimdışı HTML sürümünde sonradan girilmiş kayıtlar otomatik taşınmaz.

## 5. Dosyalar

```text
Uniturk_CRM_Render/
├── public/
│   ├── index.html       # Tarayıcı arayüzü
│   ├── style.css        # Responsive CRM tasarımı
│   ├── app.js           # Personel/Detay sayfaları, formlar
│   └── favicon.svg
├── src/
│   ├── db.js            # PostgreSQL / yerel SQLite, tablo kurma
│   └── seed.js          # Excel başlangıç veri seti
├── tests/
│   └── api.test.js      # Oturum, erişim, kayıt, case kapanış testleri
├── server.js            # HTTP API, güvenli oturumlar ve yetkilendirme
├── package.json
├── render.yaml          # Render Blueprint
├── .node-version
├── .gitignore
└── README.md
```

## 6. Kontroller ve teknik notlar

- `npm test`: Oturum açma, yanlış parola, Salih/Enes kayıt filtresi, teknik kullanıcının yönetim API'sinden 403 alması, kayıt sahipliği, Case açma / kapanış tarihi zorunluluğu / tekrar açma, gizli müşteri seçeneği ve fırsat/görev işlemlerini test eder.
- API oturumları sunucu/veritabanı üzerinde tutulur; tarayıcıya **HttpOnly + SameSite=Lax** oturum çerezi gider. HTTPS üzerinden Secure özelliği kullanılır. Talep gövdesi boyutu sınırlandırılır, girdi alanları doğrulanır.
- Çalışan kişilerin tüm efor bilgilerine yalnızca detay oturumu erişebilir. Case kayıtları bütün girişler arasında ortaktır.
- Bu sürüm demo/ilk saha kullanımı içindir. Paylaşılan zayıf şifrelerle ve ücretsiz 30 günlük DB ile kritik kurum verisi kullanmayın. Gerçek kurumsal dağıtımda kişi bazlı hesaplar, güçlü şifreler, parola değiştirme/MFA, yedekleme politikası ve erişim günlüğü eklenmelidir.
