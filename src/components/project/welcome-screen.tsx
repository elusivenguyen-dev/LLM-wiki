import { useEffect, useState } from "react"
import { FolderOpen, Plus, Minus, Clock, X, Languages, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecentProjects, removeFromRecentProjects, saveZoomLevel } from "@/lib/project-store"
import type { WikiProject } from "@/types/wiki"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import { saveLanguage, saveTheme } from "@/lib/project-store"
import { applyTheme, type AppTheme } from "@/lib/theme"
import {
  applyDocumentZoom,
  clampZoomLevel,
  roundZoomLevel,
  useZoomStore,
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  ZOOM_STEP,
} from "@/stores/zoom-store"

interface WelcomeScreenProps {
  onCreateProject: () => void
  onOpenProject: () => void
  onSelectProject: (project: WikiProject) => void
}

export function WelcomeScreen({
  onCreateProject,
  onOpenProject,
  onSelectProject,
}: WelcomeScreenProps) {
  const { t } = useTranslation()
  const [recentProjects, setRecentProjects] = useState<WikiProject[]>([])
  const [language, setLanguage] = useState<"en" | "th">(
    i18n.resolvedLanguage === "th" ? "th" : "en",
  )
  const [theme, setTheme] = useState<"light" | "dark">(
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  )
  const zoomLevel = useZoomStore((s) => s.level)
  const setZoomLevel = useZoomStore((s) => s.setLevel)

  useEffect(() => {
    getRecentProjects().then(setRecentProjects).catch(() => {})
  }, [])

  async function handleRemoveRecent(e: React.MouseEvent, path: string) {
    e.stopPropagation()
    await removeFromRecentProjects(path)
    const updated = await getRecentProjects()
    setRecentProjects(updated)
  }

  async function handleLanguageChange(next: "en" | "th") {
    setLanguage(next)
    await i18n.changeLanguage(next)
    await saveLanguage(next)
  }

  async function handleThemeChange(next: AppTheme) {
    const resolved = next === "dark" ? "dark" : "light"
    setTheme(resolved)
    applyTheme(resolved)
    await saveTheme(resolved)
  }

  async function handleZoomChange(next: number) {
    const clamped = clampZoomLevel(roundZoomLevel(next))
    setZoomLevel(clamped)
    applyDocumentZoom(clamped)
    await saveZoomLevel(clamped)
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-background transition-colors">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <div
          className="flex items-center rounded-lg border bg-card p-1 shadow-sm"
          aria-label={t("welcome.language")}
        >
          <Languages className="mx-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {(["th", "en"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void handleLanguageChange(item)}
              aria-pressed={language === item}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                language === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {item === "th" ? "ไทย" : "EN"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleThemeChange(theme === "dark" ? "light" : "dark")}
          className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
          aria-label={theme === "dark" ? t("welcome.switchToDay") : t("welcome.switchToNight")}
          title={theme === "dark" ? t("welcome.switchToDay") : t("welcome.switchToNight")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => void handleZoomChange(zoomLevel - ZOOM_STEP)}
            disabled={zoomLevel <= MIN_ZOOM_LEVEL}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label={t("settings.sections.interface.zoomOut")}
            title={t("settings.sections.interface.zoomOut")}
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-[3ch] px-1 text-center text-sm font-medium tabular-nums text-foreground">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => void handleZoomChange(zoomLevel + ZOOM_STEP)}
            disabled={zoomLevel >= MAX_ZOOM_LEVEL}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label={t("settings.sections.interface.zoomIn")}
            title={t("settings.sections.interface.zoomIn")}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t("app.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("app.subtitle")}
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={onCreateProject}>
            <Plus className="mr-2 h-4 w-4" />
            {t("welcome.newProject")}
          </Button>
          <Button variant="outline" onClick={onOpenProject}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {t("welcome.openProject")}
          </Button>
        </div>

        {recentProjects.length > 0 && (
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {t("welcome.recentProjects")}
            </div>
            <div className="rounded-lg border">
              {recentProjects.map((proj) => (
                <button
                  key={proj.path}
                  onClick={() => onSelectProject(proj)}
                  className="group flex w-full items-center justify-between border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{proj.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {proj.path}
                    </div>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleRemoveRecent(e, proj.path)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRemoveRecent(e as unknown as React.MouseEvent, proj.path)
                    }}
                    className="ml-2 shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
