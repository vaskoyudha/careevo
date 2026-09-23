"use client";

import { useState, useTransition, useMemo } from "react";
import type { Course, CourseStats, CourseStatus, CourseType } from "@/types/course";
import type { Level, Track } from "@/types/domain";
import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
} from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRACK_LABELS: Record<Track, string> = {
  "web-dev": "Web Development",
  data: "Data Science",
  "cyber-sec": "Cyber Security",
  "game-dev": "Game Development",
};

const LEVEL_LABELS: Record<Level, string> = {
  dasar: "Dasar",
  menengah: "Menengah",
  lanjut: "Lanjut",
};

const STATUS_LABELS: Record<CourseStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Diarsipkan",
};

interface FormState {
  id?: string;
  title: string;
  slug: string;
  description: string;
  provider: string;
  track: Track;
  level: Level;
  type: CourseType;
  tags: string;
  url: string;
  duration_min: number;
  is_free: boolean;
  price: number;
  status: CourseStatus;
}

const DEFAULT_FORM: FormState = {
  title: "",
  slug: "",
  description: "",
  provider: "Careevo Academy",
  track: "web-dev",
  level: "dasar",
  type: "course",
  tags: "",
  url: "https://careevo.test",
  duration_min: 120,
  is_free: true,
  price: 0,
  status: "published",
};

