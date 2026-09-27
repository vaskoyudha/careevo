import { Suspense } from "react";
import { CapabilityAccessProvider } from "@/components/access/CapabilityAccessContext";
import { ChatRuntimeProvider } from "@/features/chat";
import { ReadingProvider } from "@/context/ReadingContext";
import { WatchingProvider } from "@/context/WatchingContext";
import ChatWorkspace from "@/features/chat/components/ChatWorkspace";

/**
 * Chat chromeless — dipakai drawer tutor Careevo lewat iframe.
 *
 * Rute ini sengaja berada **di luar semua route group** (`(workspace)`,
 * `(utility)`, `(settings)`, `(admin)`, `(auth)`). Alasannya satu: grup
 * `(workspace)` membungkus anaknya tanpa syarat dengan
 * `AppShell sidebar={<WorkspaceSidebar />}`, dan sidebar itu tidak muat di drawer
 * 300–640px — hasilnya chrome ganda dan transkrip terjepit. Tanpa route group,
 * tidak ada layout yang menyumbang sidebar. `app/handoff/page.tsx` memakai
 * posisi yang sama untuk alasan yang sama.
 *
 * Provider di bawah ini adalah yang **memang** dibutuhkan `ChatWorkspace`, dan
 * keempatnya tidak bergantung pada `AppShell` — sudah diperiksa satu per satu.
 * `AppShellProvider` sendiri dipasang di `app/layout.tsx` (root), jadi rute ini
 * tetap mendapatkannya tanpa sidebar.
 *
 * Kontrak query tidak berubah: `ChatWorkspace` membaca `course` dan `capability`
 * dari `window.location.search`-nya sendiri
 * (`ChatWorkspace.tsx:1398`), jadi `?course=<id>&capability=course_study`
 * sampai apa adanya dari `urlFrameTutorEmbed` di sisi Careevo.
 */
export default function EmbedChatPage() {
  return (
    <CapabilityAccessProvider>
      <Suspense>
        <ChatRuntimeProvider>
          <ReadingProvider>
            <WatchingProvider>
              <div className="h-dvh w-full overflow-hidden">
                <ChatWorkspace />
              </div>
            </WatchingProvider>
          </ReadingProvider>
        </ChatRuntimeProvider>
      </Suspense>
    </CapabilityAccessProvider>
  );
}
