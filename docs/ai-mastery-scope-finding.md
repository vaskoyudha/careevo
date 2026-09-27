# Cakupan API AI Mastery per-peserta

Tanggal: 2026-09-27
PYTHON_API: 127.0.0.1:8011
PATH_ID_YANG_DITES: (tidak ada — store `:8011` kosong, seluruh tabel data 0 baris)
LAYANAN_BISA_PER_PESERTA: true
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
Diverifikasi in-process (tanpa efek samping): root admin `backend/data`, sedangkan
`scope_for_user("peserta-a")` → `backend/data/users/peserta-a` dan `peserta-b` →
`backend/data/users/peserta-b`; masing-masing berakhir pada
`workspace/learning/mastery/mastery.sqlite3` yang berbeda. `auth.py:620-623` menyatakan
memang begitu ("the router already scopes every record to the current account"), dan
`/api/mastery-paths` dipetakan ke surface `"chat"` (`auth.py:623`) yang diizinkan
`learner_grant` (`grants.py:206`). **Dua syarat yang belum terpenuhi di instance ini:**
(1) `backend/data/user/settings/auth.json` berisi `"enabled": false`, sehingga setiap
request diperlakukan sebagai local-admin — itulah sebabnya
`GET /api/mastery-paths/topics` tanpa kredensial tetap menjawab `200 {"topics":[]}`;
(2) tidak ada akun non-admin sama sekali (`backend/data/users/` dan
`backend/data/system/auth/` tidak ada). Konsekuensinya: seluruh peserta yang memakai
akun admin akan **berbagi** satu store yang sama; hanya akun non-admin yang terisolasi.
Yang **tidak** terverifikasi di sini: payload per-learner sungguhan.
`GET /topics/{path_id}` hanya bisa menjawab `404 {"detail":"Mastery topic not found"}`
karena tidak ada `path_id`; jadi kesimpulan scoping bertumpu pada resolusi path di atas
plus config auth, bukan pada pengamatan respons yang benar-benar terisolasi.
AKHIR: Ya, attempt yang dinilai bisa dikaitkan ke satu peserta Careevo — dengan syarat
Careevo memprovisioning satu akun non-admin AI Mastery per peserta dan mengaktifkan
`AUTH_ENABLED`, karena `path_id` sendiri tidak membawa identitas peserta.
