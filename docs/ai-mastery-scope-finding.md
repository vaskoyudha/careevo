# Cakupan API AI Mastery per-peserta

Tanggal: 2026-09-27
PYTHON_API: 127.0.0.1:8011
PATH_ID_YANG_DITES: (tidak ada — store `:8011` kosong, seluruh tabel data 0 baris)
LAYANAN_BISA_PER_PESERTA: true
VERDICT_BERSYARAT: bentuk bersyaratnya ada di §6
`docs/superpowers/specs/2026-09-27-badge-jalur-penguasaan-design.md`, dan **itu yang
otoritatif**. Baris `LAYANAN_BISA_PER_PESERTA` di atas sengaja dibiarkan polos karena
template brief mengharuskannya; prasyarat, status prasyarat, dan bukti "tidak terisolasi
hari ini" hanya ada di §6.
BUKTI: Scoping per-peserta **ada mekanismenya**, tetapi hanya aktif bila `AUTH_ENABLED=true`.
`main.py:614-619` memasang router `mastery_path` dengan `dependencies=_auth`, dan
`_auth = [Depends(require_learning_surface)]` (`main.py:590`) yang bergantung pada
`require_auth` (`auth.py:640`). `require_auth` memanggil `_install_current_user` →
`set_current_user(...)` pada sebuah ContextVar (`auth.py:416`, `446-468`), sehingga
`list_topics()` yang tanpa parameter (`mastery_path.py:439-448`) dan tetap membentuk
`LearningStore()` mewarisi identitas itu lewat
`LearningStore.__init__` (`storage.py:353-361`) → `get_path_service()` →
`get_current_path_service()` → `get_account_path_service()` (`paths.py:153-161`), yang
mengembalikan root **per-akun**: `data/users/<uid>` untuk non-admin, `data/` untuk admin.
Diverifikasi in-process: root admin `backend/data`, sedangkan
`scope_for_user("peserta-a")` → `backend/data/users/peserta-a` dan `peserta-b` →
`backend/data/users/peserta-b`; masing-masing berakhir pada
`workspace/learning/mastery/mastery.sqlite3` yang berbeda (lihat `CATATAN_EFEK_SAMPING`
untuk batas klaim "tanpa efek samping"). Rantai yang sama punya regression test:
`backend/tests/api/test_auth_contextvar.py:161`
(`test_path_service_resolves_per_user_workspace_through_dependency`) memverifikasi
dependency → ContextVar → root `data/users/<uid>/` dan bukan fallback admin, dan `:29`
(`test_require_auth_is_async_def`) mengunci syarat `async def` yang pernah rusak di #481.
Presisi: test itu menjalankan rantai itu lewat `get_chat_history_db()`, bukan store
mastery, dan tidak menyentuh mastery sama sekali — jadi ia mengunci *rantai*-nya, bukan
mastery secara spesifik. `auth.py:620-623` menyatakan memang begitu ("the router already
scopes every record to the current account"), dan `/api/mastery-paths` dipetakan ke
surface `"chat"` (`auth.py:623`) yang diizinkan `learner_grant` (`grants.py:206`).
**Dua syarat yang belum terpenuhi di instance ini:** (1)
`backend/data/user/settings/auth.json` berisi `"enabled": false`, sehingga setiap request
diperlakukan sebagai local-admin — itulah sebabnya `GET /api/mastery-paths/topics` tanpa
kredensial tetap menjawab `200 {"topics":[]}`; (2) tidak ada akun non-admin sama sekali
(`backend/data/users/` dan `backend/data/system/auth/` tidak ada). Konsekuensinya:
seluruh peserta yang memakai `/ai-mastery` saat ini **diarahkan secara implisit** ke akun
admin — bukan karena memilihnya — dan karena itu **berbagi** satu store yang sama; hanya
akun non-admin yang terisolasi. Yang **tidak** terverifikasi di sini: payload per-learner
sungguhan. `GET /topics/{path_id}` hanya bisa menjawab
`404 {"detail":"Mastery topic not found"}` karena tidak ada `path_id`; jadi kesimpulan
scoping bertumpu pada resolusi path di atas, plus config auth dan regression test yang
disebutkan, bukan pada pengamatan respons yang benar-benar terisolasi.
AKHIR: Ya, attempt yang dinilai bisa dikaitkan ke satu peserta Careevo — dengan syarat
Careevo memprovisioning satu akun non-admin AI Mastery per peserta dan mengaktifkan
`AUTH_ENABLED`, karena `path_id` sendiri tidak membawa identitas peserta.

---

## CATATAN_AHAMI — garansi isolasi adalah KONVENSI, bukan jaminan struktural

Ini caveat yang paling menentukan untuk pertanyaan "bolehkah plan mendatang
mengandalkan isolasi per-peserta?", dan tidak terlihat dari `AKHIR` di atas.

`auth.py:411-413` menyatakan invariant itu sendiri: *"⚠ Invariant: every authenticated
entry point MUST call this before the handler runs. Skipping it leaves
`get_current_path_service()` falling back to the admin workspace — the silent-routing
root cause of #481."* `auth.py:438-444` menjelaskan `require_auth` sengaja `async def`
supaya `set_current_user` tetap berada di request context yang sama; dependency `sync`
dieksekusi lewat `anyio.to_thread.run_sync` di worker thread dengan *copy* context, sehingga
`ContextVar.set`-nya dibuang saat thread selesai — persis #481. Tidak ada apa pun yang
menegakkan invariant ini selain komentar dan test; router itu sendiri punya entry point
kedua yang memasang identitas sendiri: WebSocket `/ws/mastery-paths`
(`mastery_path.py:771-772`) memanggil `ws_require_auth(ws)` di `:779` dan
`reset_current_user` di blok `finally`-nya (`:883`), bukan lewat `dependencies=_auth`.

**Kalau invariant itu pecah, semua request jatuh ke root admin — dan gejalanya tidak dapat
dibedakan dari kondisi sekarang.** `AUTH_ENABLED=false`, `AUTH_ENABLED=true` tanpa akun
non-admin, dan ContextVar yang bocor semuanya menghasilkan hal yang sama: satu store,
semua peserta di dalamnya. Jadi "aktif" dan "aman" adalah dua klaim terpisah. Dokumen ini
mendukung yang pertama, dan hanya setelah prasyaratnya terpenuhi; tidak ada bukti di sini
yang mendukung yang kedua.

## CATATAN_EFEK_SAMPING — klaim "tanpa efek samping" itu lokal, bukan struktural

`scope_for_user()` memanggil `migrate_legacy_multi_user_tree()`
(`multi_user/paths.py:105`), yang menjalankan `shutil.move` (`multi_user/paths.py:75`)
jika `backend/multi-user/` ada. Di mesin ini folder itu tidak ada, jadi fungsi tersebut
kembali lebih awal dan tidak ada yang dipindahkan atau ditulis — tetapi itu **properti
filesystem ini, bukan properti fungsinya**. Di checkout yang punya `backend/multi-user/`,
pemanggilan yang sama akan memindahkan direktori. Sebelum mengulangi pemeriksaan in-process,
periksa `ls -d backend/multi-user` lebih dulu.

## CATATAN_PENERUS — untuk plan mendatang, bukan temuan Task 0

Kalau plan berikutnya memprovisioning akun ber-preset `learner` untuk `/ai-mastery`, maka
`apply_learning_policy` (`learning_access.py:34-60`) adalah tempat gesekannya: fungsi itu
mengosongkan `tools` dan `knowledge_bases` serta memaksa `enable_rag: False` dan
`enable_web_search: False` untuk akun belajar. Klaim Task 0 yang sempit tetap benar dan
tidak berubah — surface `"chat"` **tidak** kena 403 — tetapi itu hanya menyatakan surface
itu *diizinkan*, bukan bahwa akunnya tidak dibatasi.
