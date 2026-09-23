import type { Level, Track } from "./domain";

export type CourseType = "course" | "video" | "artikel" | "bootcamp";
export type CourseStatus = "published" | "draft" | "archived";

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  provider: string;
  type: CourseType;
  track: Track;
  level: Level;
  tags: string[];
  url: string;
  duration_min: number;
  is_free: boolean;
  price: number;
  status: CourseStatus;
  enrolled_count: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

export type CreateCourseInput = {
  title: string;
  slug?: string;
  description: string;
  provider: string;
  type?: CourseType;
  track?: Track;
  level?: Level;
  tags?: string[];
  url: string;
  duration_min: number;
  is_free?: boolean;
  price?: number;
  status?: CourseStatus;
};

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CourseStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  free: number;
  paid: number;
}
