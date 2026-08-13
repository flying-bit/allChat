# allChat

Discord'a alternatif, Firebase Realtime Database üzerine kurulu bir sohbet uygulaması. Next.js (App Router) + TypeScript + Tailwind CSS ile yazıldı; sesli sohbet için PeerJS, animasyonlar için anime.js ve motion.dev kullanır.

## Özellikler

- E-posta/şifre ile kayıt & giriş (Firebase Auth)
- Kayıt olan her kullanıcı otomatik olarak "allChat Merkez" başlangıç sunucusuna katılır
- Sunucular, metin kanalları, davet kodlu katılım
- Gerçek zamanlı metin sohbeti, **Ctrl+V ile resim yapıştırma**
- Arkadaş ekleme / istek kabul-red / DM (doğrudan mesaj)
- PeerJS ile **4 kişi limitli** sesli sohbet kanalları (konuşma göstergesi, sustur, ayrıl)
- Açık/koyu tema (palet: `#F5F5DC` `#FBC02D` `#FF8F00` `#C62828`)

## Kurulum

```bash
npm install
```

`.env.local` dosyası zaten Firebase projenizin (`sirri-aras`) client config'iyle dolu geliyor. Farklı bir Firebase projesine bağlamak isterseniz `.env.example` dosyasındaki değişkenleri doldurun.

```bash
npm run dev
```

## Firebase kurulumu (ÖNEMLİ — elle yapılması gerekiyor)

Bu repodaki `database.rules.json` ve `storage.rules` dosyaları, uygulamanın ihtiyaç duyduğu güvenlik kurallarını içerir ama **otomatik olarak Firebase'e deploy edilmedi** — bu makinede Firebase CLI girişi yoktu. Uygulamayı canlıya almadan önce:

1. **Realtime Database kuralları:** [Firebase Console](https://console.firebase.google.com/) → projeniz (`sirri-aras`) → Realtime Database → Rules sekmesine gidin, bu repodaki `database.rules.json` içeriğini yapıştırıp **Publish** deyin. Bu olmadan (varsayılan kapalı kurallarla) hiçbir okuma/yazma çalışmaz; varsayılan açık test-mode kurallarıyla ise herkes birbirinin verisini okuyup yazabilir.
2. **Storage kuralları:** Storage → Rules sekmesine gidin, `storage.rules` içeriğini yapıştırıp Publish deyin. Bu, resim yapıştırma özelliğinin çalışması için gerekli.
3. **Storage'ı etkinleştirme:** Firebase, yeni projelerde Storage kullanımı için **Blaze (pay-as-you-go) plana** geçmeyi zorunlu kılıyor (ücretsiz kotası yine cömert, sadece bir ödeme yöntemi bağlamanız gerekiyor). Proje Spark planındaysa resim yükleme çalışmayana kadar önce planı yükseltin.

Kuralları uygulamadan test ettim; kodun kendisinde `PERMISSION_DENIED` dışında hiçbir hata çıkmadı (bkz. commit geçmişi / test notları) — yani kurallar console'a yapıştırılınca uygulama olduğu gibi çalışmaya devam edecek.

## Vercel'e deploy

```bash
npm i -g vercel   # veya npx vercel
vercel login
vercel
```

Vercel projesine şu environment variable'ları ekleyin (Project Settings → Environment Variables), `.env.local` ile aynı değerler:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

Alternatif olarak GitHub reposunu [vercel.com/new](https://vercel.com/new) üzerinden import edip aynı environment variable'ları orada girebilirsiniz.

## Mimari notlar

- Veri modeli ve yardımcı fonksiyonlar: `src/lib/db.ts`
- Auth context: `src/lib/auth-context.tsx`
- Sesli sohbet (PeerJS mesh, 4 kişi limiti): `src/components/voice/VoiceChannelPanel.tsx`
- Tema sistemi: `src/components/theme/ThemeProvider.tsx`
