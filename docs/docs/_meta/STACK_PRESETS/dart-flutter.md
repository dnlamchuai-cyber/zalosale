# STACK PRESET: Dart + Flutter 3.x (Mobile)

> D�ng khi d? �n c?n app iOS/Android (ho?c desktop) v?i 1 codebase.

## Khi n�o d�ng
- App mobile l� s?n ph?m ch�nh (v� d? BeShort mobile)
- Team c� Flutter dev ho?c mu?n h?c Dart
- C?n UI mu?t 60fps, g?n native, release nhanh 2 platform

## Stack chi ti?t

| L?p | Ch?n | V� sao |
|-----|------|--------|
| Language | **Dart 3.x (null-safety, records, pattern matching)** | Performance AOT, hot reload |
| Framework | **Flutter 3.x** | 1 code ? iOS/Android/Web/Desktop |
| State | **Riverpod 2.x** (khuy�n) ho?c Bloc | Riverpod compile-safe, test d?; Bloc chu?n enterprise |
| Network | **Dio + Retrofit** ho?c `http` | Dio c� interceptor, retry |
| DB local | **Isar / Hive / drift (sqlite)** | Isar nhanh, drift SQL-like |
| Backend | **Node/TS ho?c Dart Frog / Supabase** | N?u d� c� Node backend th� Flutter ch? g?i REST |
| Test | **flutter_test + mockito + patrol (e2e)** | � |

## Quy tr�nh vibe v?i Flutter

```
Pha 2: Spec Dart (model freezed, api contract)
Pha 3: 1 slice = 1 feature (vd: t?o link ng?n: UI form + g?i API + test widget)
Pha 4: Review (check 60fps, rebuild tr�nh unnecessary)
Pha 5: UI polish (ThemeData, responsive)
```

## L?nh chu?n

```bash
flutter create --org com.beshort app
flutter pub add flutter_riverpod dio freezed_annotation
dart run build_runner build
flutter test
```

## Luu � cho AI

> Flutter AI gen chua t?t b?ng React � lu�n dua `pubspec.yaml` + 1 widget m?u v�o context. M?i prompt ch? 1 widget/screen.

---
*Teams: n?u l�m c? web (React) + mobile (Flutter), d�ng monorepo `apps/web` + `apps/mobile` + `packages/shared-types`.*
