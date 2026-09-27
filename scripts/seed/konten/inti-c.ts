/**
 * Seed konten untuk kursus inti Careevo bagian C (`crs-6`…`crs-8`):
 *
 *   - `crs-6` Game Development 2D dengan Godot Engine (dasar, game-dev)
 *   - `crs-7` Automated Testing: Vitest & Playwright E2E (menengah, web-dev)
 *   - `crs-8` Implementasi Arsitektur HMAC Attestation & Zero-Knowledge (lanjut, cyber-sec)
 *
 * Setiap modul membawa dua halaman prosa berformat dan satu kuis yang dinilai
 * server. Tidak ada satu pun blok kode di sini yang bisa dijalankan: runner
 * platform ini mengompilasi C++, sedangkan contoh di kursus ini berbahasa
 * GDScript, TypeScript, dan YAML. Semua blok kode ditulis sebagai bahan baca
 * (`dapatDijalankan: false`).
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_INTI_C: KursusSeed[] = [
  // =========================================================================
  // crs-6 — Game Development 2D dengan Godot Engine
  // =========================================================================
  {
    slug: "game-development-2d-dengan-godot-engine",
    judul: "Game Development 2D dengan Godot Engine",
    deskripsi:
      "Membangun mekanika gameplay 2D, sistem fisika, tilemaps, state machine karakter, dan audio menggunakan open-source Godot Engine 4.",
    tags: ["Godot", "GDScript", "GameDev", "2D"],
    level: "dasar",
    track: "game-dev",
    modul: [
      {
        judul: "Mengenal Godot 4, Node, dan Scene",
        ringkasan:
          "Filosofi scene tree, jenis node 2D yang paling sering dipakai, dan cara GDScript menempel pada node lewat callback siklus hidup.",
        durasi_min: 55,
        halaman: [
          {
            judul: "Segala sesuatu adalah node",
            blok: [
              h2("Scene tree, bukan hierarki kelas"),
              p(
                "Di Godot 4, setiap objek dalam permainan adalah sebuah **Node**. Node disusun menjadi pohon (scene tree) di dalam sebuah **Scene**. Alih-alih mewarisi kelas yang dalam, kamu menyusun perilaku dengan menggabungkan node-node kecil yang masing-masing mengurus satu hal.",
              ),
              p("Node 2D yang paling sering kamu pakai:"),
              li(
                "`Node2D` — titik acuan dengan posisi, rotasi, dan skala; tidak menggambar apa pun.",
                "`Sprite2D` — menggambar tekstur pada posisi node.",
                "`CharacterBody2D` — bodi yang kamu gerakkan sendiri dan bertabrakan dengan dunia.",
                "`CollisionShape2D` — anak yang memberi bentuk tabrakan pada node induk.",
                "`Camera2D` — menentukan bagian dunia yang terlihat di layar.",
              ),
              q(
                "Aturan praktisnya: satu node mengurus satu tanggung jawab. Komposisi node menggantikan pewarisan yang dalam.",
              ),
              h3("Scene adalah blueprint yang bisa dipakai ulang"),
              p(
                "Sebuah Scene disimpan sebagai berkas `.tscn` dan bisa di-instansiasi berkali-kali. Scene pemain yang sama dapat muncul sepuluh kali di level berbeda tanpa salinan kode. Perubahan pada scene sumber langsung berlaku ke semua instansinya.",
              ),
              li(
                "Scene akar level menampung pemain, tilemap, dan kamera.",
                "Scene terpisah untuk pemain, musuh, dan item membuatnya bisa diuji sendiri.",
                "Node yang sama tidak boleh punya dua induk — menginstansiasi berarti membuat salinan baru.",
              ),
            ],
          },
          {
            judul: "GDScript dan siklus hidup node",
            blok: [
              h2("Skrip menempel pada node"),
              p(
                "GDScript adalah bahasa resmi Godot dengan sintaksis mirip Python: indentasi menentukan blok, tipe bersifat opsional, dan tidak ada titik koma. Sebuah skrip dijalankan sebagai perilaku node tempat ia dipasang.",
              ),
              kode({
                kode: `# Pemain.gd — dipasang pada node CharacterBody2D bernama Pemain
extends CharacterBody2D

# @export memunculkan properti ini di Inspector editor.
@export var kecepatan: float = 200.0

# @onready menunda pengambilan node anak sampai scene selesai dibangun.
@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
    # Dipanggil sekali setelah node dan semua anaknya masuk ke scene tree.
    print("Pemain siap")

func _process(delta: float) -> void:
    # delta = waktu sejak frame sebelumnya, dalam detik.
    # Dipakai untuk hal visual; laju tidak dijamin konstan.
    sprite.rotation += delta

func _physics_process(delta: float) -> void:
    # Dipanggil pada langkah fisika tetap (bawaan 60 kali per detik).
    # Semua gerakan yang bertabrakan harus terjadi di sini.
    pass`,
                dapatDijalankan: false,
              }),
              p(
                "Kode di atas adalah GDScript, bukan C++. Blok ini hanya untuk dibaca; tombol Jalankan tidak tersedia karena runner platform ini mengompilasi C++.",
              ),
              h3("Callback yang wajib kamu kenal"),
              li(
                "`_ready()` — sekali, setelah node masuk ke scene tree.",
                "`_process(delta)` — tiap frame, untuk hal visual; laju tidak tetap.",
                "`_physics_process(delta)` — tiap langkah fisika tetap, untuk gerakan dan tabrakan.",
                "`_input(event)` — saat ada input perangkat yang belum ditangani UI.",
              ),
              q(
                "Selalu letakkan gerakan yang bertabrakan di `_physics_process`, bukan `_process`. Kalau tidak, kecepatan akan berbeda di setiap perangkat.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Godot 4, Node, dan Scene",
          deskripsi: "Memastikan kamu memahami scene tree dan siklus hidup node.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa nama berkas penyimpanan sebuah Scene di Godot 4?",
              pilihan: [".scene", ".tscn", ".gds", ".godot"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Callback mana yang dipanggil pada langkah fisika dengan laju tetap?",
              pilihan: ["_process(delta)", "_ready()", "_physics_process(delta)", "_input(event)"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Apa fungsi anotasi `@onready` pada sebuah variabel?",
              pilihan: [
                "Menjalankan fungsi segera setelah skrip dimuat",
                "Menunda pengambilan node anak sampai scene selesai dibangun",
                "Membuat variabel terlihat di Inspector",
                "Menandai variabel sebagai konstan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Node mana yang memberi bentuk tabrakan pada node induknya?",
              pilihan: ["Sprite2D", "CollisionShape2D", "Camera2D", "Node2D"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Fisika 2D dan Karakter yang Bisa Dikendalikan",
        ringkasan:
          "Menggerakkan `CharacterBody2D` dengan gravitasi dan input, serta memakai collision layer, mask, dan sinyal untuk interaksi.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Velocity dan move_and_slide",
            blok: [
              h2("Bodi yang kamu gerakkan sendiri"),
              p(
                "`CharacterBody2D` tidak digerakkan oleh mesin fisika seperti `RigidBody2D`. Kamu yang menghitung `velocity` (dalam piksel per detik), lalu memanggil `move_and_slide()`. Fungsi itu memindahkan bodi, menghentikannya di dinding, dan memantulkannya di lantai sesuai properti `up_direction`.",
              ),
              kode({
                kode: `extends CharacterBody2D

const KECEPATAN := 220.0
const GRAVITASI := 980.0
const LOMPATAN := -380.0

func _physics_process(delta: float) -> void:
    # Tambahkan gravitasi ke kecepatan vertikal.
    if not is_on_floor():
        velocity.y += GRAVITASI * delta

    # Input.get_axis mengembalikan -1, 0, atau 1 dari dua aksi.
    var arah := Input.get_axis("gerak_kiri", "gerak_kanan")
    velocity.x = arah * KECEPATAN

    # Hanya boleh melompat saat menyentuh lantai.
    if Input.is_action_just_pressed("lompat") and is_on_floor():
        velocity.y = LOMPATAN

    # Pindahkan bodi dan selesaikan tabrakan; velocity diperbarui otomatis.
    move_and_slide()`,
                dapatDijalankan: false,
              }),
              li(
                "`is_on_floor()` benar hanya setelah `move_and_slide()` mendeteksi lantai di bawah.",
                "`delta` mengalikan gravitasi agar laju jatuh tidak bergantung pada frame rate.",
                "Gunakan `Input.get_axis` untuk sumbu dan `Input.is_action_just_pressed` untuk aksi sekali tekan.",
              ),
              q(
                "Jangan set `position` langsung pada `CharacterBody2D`; ubah `velocity` lalu serahkan pemindahan ke `move_and_slide()`.",
              ),
            ],
          },
          {
            judul: "Tabrakan, layer, dan sinyal",
            blok: [
              h2("Layer dan mask adalah bitmask"),
              p(
                "Setiap bodi punya **collision layer** (di mana ia berada) dan **collision mask** (apa yang ia deteksi). Keduanya bilangan bulat yang bitnya bisa dinyalakan satu per satu di Inspector. Dua bodi bertabrakan hanya bila bit layer salah satu cocok dengan bit mask yang lain.",
              ),
              li(
                "Pemain: layer 1, mask 1 (dunia) dan 2 (musuh).",
                "Musuh: layer 2, mask 1 dan 2.",
                "Item: layer 3, mask 1 saja — tidak perlu tahu soal musuh.",
              ),
              h2("Sinyal untuk event yang terputus"),
              p(
                "Sinyal memungkinkan node memberi tahu node lain tanpa saling menyimpan referensi. Contoh klasik: `Area2D` mengirim `body_entered` saat pemain memasuki zona pemicu.",
              ),
              kode({
                kode: `# Koin.gd — dipasang pada Area2D
extends Area2D

signal diambil(nilai: int)

@export var nilai: int = 10

func _ready() -> void:
    # Sambungkan sinyal Area2D ke fungsi lokal.
    body_entered.connect(_saat_pemain_masuk)

func _saat_pemain_masuk(bodi: Node2D) -> void:
    if bodi.is_in_group("pemain"):
        diambil.emit(nilai)   # beri tahu pendengar
        queue_free()          # hapus node di akhir frame`,
                dapatDijalankan: false,
              }),
              q(
                "`queue_free()` menunda penghapusan sampai akhir frame — aman dipanggil dari dalam callback fisika.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Fisika 2D dan Karakter",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Fungsi apa yang memindahkan `CharacterBody2D` sekaligus menyelesaikan tabrakan?",
              pilihan: ["apply_impulse()", "move_and_slide()", "set_position()", "integrate_forces()"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa gravitasi dikalikan `delta`?",
              pilihan: [
                "Agar warnanya berubah",
                "Agar laju jatuh tidak bergantung pada frame rate",
                "Karena Godot mewajibkannya",
                "Agar bodi tidak menembus dinding",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Agar dua bodi saling mendeteksi tabrakan, apa yang harus cocok?",
              pilihan: [
                "Nama node keduanya",
                "Layer salah satu dengan mask yang lain",
                "Warna masing-masing node",
                "Urutan node dalam scene tree",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan `is_on_floor()` mulai bernilai benar?",
              pilihan: [
                "Sebelum `move_and_slide()` dipanggil pertama kali",
                "Setelah `move_and_slide()` mendeteksi lantai di bawah bodi",
                "Saat node baru masuk scene tree",
                "Hanya saat tombol lompat ditekan",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "TileMap, Level, dan Kamera",
        ringkasan:
          "Menyusun level 2D dari tileset, memberi tabrakan pada tile, dan mengatur kamera yang mengikuti pemain dengan batas dunia.",
        durasi_min: 60,
        halaman: [
          {
            judul: "TileSet dan TileMapLayer",
            blok: [
              h2("Dari tekstur atlas ke grid"),
              p(
                "Level 2D biasanya dibangun dari **TileMapLayer** (node yang menggantikan `TileMap` sejak Godot 4.3). Sumber gambarnya adalah **TileSet** yang memotong satu atlas tekstur menjadi banyak tile berdasarkan ukuran grid — misalnya 16×16 atau 32×32 piksel.",
              ),
              li(
                "TileSet mendefinisikan ukuran tile dan sumber atlas.",
                "Tiap tile bisa punya bentuk tabrakan sendiri (kotak penuh, hanya tepi atas, dan sebagainya).",
                "TileMapLayer menyimpan data grid; beberapa layer ditumpuk untuk latar, terrain, dan dekorasi.",
              ),
              h3("Menaruh tile dari skrip"),
              p(
                "Untuk level yang dihasilkan secara prosedural, kamu bisa menulis tile lewat kode. Koordinat memakai satuan sel grid, bukan piksel.",
              ),
              kode({
                kode: `extends TileMapLayer

const SUMBER_LANTAI := 0
const TILE_LANTAI := Vector2i(3, 1)

func _ready() -> void:
    for x in range(20):
        # set_cell(posisi_sel, sumber_id, koordinat_atlas)
        set_cell(Vector2i(x, 10), SUMBER_LANTAI, TILE_LANTAI)`,
                dapatDijalankan: false,
              }),
              q(
                "Tabrakan berasal dari TileSet, bukan dari kode. Tile tanpa bentuk tabrakan tidak akan menghentikan pemain.",
              ),
            ],
          },
          {
            judul: "Kamera yang mengikuti pemain",
            blok: [
              h2("Camera2D dan batas dunia"),
              p(
                "`Camera2D` menentukan bagian dunia yang terlihat. Tempelkan sebagai anak pemain agar otomatis mengikuti, lalu nyalakan **position smoothing** supaya gerakan kamera tidak kaku.",
              ),
              li(
                "`limit_left`, `limit_right`, `limit_top`, `limit_bottom` mencegah kamera memperlihatkan area di luar level.",
                "`position_smoothing_enabled` dan `position_smoothing_speed` menghaluskan gerakan.",
                "`drag_horizontal_enabled` membuat kamera sedikit tertinggal sebelum menyusul — berguna untuk memperlihatkan arah gerak.",
              ),
              h3("Satu kamera aktif pada satu waktu"),
              p(
                "Bila beberapa `Camera2D` aktif bersamaan, Godot hanya memakai yang paling akhir di scene tree. Gunakan `make_current()` untuk memilih kamera secara eksplisit saat berpindah ruangan.",
              ),
              kode({
                kode: `# KameraRuangan.gd
extends Camera2D

func _ready() -> void:
    position_smoothing_enabled = true
    position_smoothing_speed = 5.0
    limit_left = 0
    limit_top = 0
    limit_right = 1280
    limit_bottom = 720
    make_current()`,
                dapatDijalankan: false,
              }),
              q(
                "Kamera yang mengikuti pemain tanpa batas akan memperlihatkan tepi level — selalu pasang limit.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: TileMap, Level, dan Kamera",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Node apa yang menggantikan `TileMap` sejak Godot 4.3?",
              pilihan: ["GridMap", "TileMapLayer", "TileSet", "Sprite2D"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Dari mana bentuk tabrakan sebuah tile berasal?",
              pilihan: [
                "Dari skrip pemain",
                "Dari definisi tile di dalam TileSet",
                "Dari ukuran jendela",
                "Dari properti Camera2D",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Properti apa yang mencegah kamera memperlihatkan area di luar level?",
              pilihan: [
                "position_smoothing_speed",
                "limit_left/limit_right/limit_top/limit_bottom",
                "zoom",
                "offset",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Pada `set_cell`, satuan koordinat yang dipakai adalah…",
              pilihan: ["Piksel", "Sel grid", "Radian", "Persen"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "State Machine Karakter dan Audio",
        ringkasan:
          "Merapikan perilaku karakter dengan state machine berbasis enum dan `match`, lalu menambah suara dan animasi.",
        durasi_min: 60,
        halaman: [
          {
            judul: "State machine dengan enum dan match",
            blok: [
              h2("Mengapa perlu state machine"),
              p(
                "Begitu karakter punya diam, jalan, lompat, dan jatuh, rangkaian `if` bersarang menjadi sulit dibaca. **State machine** memusatkan satu aturan sederhana: karakter berada tepat di satu state, dan hanya transisi tertentu yang diizinkan.",
              ),
              kode({
                kode: `extends CharacterBody2D

enum State { DIAM, JALAN, LOMPAT, JATUH }

var state: State = State.DIAM

func _physics_process(delta: float) -> void:
    match state:
        State.DIAM:
            _transisi_dari_diam()
        State.JALAN:
            _gerak_horizontal(delta)
        State.LOMPAT, State.JATUH:
            _gerak_di_udara(delta)

func _transisi_dari_diam() -> void:
    if Input.is_action_just_pressed("lompat"):
        velocity.y = -380.0
        state = State.LOMPAT
    elif Input.get_axis("gerak_kiri", "gerak_kanan") != 0.0:
        state = State.JALAN`,
                dapatDijalankan: false,
              }),
              li(
                "`match` membandingkan nilai dan mendukung beberapa pola dalam satu cabang.",
                "Satu state aktif mencegah aturan saling bertabrakan.",
                "Transisi sebaiknya hanya mengubah `state`, bukan langsung memindahkan bodi.",
              ),
              q("Kalau sebuah perilaku hanya boleh terjadi di satu kondisi, jadikan ia state, bukan `if` tambahan."),
            ],
          },
          {
            judul: "Audio, bus, dan AnimationPlayer",
            blok: [
              h2("AudioStreamPlayer2D dan bus"),
              p(
                "`AudioStreamPlayer2D` memutar suara dan meredamnya berdasarkan jarak ke pendengar. Suara non-posisional seperti musik latar memakai `AudioStreamPlayer`. Semua keluaran melewati **Audio Bus** yang diatur di panel Audio.",
              ),
              li(
                "`volume_db` bekerja dalam desibel; 0 dB = volume penuh, -6 dB ≈ setengah amplitudo.",
                "`bus` memilih jalur seperti `Master`, `Musik`, atau `SFX`.",
                "Atur `stream.loop = true` untuk musik yang mengulang.",
              ),
              h2("AnimationPlayer dan AnimationTree"),
              p(
                "`AnimationPlayer` memainkan animasi keyframe yang bisa menggerakkan properti apa pun, termasuk properti kustom skrip. Untuk transisi antar-animasi yang halus (misalnya idle ke jalan), `AnimationTree` dengan `AnimationNodeStateMachine` lebih tepat.",
              ),
              kode({
                kode: `@onready var anim: AnimationPlayer = $AnimationPlayer
@onready var sfx: AudioStreamPlayer2D = $AudioStreamPlayer2D

func main_animasi(nama: String) -> void:
    if anim.current_animation != nama:
        anim.play(nama)

func bunyikan(klip: AudioStream) -> void:
    sfx.stream = klip
    sfx.play()`,
                dapatDijalankan: false,
              }),
              q(
                "Cek `current_animation` sebelum `play()` supaya animasi yang sudah berjalan tidak diulang dari awal setiap frame.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: State Machine dan Audio",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa manfaat utama state machine dibanding rangkaian `if` bersarang?",
              pilihan: [
                "Kode berjalan lebih cepat",
                "Karakter selalu berada di satu state dengan transisi yang jelas",
                "Menghilangkan kebutuhan animasi",
                "Menggantikan mesin fisika",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kata kunci GDScript yang dipakai untuk memilih cabang berdasarkan nilai state adalah…",
              pilihan: ["switch", "match", "case", "select"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Berapa nilai desibel yang kira-kira setara setengah amplitudo?",
              pilihan: ["-3 dB", "-6 dB", "-20 dB", "0 dB"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Node mana yang tepat untuk memutar musik latar non-posisional?",
              pilihan: ["AudioStreamPlayer2D", "AudioStreamPlayer", "AnimationPlayer", "Area2D"],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // crs-7 — Automated Testing: Vitest & Playwright E2E
  // =========================================================================
  {
    slug: "automated-testing-vitest-playwright-e2e",
    judul: "Automated Testing: Vitest & Playwright E2E",
    deskripsi:
      "Strategi testing modern: unit testing cepat dengan Vitest, end-to-end browser testing dengan Playwright, dan continuous integration pipeline.",
    tags: ["Testing", "Vitest", "Playwright", "CI/CD"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Fondasi Unit Test dengan Vitest",
        ringkasan:
          "Menulis unit test pertama dengan API `describe`/`it`/`expect`, memahami matcher, dan menjalankan Vitest dalam mode watch.",
        durasi_min: 50,
        halaman: [
          {
            judul: "Mengapa Vitest",
            blok: [
              h2("Testing yang memakai pipeline Vite yang sama"),
              p(
                "Vitest berjalan di atas Vite. Artinya transformasi TypeScript, alias impor, dan resolusi ESM yang dipakai aplikasi juga dipakai test — tanpa konfigurasi ganda. Karena itu Vitest jauh lebih ringan daripada menyiapkan Jest dengan ts-jest dan babel terpisah.",
              ),
              li(
                "`npx vitest` menjalankan sekali; `npx vitest watch` memantau berkas dan menjalankan ulang test yang terdampak.",
                "Berkas test dicari lewat pola `**/*.{test,spec}.?(c|m)[jt]s?(x)` secara bawaan.",
                "Test berjalan di dalam worker paralel sehingga cepat, tetapi tetap terisolasi antarberkas.",
              ),
              q("Test yang lambat akan jarang dijalankan. Kecepatan adalah fitur, bukan kemewahan."),
            ],
          },
          {
            judul: "Struktur dan matcher",
            blok: [
              h2("describe, it, dan expect"),
              p(
                "`describe` mengelompokkan test sejenis, `it` (alias `test`) menyatakan satu perilaku, dan `expect` memeriksa hasilnya. Setiap `it` sebaiknya menguji satu perilaku dan punya nama yang menjelaskan harapan, bukan nama fungsi.",
              ),
              kode({
                kode: `import { describe, it, expect } from "vitest";