export function CourseManager({
  initialCourses,
  initialStats,
}: {
  initialCourses: Course[];
  initialStats: CourseStats;
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [stats, setStats] = useState<CourseStats>(initialStats);
  const [search, setSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("semua");
  const [selectedLevel, setSelectedLevel] = useState<string>("semua");
  const [selectedStatus, setSelectedStatus] = useState<string>("semua");

  // Modals state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Status banners
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (selectedTrack !== "semua" && course.track !== selectedTrack) return false;
      if (selectedLevel !== "semua" && course.level !== selectedLevel) return false;
      if (selectedStatus !== "semua" && course.status !== selectedStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = course.title.toLowerCase().includes(q);
        const matchDesc = course.description.toLowerCase().includes(q);
        const matchProvider = course.provider.toLowerCase().includes(q);
        const matchTag = course.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchProvider && !matchTag) return false;
      }

      return true;
    });
  }, [courses, selectedTrack, selectedLevel, selectedStatus, search]);

  const recomputeStats = (currentCourses: Course[]) => {
    const total = currentCourses.length;
    const published = currentCourses.filter((c) => c.status === "published").length;
    const draft = currentCourses.filter((c) => c.status === "draft").length;
    const archived = currentCourses.filter((c) => c.status === "archived").length;
    const free = currentCourses.filter((c) => c.is_free).length;
    const paid = currentCourses.filter((c) => !c.is_free).length;
    setStats({ total, published, draft, archived, free, paid });
  };

  const openCreateDialog = () => {
    setDialogMode("create");
    setFormData(DEFAULT_FORM);
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setDialogMode("edit");
    setFormData({
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      provider: course.provider,
      track: course.track,
      level: course.level,
      type: course.type,
      tags: course.tags.join(", "),
      url: course.url,
      duration_min: course.duration_min,
      is_free: course.is_free,
      price: course.price,
      status: course.status,
    });
    setFieldErrors({});
    setIsDialogOpen(true);
  };

  const handleSaveCourse = () => {
    setFieldErrors({});
    setBanner(null);

    const fData = new FormData();
    if (formData.id) fData.append("id", formData.id);
    fData.append("title", formData.title);
    fData.append("slug", formData.slug);
    fData.append("description", formData.description);
    fData.append("provider", formData.provider);
    fData.append("track", formData.track);
    fData.append("level", formData.level);
    fData.append("type", formData.type);
    fData.append("tags", formData.tags);
    fData.append("url", formData.url);
    fData.append("duration_min", String(formData.duration_min));
    fData.append("is_free", formData.is_free ? "true" : "false");
    fData.append("price", String(formData.is_free ? 0 : formData.price));
    fData.append("status", formData.status);

    startTransition(async () => {
      if (dialogMode === "create") {
        const res = await createCourseAction({ ok: false }, fData);
        if (res.ok) {
          const tagsArray = formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

          const newCourseObj: Course = {
            id: res.courseId ?? `crs-${Date.now()}`,
            title: formData.title,
            slug: formData.slug || formData.title.toLowerCase().replace(/\s+/g, "-"),
            description: formData.description,
            provider: formData.provider,
            track: formData.track,
            level: formData.level,
            type: formData.type,
            tags: tagsArray,
            url: formData.url,
            duration_min: Number(formData.duration_min),
            is_free: formData.is_free,
            price: formData.is_free ? 0 : Number(formData.price),
            status: formData.status,
            enrolled_count: 0,
            rating: 5.0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const next = [newCourseObj, ...courses];
          setCourses(next);
          recomputeStats(next);
          setIsDialogOpen(false);
          setBanner({ type: "success", message: res.message ?? "Kursus berhasil dibuat!" });
        } else {
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
          setBanner({ type: "error", message: res.error ?? "Gagal menyimpan kursus." });
        }
      } else {
        const res = await updateCourseAction({ ok: false }, fData);
        if (res.ok) {
          const tagsArray = formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

          const next = courses.map((c) => {
            if (c.id === formData.id) {
              return {
                ...c,
                title: formData.title,
                slug: formData.slug || c.slug,
                description: formData.description,
                provider: formData.provider,
                track: formData.track,
                level: formData.level,
                type: formData.type,
                tags: tagsArray,
                url: formData.url,
                duration_min: Number(formData.duration_min),
                is_free: formData.is_free,
                price: formData.is_free ? 0 : Number(formData.price),
                status: formData.status,
                updated_at: new Date().toISOString(),
              };
            }
            return c;
          });

          setCourses(next);
          recomputeStats(next);
          setIsDialogOpen(false);
          setBanner({ type: "success", message: res.message ?? "Kursus berhasil diperbarui!" });
        } else {
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
          setBanner({ type: "error", message: res.error ?? "Gagal memperbarui kursus." });
        }
      }
    });
  };

  const handleDeleteCourse = () => {
    if (!courseToDelete) return;
    setBanner(null);

    const fData = new FormData();
    fData.append("id", courseToDelete.id);

    startTransition(async () => {
      const res = await deleteCourseAction({ ok: false }, fData);
      if (res.ok) {
        const next = courses.filter((c) => c.id !== courseToDelete.id);
        setCourses(next);
        recomputeStats(next);
        setCourseToDelete(null);
        setBanner({ type: "success", message: res.message ?? "Kursus berhasil dihapus." });
      } else {
        setBanner({ type: "error", message: res.error ?? "Gagal menghapus kursus." });
        setCourseToDelete(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner message */}
      {banner && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between rounded-lg p-3 text-sm transition-all",
            banner.type === "success"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
          )}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Total Kursus</span>
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{stats.total}</div>
          <p className="mt-1 text-xs text-muted-foreground">Koleksi kurikulum aktif</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Published</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.published}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Dapat diakses peserta</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Draf / Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.draft}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Dalam persiapan silabus</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Model Akses</span>
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {stats.free} <span className="text-xs font-normal text-muted-foreground">Gratis</span> · {stats.paid}{" "}
            <span className="text-xs font-normal text-muted-foreground">Premium</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Dukungan beasiswa & program</p>
        </div>
      </div>

      {/* Control bar */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kursus, tag, atau provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {/* Filter Track */}
            <select
              value={selectedTrack}
              aria-label="Filter berdasarkan jalur kompetensi"
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="semua">Semua Jalur</option>
              <option value="web-dev">Web Development</option>
              <option value="data">Data Science</option>
              <option value="cyber-sec">Cyber Security</option>
              <option value="game-dev">Game Development</option>
            </select>

            {/* Filter Level */}
            <select
              value={selectedLevel}
              aria-label="Filter berdasarkan tingkat kesulitan"
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="semua">Semua Level</option>
              <option value="dasar">Dasar</option>
              <option value="menengah">Menengah</option>
              <option value="lanjut">Lanjut</option>
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              aria-label="Filter berdasarkan status publikasi"
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
            >
              <option value="semua">Semua Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {(search || selectedTrack !== "semua" || selectedLevel !== "semua" || selectedStatus !== "semua") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedTrack("semua");
                  setSelectedLevel("semua");
                  setSelectedStatus("semua");
                }}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          <Button onClick={openCreateDialog} className="shrink-0 gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Tambah Kursus Baru
          </Button>
        </div>
      </div>

      {/* Course List Table */}
      <div className="card overflow-hidden">
        <div className="card-head border-b border-border/50 px-5 py-4">
          <div>
            <h2 className="card-title text-base">Daftar Kursus ({filteredCourses.length})</h2>
            <p className="card-sub text-xs">
              Kelola materi pembelajaran, silabus kompetensi, dan akses peserta.
            </p>
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-sm font-medium">Tidak ada kursus yang cocok</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Coba sesuaikan filter pencarian atau buat kursus baru dengan menekan tombol Tambah.
            </p>
            <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Buat Kursus Sekarang
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/50 bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kursus & Provider</th>
                  <th className="px-4 py-3">Jalur & Level</th>
                  <th className="px-4 py-3">Durasi</th>
                  <th className="px-4 py-3">Akses & Harga</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="font-semibold text-foreground text-sm leading-tight">
                        {course.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {course.provider} · <span className="mono text-[11px]">{course.slug}</span>
                      </div>
                      {course.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {course.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {course.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{course.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[11px] font-normal">
                          {TRACK_LABELS[course.track] ?? course.track}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          Level: {LEVEL_LABELS[course.level] ?? course.level}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{course.duration_min} menit</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {course.is_free ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          Gratis
                        </span>
                      ) : (
                        <div className="font-medium text-foreground">
                          Rp {course.price.toLocaleString("id-ID")}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          course.status === "published"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : course.status === "draft"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {STATUS_LABELS[course.status] ?? course.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={course.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Buka tautan materi"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => openEditDialog(course)}
                          title="Ubah kursus"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCourseToDelete(course)}
                          title="Hapus kursus"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Tambah Kursus Baru" : "Edit Kursus"}
            </DialogTitle>
            <DialogDescription>
              Isi data detail kurikulum kursus di bawah ini. Pastikan informasi akurat untuk panduan peserta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-foreground">
                Judul Kursus <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Contoh: Fullstack Web Development dengan Next.js 15"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
              {fieldErrors.title && (
                <p className="mt-1 text-[11px] text-red-500">{fieldErrors.title}</p>
              )}
            </div>

            {/* Custom Slug & Provider */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Slug URL <span className="text-xs text-muted-foreground">(opsional)</span>
                </label>
                <Input
                  placeholder="otomatis dari judul jika kosong"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="mt-1"
                />
                {fieldErrors.slug && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.slug}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Penyelenggara / Provider <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Careevo Academy"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="mt-1"
                />
                {fieldErrors.provider && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.provider}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-foreground">
                Deskripsi & Silabus <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Ringkasan capaian pembelajaran, silabus modul, dan kompetensi yang dipelajari..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
              />
              {fieldErrors.description && (
                <p className="mt-1 text-[11px] text-red-500">{fieldErrors.description}</p>
              )}
            </div>

            {/* Track, Level, Type */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-foreground">Jalur Kompetensi</label>
                <select
                  value={formData.track}
                  aria-label="Pilih jalur kompetensi formulir"
                  onChange={(e) => setFormData({ ...formData, track: e.target.value as Track })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="web-dev">Web Development</option>
                  <option value="data">Data Science</option>
                  <option value="cyber-sec">Cyber Security</option>
                  <option value="game-dev">Game Development</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Tingkat Kesulitan</label>
                <select
                  value={formData.level}
                  aria-label="Pilih tingkat kesulitan formulir"
                  onChange={(e) => setFormData({ ...formData, level: e.target.value as Level })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="dasar">Dasar (Beginner)</option>
                  <option value="menengah">Menengah (Intermediate)</option>
                  <option value="lanjut">Lanjut (Advanced)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Format Materi</label>
                <select
                  value={formData.type}
                  aria-label="Pilih format materi formulir"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CourseType })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="course">Kursus Interaktif</option>
                  <option value="video">Video Tutorial</option>
                  <option value="artikel">Artikel Panduan</option>
                  <option value="bootcamp">Bootcamp Intensif</option>
                </select>
              </div>
            </div>

            {/* URL & Duration */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">
                  URL Materi / Tautan <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="https://careevo.test/learn/..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="mt-1"
                />
                {fieldErrors.url && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.url}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Estimasi Durasi (Menit) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  placeholder="120"
                  value={formData.duration_min}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_min: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
                {fieldErrors.duration_min && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.duration_min}</p>
                )}
              </div>
            </div>

            {/* Free vs Paid & Price */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-foreground">Akses Gratis</span>
                  <p className="text-[11px] text-muted-foreground">
                    Kursus dapat diakses gratis oleh seluruh peserta Careevo.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_free}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_free: e.target.checked,
                      price: e.target.checked ? 0 : formData.price || 150000,
                    })
                  }
                  className="h-4 w-4 rounded accent-primary"
                />
              </div>

              {!formData.is_free && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <label className="text-xs font-medium text-foreground">
                    Harga Kursus (IDR) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    placeholder="150000"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                  {fieldErrors.price && (
                    <p className="mt-1 text-[11px] text-red-500">{fieldErrors.price}</p>
                  )}
                </div>
              )}
            </div>

            {/* Tags & Status */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Tags (pisahkan dengan koma)
                </label>
                <Input
                  placeholder="Contoh: React, TypeScript, Vitest"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Status Publikasi</label>
                <select
                  value={formData.status}
                  aria-label="Pilih status publikasi formulir"
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as CourseStatus })
                  }
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="published">Published (Tayang Langsung)</option>
                  <option value="draft">Draft (Konsep Internal)</option>
                  <option value="archived">Archived (Diarsipkan)</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="button" onClick={handleSaveCourse} disabled={isPending}>
              {isPending ? "Menyimpan..." : dialogMode === "create" ? "Buat Kursus" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(courseToDelete)}
        onOpenChange={(open) => !open && setCourseToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Kursus</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus kursus{" "}
              <strong className="text-foreground">&ldquo;{courseToDelete?.title}&rdquo;</strong>? Tindakan ini
              akan menghapus kursus dari sistem dan katalog peserta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCourseToDelete(null)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteCourse}
              disabled={isPending}
            >
              {isPending ? "Menghapus..." : "Ya, Hapus Kursus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
