# allChat

Discord'a alternatif, Firebase Realtime Database üzerine kurulu bir sohbet uygulaması. Next.js (App Router) + TypeScript + Tailwind CSS ile yazıldı; sesli sohbet için PeerJS, animasyonlar için anime.js ve motion.dev kullanır. Resim yükleme (Ctrl+V ile yapıştırma, sunucu logosu, profil fotoğrafı) Cloudinary üzerinden, uygulamanın kendi `/api/upload` route'u aracılığıyla yapılır — Firebase Storage kullanılmaz (kart gerektiren Blaze plana ihtiyaç yok).

## Özellikler

- E-posta/şifre ile kayıt & giriş (Firebase Auth)
- Kayıt olan her kullanıcı otomatik olarak "allChat Hub" başlangıç sunucusuna katılır
- Sunucular, kategoriler, metin/sesli kanallar, davet kodlu katılım, sunucu logosu
- Gerçek zamanlı metin sohbeti, **Ctrl+V ile resim yapıştırma** (Cloudinary'ye yüklenir)
- Arkadaş ekleme / istek kabul-red / DM (doğrudan mesaj)
- PeerJS ile **4 kişi limitli** sesli sohbet kanalları (konuşma göstergesi, sustur, ayrıl)
- Üye listesi, sunucu ayarları (isim/logo), kullanıcı ayarları (kullanıcı adı/profil fotoğrafı)
- Açık/koyu tema (palet: `#F5F5DC` `#FBC02D` `#FF8F00` `#C62828`), mobil uyumlu (drawer'lar)

## Kurulum

```bash
npm install
```

`.env.local` dosyası Firebase (`sirri-aras`) ve Cloudinary config'iyle zaten dolu geliyor. Farklı projelere bağlamak isterseniz `.env.example`'daki değişkenleri doldurun.

```bash
npm run dev
```

## Firebase kurulumu (ÖNEMLİ — elle yapılması gerekiyor)

Bu repodaki `database.rules.json`, uygulamanın ihtiyaç duyduğu Realtime Database güvenlik kurallarını içerir ama **otomatik olarak Firebase'e deploy edilmedi** (bu makinede Firebase CLI girişi yok). [Firebase Console](https://console.firebase.google.com/) → projeniz (`sirri-aras`) → Realtime Database → Rules sekmesine gidin, `database.rules.json` içeriğini yapıştırıp **Publish** deyin. Bu olmadan (varsayılan kapalı kurallarla) hiçbir okuma/yazma çalışmaz.

Firebase Storage'a ihtiyaç **yok** — resimler Cloudinary'de saklanıyor.

## Cloudinary kurulumu

`.env.local`'da zaten dolu geliyor (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). Bu üçü **server-only** — `NEXT_PUBLIC_` öneki yok, tarayıcıya asla gönderilmiyor. Yükleme akışı:

1. Kullanıcı bir resim yapıştırır/seçer.
2. Tarayıcı, Firebase ID token'ıyla birlikte dosyayı `src/app/api/upload/route.ts`'e (kendi sunucumuz) POST eder.
3. Route, token'ı doğrular (Firebase'in `accounts:lookup` REST endpoint'i ile — geçersiz/eksik token'da 401 döner), sonra Cloudinary'ye **API secret ile imzalı** yükleme yapar.
4. Dönen `secure_url`, mesaj/sunucu/kullanıcı kaydında `imageUrl`/`iconUrl`/`avatarUrl` olarak Realtime Database'e yazılır — tıpkı önceki Storage akışındaki gibi.

Farklı bir Cloudinary hesabı kullanmak isterseniz [cloudinary.com](https://cloudinary.com) → ücretsiz hesap (kart istemiyor) → Dashboard'daki Cloud Name / API Key / API Secret değerlerini `.env.local`'a yazın.

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
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Son üçü **"Sensitive"** olarak işaretleyin (Vercel'in env var ekranında bir seçenek) — Cloudinary hesabınıza tam erişim veren API secret'i içeriyorlar.

Alternatif olarak GitHub reposunu [vercel.com/new](https://vercel.com/new) üzerinden import edip aynı environment variable'ları orada girebilirsiniz.

## Mimari notlar

- Veri modeli ve yardımcı fonksiyonlar: `src/lib/db.ts`
- Auth context: `src/lib/auth-context.tsx`
- Resim yükleme proxy'si (Cloudinary, secret server-side kalır): `src/app/api/upload/route.ts`
- Sesli sohbet (PeerJS mesh, 4 kişi limiti): `src/components/voice/VoiceChannelPanel.tsx`
- Tema sistemi: `src/components/theme/ThemeProvider.tsx`

## Bilinen veri notu

Firebase projenizde daha önce (Storage aktifleşmeden önceki test sürecinde) oluşmuş "genesis" başlangıç sunucusunun ismi/kanal isimleri hâlâ Türkçe olabilir (`allChat Merkez`, `genel`, `Sesli Sohbet`) — bunlar kod değil, veritabanında saklı veri olduğu için kod güncellemeleri onları otomatik değiştirmez. Firebase Console → Realtime Database → Data sekmesinden `servers/genesis/name`, `serverChannels/genesis/genel/name`, `serverChannels/genesis/sesli-sohbet/name` alanlarını elle düzenleyebilirsiniz.