import { hitungDiskon } from "./harga";

describe("hitungDiskon", () => {
  it("memberi 10 persen untuk belanja di atas 100 ribu", () => {
    expect(hitungDiskon(150_000)).toBe(135_000);
  });

  it("tidak memberi diskon di bawah ambang", () => {
    expect(hitungDiskon(50_000)).toBe(50_000);
  });

  it("membulatkan ke rupiah terdekat", () => {
    expect(hitungDiskon(100_001)).toBe(90_001);
  });
});`,
                dapatDijalankan: false,
              }),
              h3("Matcher yang paling sering dipakai"),
              li(
                "`toBe` — kesamaan identik (`Object.is`), cocok untuk nilai primitif.",
                "`toEqual` — kesamaan struktur secara rekursif, cocok untuk objek dan array.",
                "`toThrow` — memastikan sebuah fungsi melempar galat.",
                "`toMatchObject` — memeriksa bahwa objek memuat subset properti tertentu.",
              ),
              q(
                "Pakai `toBe` untuk angka dan string, `toEqual` untuk struktur. Tertukar di antara keduanya menghasilkan kegagalan yang membingungkan.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Fondasi Unit Test dengan Vitest",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Vitest dibangun di atas perkakas apa?",
              pilihan: ["Webpack", "Vite", "esbuild sendirian", "Rollup tanpa Vite"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Matcher mana yang tepat untuk membandingkan dua objek secara struktural?",
              pilihan: ["toBe", "toEqual", "toBeTruthy", "toBeDefined"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perintah apa yang menjalankan test sekali lalu selesai?",
              pilihan: ["npx vitest watch", "npx vitest run", "npx vitest dev", "npx vitest serve"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Nama test yang baik menjelaskan…",
              pilihan: [
                "Nama fungsi yang dipanggil",
                "Perilaku yang diharapkan",
                "Nomor baris kode",
                "Nama berkas sumber",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Mock, Spy, dan Coverage",
        ringkasan:
          "Mengganti dependensi dengan `vi.fn` dan `vi.mock`, memata-matai fungsi dengan `vi.spyOn`, dan membaca laporan coverage tanpa tertipu angkanya.",
        durasi_min: 55,
        halaman: [
          {
            judul: "Mengganti dependensi yang tidak relevan",
            blok: [
              h2("vi.fn, vi.spyOn, dan vi.mock"),
              p(
                "Unit test yang baik menguji satu unit dan mengisolasi sisanya. Vitest menyediakan tiga alat utama: `vi.fn()` membuat fungsi palsu, `vi.spyOn()` memata-matai metode asli, dan `vi.mock()` mengganti seluruh modul.",
              ),
              li(
                "`vi.fn()` membuat fungsi kosong yang mencatat setiap pemanggilan.",
                "`vi.spyOn(objek, \"metode\")` menjaga implementasi asli kecuali kamu menimpanya dengan `mockImplementation`.",
                "`vi.mock(\"./kirim-email\")` diangkat (hoisted) ke atas berkas oleh Vitest, jadi ia berlaku sebelum impor apa pun.",
              ),
              kode({
                kode: `import { describe, it, expect, vi, beforeEach } from "vitest";
import { daftarPengguna } from "./layanan";
import { ambilDariApi } from "./api";

// Factory ini menggantikan modul ./api untuk seluruh berkas test.
vi.mock("./api", () => ({
  ambilDariApi: vi.fn(),
}));

describe("daftarPengguna", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // reset catatan pemanggilan antartest
  });

  it("memetakan respons API menjadi nama", async () => {
    vi.mocked(ambilDariApi).mockResolvedValue([
      { id: 1, nama: "Rani" },
    ]);

    const hasil = await daftarPengguna();

    expect(hasil).toEqual(["Rani"]);
    expect(ambilDariApi).toHaveBeenCalledOnce();
  });
});`,
                dapatDijalankan: false,
              }),
              q(
                "Mock yang terlalu banyak adalah tanda bahwa unitmu terlalu besar. Bila perlu meniru lima modul, pecah dulu kodenya.",
              ),
            ],
          },
          {
            judul: "Coverage dan batasnya",
            blok: [
              h2("Mengukur baris yang dieksekusi"),
              p(
                "Vitest menghasilkan laporan coverage lewat penyedia V8 (`@vitest/coverage-v8`) atau Istanbul. Coverage mengukur baris, cabang, fungsi, dan pernyataan yang tersentuh test.",
              ),
              kode({
                kode: `// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
      },
    },
  },
});`,
                dapatDijalankan: false,
              }),
              li(
                "Ambang `branches` biasanya paling sulit dipenuhi karena setiap cabang `if` harus disentuh.",
                "Coverage tinggi tidak membuktikan kebenaran — baris bisa dieksekusi tanpa satu pun assertion.",
                "Kecualikan berkas konfigurasi dan tipe agar angkanya tidak menyesatkan.",
              ),
              q(
                "Coverage mengukur apa yang sudah dijalankan, bukan apa yang sudah diperiksa. Angka 100 persen masih bisa menyembunyikan bug.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Mock, Spy, dan Coverage",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa fungsi `vi.mock(\"./modul\")` di Vitest?",
              pilihan: [
                "Menghapus berkas dari disk",
                "Mengganti seluruh modul dengan implementasi tiruan",
                "Menjalankan modul dua kali",
                "Menambah coverage modul",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa perbedaan utama `vi.spyOn` dari `vi.fn`?",
              pilihan: [
                "`vi.spyOn` menjaga implementasi asli metode kecuali ditimpa",
                "`vi.spyOn` hanya untuk fungsi async",
                "`vi.fn` tidak bisa dicatat pemanggilannya",
                "Keduanya identik",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Penyedia coverage bawaan yang direkomendasikan Vitest adalah…",
              pilihan: ["istanbul", "v8", "nyc", "c8-legacy"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa coverage 100 persen tidak menjamin bebas bug?",
              pilihan: [
                "Karena Vitest tidak akurat",
                "Karena baris bisa dieksekusi tanpa assertion yang memeriksa hasil",
                "Karena coverage selalu salah hitung",
                "Karena hanya berlaku untuk TypeScript",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Playwright: End-to-End di Peramban",
        ringkasan:
          "Menulis test browser dengan locator tahan perubahan, memanfaatkan auto-waiting, serta mengatur proyek lintas peramban dan trace.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Locator dan auto-waiting",
            blok: [
              h2("Pilih elemen seperti pengguna melihatnya"),
              p(
                "Playwright mendorong pemilihan elemen berdasarkan peran dan label, bukan selektor CSS yang rapuh. Locator bersifat malas: ia baru mencari elemen saat dipakai, dan otomatis menunggu hingga elemen muncul, stabil, dan bisa diklik.",
              ),
              li(
                "`page.getByRole(\"button\", { name: \"Masuk\" })` — prioritas tertinggi, mencerminkan aksesibilitas.",
                "`page.getByLabel(\"Email\")` — untuk kolom formulir yang punya label.",
                "`page.getByTestId(\"keranjang\")` — cadangan ketika tidak ada peran atau label yang jelas.",
                "`page.getByText(\"Selamat datang\")` — untuk teks yang terlihat pengguna.",
              ),
              kode({
                kode: `import { test, expect } from "@playwright/test";

test("pengguna bisa masuk dan melihat dasbor", async ({ page }) => {
  await page.goto("/masuk");

  await page.getByLabel("Email").fill("rani@contoh.test");
  await page.getByLabel("Kata sandi").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();

  // Assertion web-first: otomatis menunggu hingga kondisi terpenuhi.
  await expect(page.getByRole("heading", { name: "Dasbor" })).toBeVisible();
  await expect(page).toHaveURL("/dasbor");
});`,
                dapatDijalankan: false,
              }),
              q(
                "Jangan pernah menulis `waitForTimeout(1000)`. Gunakan assertion web-first yang menunggu sampai kondisi benar-benar terpenuhi.",
              ),
            ],
          },
          {
            judul: "Proyek, fixture, dan trace",
            blok: [
              h2("Satu suite, banyak peramban"),
              p(
                "Berkas `playwright.config.ts` mendefinisikan **projects**, masing-masing dengan peramban berbeda. Test yang sama dijalankan ulang di Chromium, Firefox, dan WebKit tanpa duplikasi kode.",
              ),
              kode({
                kode: `// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});`,
                dapatDijalankan: false,
              }),
              li(
                "`trace: \"on-first-retry\"` merekam jejak lengkap saat test gagal — bisa dibuka dengan `npx playwright show-trace`.",
                "`storageState` menyimpan cookie dan localStorage agar test berikutnya tidak perlu login ulang.",
                "`fullyParallel` menjalankan test dalam berkas yang sama secara paralel.",
              ),
              h3("Fixture bawaan"),
              p(
                "Fungsi test menerima objek fixture: `page` untuk satu tab, `context` untuk sesi peramban terisolasi, dan `request` untuk panggilan HTTP langsung. Fixture kustom bisa memperluas ini dengan `test.extend`.",
              ),
              q(
                "Setiap test mendapat context baru secara bawaan, sehingga cookie dari satu test tidak bocor ke test lain.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Playwright E2E",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Locator mana yang paling disarankan karena mencerminkan aksesibilitas?",
              pilihan: [
                "page.locator(\"div.klik\")",
                "page.getByRole(\"button\", { name: \"Masuk\" })",
                "page.$(\"#tombol-1\")",
                "page.locator(\"xpath=//button\")",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa `waitForTimeout` sebaiknya dihindari?",
              pilihan: [
                "Karena memperlambat kompilasi",
                "Karena menunggu durasi tetap, bukan kondisi yang sebenarnya",
                "Karena hanya tersedia di Firefox",
                "Karena dilarang TypeScript",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi opsi `trace: \"on-first-retry\"`?",
              pilihan: [
                "Menjalankan test dua kali",
                "Merekam jejak lengkap saat percobaan ulang pertama",
                "Menonaktifkan screenshot",
                "Memilih peramban",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang disimpan `storageState`?",
              pilihan: [
                "Berkas test",
                "Cookie dan localStorage untuk memakai ulang sesi",
                "Konfigurasi webpack",
                "Hasil screenshot",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "CI/CD dan Strategi Menghadapi Flaky Test",
        ringkasan:
          "Menjalankan test di pipeline, memecah beban dengan sharding, dan mengenali serta memperbaiki test yang kadang lulus kadang gagal.",
        durasi_min: 55,
        halaman: [
          {
            judul: "Menjalankan test di pipeline",
            blok: [
              h2("Workflow GitHub Actions"),
              p(
                "CI menjalankan test pada setiap pull request. Unit test dan E2E sebaiknya dipisah: unit test cepat dan selalu dijalankan, E2E lebih berat dan bisa diparalelkan dengan sharding.",
              ),
              kode({
                kode: `# .github/workflows/test.yml
name: test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vitest run --coverage

  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      # --with-deps memasang dependensi sistem peramban di runner Linux.
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=\${{ matrix.shard }}/3`,
                dapatDijalankan: false,
              }),
              li(
                "`npm ci` memasang versi tepat dari lockfile — jangan pakai `npm install` di CI.",
                "`--shard=1/3` membagi test menjadi tiga bagian yang berjalan paralel.",
                "`fail-fast: false` tetap menjalankan semua shard walau satu gagal.",
              ),
              q(
                "Runner Linux tidak punya peramban. `playwright install --with-deps` memasang peramban sekaligus pustaka sistem yang dibutuhkannya.",
              ),
            ],
          },
          {
            judul: "Menjinakkan flaky test",
            blok: [
              h2("Test yang kadang lulus, kadang gagal"),
              p(
                "**Flaky test** adalah test yang hasilnya berubah tanpa perubahan kode. Ia lebih berbahaya daripada test yang selalu gagal, karena orang belajar mengabaikannya. Akar penyebabnya hampir selalu waktu, urutan, atau keadaan bersama.",
              ),
              li(
                "Bergantung pada durasi tetap alih-alih kondisi — ganti dengan assertion web-first.",
                "Urutan test saling memengaruhi — setiap test harus menyiapkan datanya sendiri.",
                "Bergantung pada jam atau zona waktu nyata — suntikkan waktu lewat `vi.useFakeTimers()`.",
                "Data bersama antar-worker — pakai basis data atau akun terpisah per test.",
              ),
              kode({
                kode: `// Alih-alih menunggu jaringan selesai dengan durasi tetap:
// await page.waitForTimeout(2000);

// Tunggu sampai kondisi yang benar-benar berarti terpenuhi:
await expect(page.getByText("Tersimpan")).toBeVisible();`,
                dapatDijalankan: false,
              }),
              q(
                "`retries` menutupi flaky test, tidak menyembuhkannya. Pakai hanya sebagai jaring pengaman sambil kamu memperbaiki akarnya.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: CI/CD dan Flaky Test",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa `npm ci` lebih tepat daripada `npm install` di CI?",
              pilihan: [
                "Karena lebih cepat selalu",
                "Karena memasang versi tepat sesuai lockfile secara deterministik",
                "Karena tidak butuh internet",
                "Karena memasang dependensi global",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi `npx playwright test --shard=1/3`?",
              pilihan: [
                "Menjalankan test tiga kali",
                "Membagi test menjadi tiga bagian dan menjalankan bagian pertama",
                "Memilih peramban ketiga",
                "Mengurangi resolusi layar",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa flaky test lebih berbahaya daripada test yang selalu gagal?",
              pilihan: [
                "Karena memakan lebih banyak memori",
                "Karena orang belajar mengabaikannya sehingga kegagalan asli ikut terlewat",
                "Karena selalu memperlambat CI",
                "Karena tidak bisa dijalankan ulang",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Penyebab paling umum flaky test adalah…",
              pilihan: [
                "Kesalahan sintaks",
                "Ketergantungan pada waktu, urutan, atau keadaan bersama",
                "Versi Node.js terlalu baru",
                "Kurangnya komentar",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // crs-8 — Implementasi Arsitektur HMAC Attestation & Zero-Knowledge
  // =========================================================================
  {
    slug: "implementasi-arsitektur-hmac-attestation-zero-knowledge",
    judul: "Implementasi Arsitektur HMAC Attestation & Zero-Knowledge",
    deskripsi:
      "Rancang verifikasi kredensial kriptografis tanpa database terpusat menggunakan signature HMAC-SHA256 kanonikal dan audit log anti-tamper.",
    tags: ["Cryptography", "HMAC", "Verification", "NextGen Secure"],
    level: "lanjut",
    track: "cyber-sec",
    // Kursus ini sengaja tetap draft di katalog. Kontennya tetap disemai supaya
    // siap dipublikasikan, tetapi seed tidak boleh mengangkatnya ke published.
    status: "draft",
    modul: [
      {
        judul: "Primer Kriptografi: HMAC-SHA256",
        ringkasan:
          "Bagaimana HMAC dibentuk di atas SHA-256, mengapa ia berbeda dari hash biasa, dan mengapa perbandingan tanda tangan harus waktu konstan.",
        durasi_min: 55,
        halaman: [
          {
            judul: "MAC dan konstruksi HMAC",
            blok: [
              h2("Dari hash ke kode autentikasi pesan"),
              p(
                "Hash biasa seperti SHA-256 membuktikan integritas, tetapi tidak membuktikan siapa yang membuatnya — siapa pun bisa menghitung ulang hash. **MAC** (Message Authentication Code) menambahkan kunci rahasia sehingga hanya pemegang kunci yang bisa membuat atau memverifikasi kode.",
              ),
              p(
                "HMAC didefinisikan pada RFC 2104. Ia membungkus fungsi hash dengan dua padding rahasia, `ipad` (0x36) dan `opad` (0x5c), yang masing-masing sepanjang satu blok hash. Untuk SHA-256, ukuran blok adalah 64 byte dan panjang keluaran adalah 32 byte.",
              ),
              kode({
                kode: `HMAC(K, m) = H( (K' xor opad) || H( (K' xor ipad) || m ) )

K' = kunci K, di-hash dulu bila lebih panjang dari blok,
     atau di-pad dengan nol bila lebih pendek dari blok.
ipad = byte 0x36 diulang sebanyak ukuran blok (64 untuk SHA-256)
opad = byte 0x5c diulang sebanyak ukuran blok
H    = SHA-256`,
                dapatDijalankan: false,
              }),
              li(
                "HMAC mencegah serangan **length extension** yang menyerang hash biasa dengan kunci yang ditempel di depan.",
                "Kunci minimum yang disarankan untuk SHA-256 adalah 32 byte acak, sepanjang ukuran keluarannya.",
                "Jangan pernah menulis `hash(kunci + pesan)`. Itu bukan HMAC dan rentan.",
              ),
              q(
                "HMAC membuktikan keaslian dan integritas, tetapi bukan kerahasiaan. Pesannya tetap terbaca bila tidak dienkripsi.",
              ),
            ],
          },
          {
            judul: "Membuat dan membandingkan tanda tangan dengan aman",
            blok: [
              h2("Menghitung HMAC di Node.js"),
              p(
                "Modul `node:crypto` menyediakan `createHmac`. Kunci disimpan di variabel lingkungan server, tidak pernah dikirim ke klien. Keluarannya biasanya dikodekan heksadesimal atau base64url untuk ditempelkan ke header atau payload token.",
              ),
              kode({
                kode: `import { createHmac, timingSafeEqual } from "node:crypto";

function tandaTangani(payload: string, kunci: Buffer): string {
  return createHmac("sha256", kunci).update(payload, "utf8").digest("base64url");
}

function tandaTanganCocok(
  payload: string,
  diterima: string,
  kunci: Buffer,
): boolean {
  const diharapkan = Buffer.from(tandaTangani(payload, kunci), "base64url");
  const nyata = Buffer.from(diterima, "base64url");

  // Panjang berbeda pasti tidak cocok; timingSafeEqual melempar bila beda panjang.
  if (diharapkan.length !== nyata.length) return false;

  // Bandingkan dalam waktu konstan agar tidak bocor lewat selisih waktu.
  return timingSafeEqual(diharapkan, nyata);
}`,
                dapatDijalankan: false,
              }),
              h3("Mengapa waktu konstan itu wajib"),
              p(
                "Perbandingan string biasa berhenti pada byte pertama yang berbeda. Penyerang bisa mengukur selisih waktu respons untuk menebak tanda tangan byte demi byte — ini **timing attack**. `timingSafeEqual` membandingkan seluruh buffer tanpa keluar lebih awal.",
              ),
              li(
                "Selalu bandingkan buffer dengan panjang yang sama; periksa panjang lebih dulu.",
                "Jangan pernah membandingkan tanda tangan dengan operator `===`.",
                "Simpan kunci di manajer rahasia, bukan di dalam repositori.",
              ),
              q(
                "Membocorkan waktu sama berbahayanya dengan membocorkan nilai bila selisihnya bisa diukur cukup banyak kali.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Primer HMAC-SHA256",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Berapa ukuran blok SHA-256 yang dipakai HMAC untuk padding?",
              pilihan: ["32 byte", "64 byte", "128 byte", "16 byte"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa perbedaan utama HMAC dari hash biasa tanpa kunci?",
              pilihan: [
                "HMAC lebih cepat",
                "HMAC memakai kunci rahasia sehingga membuktikan keaslian",
                "HMAC menghasilkan keluaran lebih pendek",
                "HMAC tidak bisa diverifikasi ulang",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa tanda tangan harus dibandingkan dengan `timingSafeEqual`?",
              pilihan: [
                "Karena lebih cepat",
                "Karena mencegah timing attack yang membocorkan tanda tangan byte demi byte",
                "Karena menghasilkan keluaran base64",
                "Karena `===` tidak bisa membandingkan buffer",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Panjang keluaran HMAC-SHA256 adalah…",
              pilihan: ["16 byte", "20 byte", "32 byte", "64 byte"],
              jawaban_benar: 2,
            },
          ],
        },
      },
      {
        judul: "Kanonikalisasi Payload dan Perlindungan Replay",
        ringkasan:
          "Menyusun serialisasi payload yang deterministik sehingga verifier dan penandatangan menghasilkan byte yang sama, serta mencegah pemutaran ulang.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Serialisasi kanonikal",
            blok: [
              h2("Kenapa urutan kunci bisa merusak tanda tangan"),
              p(
                "HMAC bekerja atas byte, bukan atas makna. Dua representasi JSON yang secara logis sama — `{\"a\":1,\"b\":2}` dan `{\"b\":2,\"a\":1}` — menghasilkan byte berbeda dan karenanya tanda tangan berbeda. **Kanonikalisasi** menetapkan satu bentuk tunggal sehingga kedua pihak selalu menghasilkan byte identik.",
              ),
              li(
                "Kunci objek diurutkan secara leksikografis dan stabil.",
                "Tanpa spasi atau baris baru; pemisah tetap (misalnya `,` dan `:`).",
                "Angka ditulis dalam satu format baku — hindari notasi ilmiah dan `-0`.",
                "String di-encode UTF-8 dan karakter khusus di-escape secara konsisten.",
                "Field yang tidak ada diperlakukan sama di kedua pihak, bukan dihilangkan diam-diam.",
              ),
              kode({
                kode: `import { createHmac } from "node:crypto";

// Urutkan kunci secara rekursif, lalu stringify tanpa spasi.
function kanonik(nilai: unknown): string {
  if (nilai === null || typeof nilai !== "object") {
    return JSON.stringify(nilai);
  }
  if (Array.isArray(nilai)) {
    return "[" + nilai.map(kanonik).join(",") + "]";
  }
  const objek = nilai as Record<string, unknown>;
  const bagian = Object.keys(objek)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + kanonik(objek[k]));
  return "{" + bagian.join(",") + "}";
}

export function tandaTanganiPayload(payload: unknown, kunci: Buffer): string {
  const bytes = Buffer.from(kanonik(payload), "utf8");
  return createHmac("sha256", kunci).update(bytes).digest("base64url");
}`,
                dapatDijalankan: false,
              }),
              q(
                "Aturan kanonikalisasi harus jadi bagian dari kontrak protokol, bukan detail implementasi — kedua pihak wajib memakai versi yang sama.",
              ),
            ],
          },
          {
            judul: "Nonce, timestamp, dan jendela waktu",
            blok: [
              h2("Mencegah tanda tangan dipakai ulang"),
              p(
                "Tanda tangan yang valid bisa direkam dan dikirim ulang (**replay attack**). Untuk mencegahnya, payload attestation memuat `nonce` acak yang unik per permintaan dan `exp` waktu kedaluwarsa. Verifier menolak nonce yang sudah pernah dilihat atau waktu yang di luar jendela toleransi.",
              ),
              li(
                "`nonce` — nilai acak minimal 128 bit, dibuat penandatangan.",
                "`iat` dan `exp` — waktu terbit dan kedaluwarsa, dalam detik Unix.",
                "Jendela toleransi clock skew biasanya 30–120 detik, bukan nol.",
                "Nonce yang sudah dipakai dicatat sampai `exp` terlampaui.",
              ),
              kode({
                kode: `import { randomBytes } from "node:crypto";

function payloadSegar(sekarangDetik: number) {
  return {
    nonce: randomBytes(16).toString("base64url"), // 128 bit
    iat: sekarangDetik,
    exp: sekarangDetik + 300, // berlaku 5 menit
  };
}

function masihBerlaku(
  payload: { iat: number; exp: number },
  sekarangDetik: number,
  toleransi = 60,
): boolean {
  if (payload.exp + toleransi < sekarangDetik) return false; // kedaluwarsa
  if (payload.iat - toleransi > sekarangDetik) return false; // dari masa depan
  return true;
}`,
                dapatDijalankan: false,
              }),
              q(
                "Tanpa nonce dan kedaluwarsa, sebuah tanda tangan yang bocor tetap sah selamanya — ini kesalahan paling umum pada skema attestation buatan sendiri.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Kanonikalisasi dan Anti-Replay",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa kanonikalisasi diperlukan sebelum menandatangani payload?",
              pilihan: [
                "Agar payload lebih kecil",
                "Agar representasi byte sama di kedua pihak untuk makna yang sama",
                "Agar HMAC lebih kuat",
                "Agar JSON bisa dibaca manusia",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi `nonce` dalam payload attestation?",
              pilihan: [
                "Mempercepat verifikasi",
                "Membuat tiap tanda tangan unik sehingga tidak bisa dipakai ulang",
                "Mengenkripsi payload",
                "Menyimpan kunci rahasia",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa jendela toleransi clock skew sebaiknya tidak nol?",
              pilihan: [
                "Karena HMAC butuh waktu",
                "Karena jam server penandatangan dan verifier bisa berbeda sedikit",
                "Karena nonce perlu ruang",
                "Karena JSON tidak menyimpan waktu",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Dalam contoh kanonikalisasi, kunci objek diurutkan secara…",
              pilihan: ["Acak", "Leksikografis", "Berdasarkan panjang", "Berdasarkan tipe nilai"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Attestation Stateless dan Rotasi Kunci",
        ringkasan:
          "Membangun token attestation yang bisa diverifikasi tanpa database terpusat, serta merotasi kunci tanpa memutus verifikasi yang sedang berjalan.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Verifikasi tanpa menyimpan sesi",
            blok: [
              h2("Tanda tangan sebagai sumber kebenaran"),
              p(
                "Pada arsitektur stateless, verifier tidak menyimpan daftar sesi. Ia hanya memegang kunci rahasia dan memeriksa tanda tangan pada setiap permintaan. Karena itu verifikasi bisa berjalan di banyak instance tanpa koordinasi, tetapi juga berarti **pencabutan** harus dirancang khusus.",
              ),
              li(
                "Token memuat klaim yang dibutuhkan verifier: `sub`, `iss`, `aud`, `exp`, `nonce`.",
                "Tanda tangan dihitung atas representasi kanonikal seluruh klaim.",
                "Verifier memeriksa tanda tangan, kedaluwarsa, `aud` yang cocok, dan nonce yang belum terpakai.",
                "Tanpa penyimpanan nonce, replay dalam jendela waktu masih mungkin — ini kompromi nyata.",
              ),
              kode({
                kode: `// Token = payload_kanonik + "." + tanda_tangan
function verifikasiToken(
  token: string,
  kunci: Buffer,
  audiens: string,
  sekarangDetik: number,
): { ok: boolean; alasan?: string } {
  const [payloadB64, tanda] = token.split(".");
  if (!payloadB64 || !tanda) return { ok: false, alasan: "format" };

  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8"),
  );

  // 1. Tanda tangan dihitung ulang atas byte payload yang diterima apa adanya.
  if (!tandaTanganCocok(payloadB64, tanda, kunci)) {
    return { ok: false, alasan: "tanda tangan" };
  }
  // 2. Klaim diperiksa setelah integritas terbukti.
  if (payload.aud !== audiens) return { ok: false, alasan: "aud" };
  if (!masihBerlaku(payload, sekarangDetik)) return { ok: false, alasan: "kedaluwarsa" };

  return { ok: true };
}`,
                dapatDijalankan: false,
              }),
              q(
                "Selalu verifikasi tanda tangan lebih dulu, baru percaya isi klaim. Klaim dari token yang belum terverifikasi tidak boleh dipakai untuk keputusan apa pun.",
              ),
            ],
          },
          {
            judul: "Rotasi kunci dan key id",
            blok: [
              h2("Mengganti kunci tanpa memutus layanan"),
              p(
                "Kunci yang tidak pernah diganti adalah risiko jangka panjang. Namun mengganti kunci secara mendadak akan menolak semua token yang masih beredar. Solusinya: setiap kunci diberi **`kid`** (key id), dan verifier memegang satu set kunci selama masa transisi.",
              ),
              li(
                "Penandatangan menyertakan `kid` di header atau payload agar verifier tahu kunci mana yang dipakai.",
                "Verifier menyimpan kunci aktif dan kunci lama selama jendela tumpang tindih minimal selama masa berlaku token terpanjang.",
                "Terbitkan kunci baru, tandatangani dengan kunci baru, lalu pertahankan kunci lama untuk memverifikasi token yang belum kedaluwarsa.",
                "Cabut kunci lama setelah token terakhir yang ditandatanganinya pasti kedaluwarsa.",
              ),
              kode({
                kode: `type Kunci = { kid: string; rahasia: Buffer };

function pilihKunci(daftar: Kunci[], kid: string): Kunci | undefined {
  return daftar.find((k) => k.kid === kid);
}

// Jendela tumpang tindih: kunci aktif + kunci lama yang masih menerima token.
const RING: Kunci[] = [
  { kid: "2026-01", rahasia: Buffer.from(process.env.KUNCI_BARU!, "base64") },
  { kid: "2025-12", rahasia: Buffer.from(process.env.KUNCI_LAMA!, "base64") },
];

function verifikasiDenganKid(token: { kid: string; payload: string; tanda: string }) {
  const kunci = pilihKunci(RING, token.kid);
  if (!kunci) return { ok: false, alasan: "kid tidak dikenal" };
  return { ok: tandaTanganCocok(token.payload, token.tanda, kunci.rahasia) };
}`,
                dapatDijalankan: false,
              }),
              q(
                "Rotasi kunci adalah operasi rutin, bukan keadaan darurat. Uji prosedurnya sebelum kamu membutuhkannya.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Attestation Stateless dan Rotasi Kunci",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa konsekuensi utama arsitektur verifikasi stateless?",
              pilihan: [
                "Tidak butuh kunci rahasia",
                "Tidak ada daftar sesi, sehingga pencabutan harus dirancang khusus",
                "Verifikasi jadi lebih lambat",
                "Tidak bisa memakai HMAC",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Urutan pemeriksaan token yang benar adalah…",
              pilihan: [
                "Percaya klaim dulu, verifikasi tanda tangan belakangan",
                "Verifikasi tanda tangan lebih dulu, baru periksa klaim",
                "Periksa `aud` dulu, tanda tangan diabaikan",
                "Tidak perlu urutan tertentu",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi `kid` pada rotasi kunci?",
              pilihan: [
                "Memperpendek tanda tangan",
                "Menunjukkan kunci mana yang dipakai untuk menandatangani",
                "Mengenkripsi payload",
                "Menghitung nonce",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan kunci lama boleh dicabut sepenuhnya?",
              pilihan: [
                "Segera setelah kunci baru diterbitkan",
                "Setelah semua token yang ditandatanganinya pasti kedaluwarsa",
                "Setiap 24 jam tanpa kecuali",
                "Saat jumlah instance bertambah",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Audit Log Anti-Tamper dan Batas Zero-Knowledge",
        ringkasan:
          "Mengaitkan catatan audit dengan hash berantai agar perubahan terdeteksi, lalu memahami di mana HMAC berhenti dan zero-knowledge proof dimulai.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Hash chain untuk audit log",
            blok: [
              h2("Setiap catatan mengunci catatan sebelumnya"),
              p(
                "Audit log hanya berguna bila tidak bisa diubah diam-diam. Pada **hash chain**, setiap entri menyimpan hash entri sebelumnya. Mengubah satu entri lama mengubah hash-nya, sehingga semua hash setelahnya tidak lagi cocok dan pelanggaran langsung terlihat.",
              ),
              li(
                "`prev_hash` — hash entri sebelumnya; entri pertama memakai nilai awal tetap.",
                "`hash` — H(prev_hash || isi_entri || waktu).",
                "Verifikasi ulang seluruh rantai mendeteksi setiap perubahan atau penghapusan.",
                "Untuk membuktikan sebuah entri tanpa mengirim seluruh log, gunakan **Merkle tree** dan bukti cabangnya.",
              ),
              kode({
                kode: `import { createHash } from "node:crypto";

type Entri = { isi: string; waktu: string; prev_hash: string; hash: string };

function hashEntri(e: Omit<Entri, "hash">): string {
  return createHash("sha256")
    .update(e.prev_hash + "|" + e.isi + "|" + e.waktu, "utf8")
    .digest("hex");
}

function tambahEntri(log: Entri[], isi: string, waktu: string): Entri {
  const prev = log.length ? log[log.length - 1].hash : "GENESIS";
  const tanpaHash = { isi, waktu, prev_hash: prev };
  return { ...tanpaHash, hash: hashEntri(tanpaHash) };
}

function rantaiUtuh(log: Entri[]): boolean {
  for (let i = 0; i < log.length; i++) {
    const prev = i === 0 ? "GENESIS" : log[i - 1].hash;
    if (log[i].prev_hash !== prev) return false;
    if (hashEntri(log[i]) !== log[i].hash) return false;
  }
  return true;
}`,
                dapatDijalankan: false,
              }),
              q(
                "Hash chain membuktikan integritas, bukan keaslian. Gabungkan dengan HMAC bila kamu juga perlu membuktikan siapa yang menulis entri.",
              ),
            ],
          },
          {
            judul: "Batas HMAC dan peran zero-knowledge",
            blok: [
              h2("HMAC bukan zero-knowledge"),
              p(
                "Penting untuk jujur soal batasnya: HMAC adalah kode autentikasi pesan, bukan bukti zero-knowledge. Verifier yang memegang kunci bisa menghitung ulang tanda tangan untuk pesan apa pun, sehingga ia tidak pernah benar-benar 'tidak mengetahui' rahasia. HMAC menjawab pertanyaan **'apakah pesan ini asli dan utuh?'**, bukan **'apakah pemilik membuktikan sesuatu tanpa mengungkap apa pun?'**.",
              ),
              li(
                "**Autentikasi (HMAC)** — membuktikan pesan tidak diubah dan dibuat pemegang kunci.",
                "**Zero-knowledge proof** — membuktikan pernyataan benar tanpa mengungkap saksi (witness).",
                "Tiga sifat ZKP: **completeness** (pernyataan benar bisa dibuktikan), **soundness** (pernyataan salah hampir tak bisa dibuktikan), **zero-knowledge** (verifier tidak belajar apa pun selain kebenaran pernyataan).",
              ),
              h2("Konsep pembuktian tanpa mengungkap"),
              p(
                "Protokol **Schnorr** adalah contoh klasik: prover berkomitmen pada nilai acak, verifier mengirim tantangan, prover menjawab, dan verifier memeriksa tanpa pernah melihat kunci rahasia. Transformasi **Fiat–Shamir** mengubahnya menjadi bukti non-interaktif dengan menurunkan tantangan dari hash pesan.",
              ),
              kode({
                kode: `Protokol Schnorr (konseptual, atas grup siklik berorder q, generator g):
  Prover punya rahasia x, publik y = g^x mod p.

  1. Commit   : Prover memilih r acak, mengirim t = g^r mod p.
  2. Challenge: Verifier mengirim c acak.
  3. Response : Prover mengirim s = r + c*x mod q.
  4. Verify   : Verifier memeriksa g^s == t * y^c mod p.

Fiat-Shamir: ganti langkah 2 dengan c = H(t || pesan),
sehingga bukti bisa diverifikasi tanpa interaksi.`,
                dapatDijalankan: false,
              }),
              q(
                "Rancang sistem dengan tujuan yang jelas: HMAC untuk keaslian dan integritas, ZKP hanya ketika kamu benar-benar perlu membuktikan tanpa mengungkap.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Audit Log dan Zero-Knowledge",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang membuat hash chain mendeteksi perubahan entri lama?",
              pilihan: [
                "Setiap entri menyimpan salinan seluruh log",
                "Setiap entri menyimpan hash entri sebelumnya sehingga perubahan merambat",
                "Entri ditandatangani dengan kunci publik",
                "Entri disimpan di beberapa server",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa HMAC bukan bukti zero-knowledge?",
              pilihan: [
                "Karena HMAC terlalu lambat",
                "Karena verifier memegang kunci dan bisa menghitung ulang tanda tangan untuk pesan apa pun",
                "Karena HMAC tidak memakai hash",
                "Karena HMAC hanya untuk kunci publik",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Tiga sifat zero-knowledge proof adalah…",
              pilihan: [
                "Kecepatan, ukuran, biaya",
                "Completeness, soundness, zero-knowledge",
                "Confidentiality, integrity, availability",
                "Enkripsi, dekripsi, hashing",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang dilakukan transformasi Fiat–Shamir pada protokol Schnorr?",
              pilihan: [
                "Menambah jumlah putaran interaksi",
                "Mengganti tantangan verifier dengan hash sehingga bukti menjadi non-interaktif",
                "Mengganti HMAC dengan RSA",
                "Menghapus langkah verifikasi",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
];
