import { Sidebar } from "@/components/layout/sidebar"
import { CommandPalette } from "@/components/search/command-palette"
import { OnboardingTutorial } from "@/components/onboarding/onboarding-tutorial"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
      <CommandPalette />
      <OnboardingTutorial />
    </div>
  )
}
