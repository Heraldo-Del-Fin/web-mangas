"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteAnalytics } from "@/lib/data";

interface AdminMetricsPanelProps {
  analytics: SiteAnalytics;
}

export function AdminMetricsPanel({ analytics }: AdminMetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "mangas" | "chapters" | "categories" | "scanlations">("overview");

  const maxMangaViews = analytics.topMangas.length > 0 ? Math.max(...analytics.topMangas.map((m) => m.views), 1) : 1;
  const maxChapterViews = analytics.topChapters.length > 0 ? Math.max(...analytics.topChapters.map((c) => c.views), 1) : 1;

  // Total views for percentages in categories
  const totalTypeViews = Object.values(analytics.viewsByType).reduce((a, b) => a + b, 0) || 1;
  const totalDemoViews = Object.values(analytics.viewsByDemography).reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="border-2 border-indigo-600 bg-white shadow-2xs">
      {/* Encabezado del Panel de Métricas */}
      <div className="border-b-2 border-zinc-300 bg-gradient-to-r from-zinc-900 via-zinc-800 to-indigo-950 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-white uppercase">
                Panel de Analítica Web
              </span>
              <span className="border border-indigo-400/30 bg-indigo-950/60 px-2 py-0.5 text-[10px] font-black text-indigo-200 uppercase">
                Exclusivo Administrador
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight uppercase sm:text-2xl">
              📊 Métricas y Tráfico Global
            </h2>
            <p className="text-xs text-zinc-300">
              Monitoreo en tiempo real de popularidad, volumen de lecturas y actividad de la plataforma.
            </p>
          </div>

          {/* Banner de Modo Incógnito de Admin */}
          <div className="flex items-center gap-2.5 border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 text-xs text-emerald-200">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-extrabold uppercase">Filtro Admin Activo:</span>{" "}
              <span className="text-emerald-100">
                Tus vistas no se cuentan para no inflar los datos.
              </span>
            </div>
          </div>
        </div>

        {/* Tarjetas KPI Superiores */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="border border-zinc-700 bg-zinc-900/80 p-3.5">
            <div className="text-[10px] font-extrabold text-indigo-400 uppercase">
              👁 Vistas Totales
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {analytics.totalViews.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              Lecturas registradas
            </div>
          </div>

          <div className="border border-zinc-700 bg-zinc-900/80 p-3.5">
            <div className="text-[10px] font-extrabold text-blue-400 uppercase">
              📚 Obras en Catálogo
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {analytics.totalMangas}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              Mangas, manhwas y novelas
            </div>
          </div>

          <div className="border border-zinc-700 bg-zinc-900/80 p-3.5">
            <div className="text-[10px] font-extrabold text-emerald-400 uppercase">
              📑 Capítulos
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {analytics.totalChapters}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              Capítulos indexados
            </div>
          </div>

          <div className="border border-zinc-700 bg-zinc-900/80 p-3.5">
            <div className="text-[10px] font-extrabold text-amber-400 uppercase">
              🚀 Subidas / Uploads
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {analytics.totalUploads}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              Versiones de Scanlations
            </div>
          </div>

          <div className="col-span-2 border border-zinc-700 bg-zinc-900/80 p-3.5 sm:col-span-1">
            <div className="text-[10px] font-extrabold text-rose-400 uppercase">
              👥 Usuarios
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {analytics.totalUsers}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              Cuentas registradas
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación de Analítica */}
        <div className="mt-6 flex flex-wrap gap-1 border-t border-zinc-700/80 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-colors ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            📋 Resumen General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mangas")}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-colors ${
              activeTab === "mangas"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            🏆 Top Mangas ({analytics.topMangas.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chapters")}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-colors ${
              activeTab === "chapters"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            📖 Top Capítulos ({analytics.topChapters.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-colors ${
              activeTab === "categories"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            🏷️ Por Tipo y Demografía
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scanlations")}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-colors ${
              activeTab === "scanlations"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            🛡️ Scanlations ({analytics.scanlationsRank.length})
          </button>
        </div>
      </div>

      {/* Contenido según pestaña */}
      <div className="p-5">
        {/* PESTAÑA 1: RESUMEN GENERAL */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Resumen Top 5 Mangas */}
              <div className="border border-zinc-300 bg-zinc-50 p-4">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-xs font-black text-zinc-900 uppercase">
                    🔥 Obras Más Populares
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("mangas")}
                    className="text-xs font-bold text-[#1d4ed8] hover:underline"
                  >
                    Ver todas »
                  </button>
                </div>
                <div className="mt-3 divide-y divide-zinc-200">
                  {analytics.topMangas.slice(0, 5).map((m, idx) => {
                    const pct = Math.round((m.views / maxMangaViews) * 100);
                    return (
                      <div key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-black ${
                                idx === 0
                                  ? "bg-amber-400 text-zinc-950"
                                  : idx === 1
                                    ? "bg-zinc-300 text-zinc-900"
                                    : idx === 2
                                      ? "bg-amber-700 text-white"
                                      : "bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <Link
                              href={`/manga/${m.slug}`}
                              className="font-bold text-zinc-900 truncate hover:text-[#1d4ed8] hover:underline"
                            >
                              {m.title}
                            </Link>
                          </div>
                          <span className="shrink-0 font-black text-[#1d4ed8]">
                            {m.views.toLocaleString()} vistas
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-zinc-200">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resumen Top 5 Capítulos */}
              <div className="border border-zinc-300 bg-zinc-50 p-4">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-xs font-black text-zinc-900 uppercase">
                    ⚡ Capítulos con Más Lecturas
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("chapters")}
                    className="text-xs font-bold text-[#1d4ed8] hover:underline"
                  >
                    Ver todos »
                  </button>
                </div>
                <div className="mt-3 divide-y divide-zinc-200">
                  {analytics.topChapters.slice(0, 5).map((ch, idx) => {
                    const pct = Math.round((ch.views / maxChapterViews) * 100);
                    return (
                      <div key={ch.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-black ${
                                idx === 0
                                  ? "bg-amber-400 text-zinc-950"
                                  : idx === 1
                                    ? "bg-zinc-300 text-zinc-900"
                                    : idx === 2
                                      ? "bg-amber-700 text-white"
                                      : "bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <Link
                              href={`/leer/${ch.id}`}
                              className="font-bold text-zinc-900 truncate hover:text-[#1d4ed8] hover:underline"
                            >
                              {ch.mangaTitle} — Cap. {ch.chapterNumber}
                            </Link>
                          </div>
                          <span className="shrink-0 font-black text-emerald-700">
                            {ch.views.toLocaleString()} vistas
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-zinc-200">
                          <div
                            className="h-full bg-emerald-600 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {analytics.topChapters.length === 0 && (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No hay capítulos leídos aún.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Banner explicativo del algoritmo de métricas */}
            <div className="border border-blue-200 bg-blue-50/70 p-4 text-xs text-zinc-700">
              <strong className="text-[#1d4ed8] uppercase">ℹ Cómo funciona la analítica de KuruManga:</strong>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-zinc-600">
                <li>
                  <strong>Protección contra spam:</strong> Cada IP/Navegador tiene un cooldown de 30 minutos por obra para evitar conteos repetidos con F5.
                </li>
                <li>
                  <strong>Filtro de rastreadores:</strong> Bots de motores de búsqueda (Googlebot, Bingbot, etc.) son descartados automáticamente.
                </li>
                <li>
                  <strong>Exclusión de tu cuenta:</strong> Mientras tengas sesión iniciada como <code>ADMIN</code>, ninguna de tus visitas a obras o lecturas alterará los contadores.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: RANKING COMPLETO DE MANGAS */}
        {activeTab === "mangas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                Ranking de Obras por Visualizaciones
              </h3>
              <span className="text-xs text-zinc-500">
                Total indexadas: {analytics.topMangas.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-zinc-300">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-zinc-300 bg-zinc-900 text-white uppercase">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Obra</th>
                    <th className="p-3 text-center">Tipo</th>
                    <th className="p-3 text-center">Demografía</th>
                    <th className="p-3 text-center">Caps</th>
                    <th className="p-3 text-center">Puntaje</th>
                    <th className="p-3 text-right">Vistas</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {analytics.topMangas.map((m, idx) => {
                    const pct = Math.round((m.views / maxMangaViews) * 100);
                    return (
                      <tr key={m.id} className="hover:bg-zinc-50 transition">
                        <td className="p-3 text-center font-black">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center text-xs ${
                              idx === 0
                                ? "bg-amber-400 text-zinc-950 font-black shadow-xs"
                                : idx === 1
                                  ? "bg-zinc-300 text-zinc-900 font-black"
                                  : idx === 2
                                    ? "bg-amber-700 text-white font-black"
                                    : "bg-zinc-100 text-zinc-600 font-bold"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-9 shrink-0 overflow-hidden border border-zinc-300 bg-zinc-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.coverUrl}
                                alt={m.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/manga/${m.slug}`}
                                className="font-extrabold text-zinc-900 hover:text-[#1d4ed8] hover:underline line-clamp-1"
                              >
                                {m.title}
                              </Link>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="h-1.5 w-24 bg-zinc-200">
                                  <div
                                    className="h-full bg-indigo-600"
                                    style={{ width: `${Math.max(pct, 5)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-400">
                                  {pct}% del máx
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 uppercase">
                            {m.type}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 uppercase">
                            {m.demography}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-zinc-700">
                          {m.chaptersCount}
                        </td>
                        <td className="p-3 text-center font-black text-amber-600">
                          ★ {m.rating.toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-black text-indigo-700 sm:text-sm">
                            {m.views.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/editar-manga/${encodeURIComponent(m.slug)}`}
                              className="border border-[#1d4ed8] bg-blue-50 px-2.5 py-1 text-[11px] font-black text-[#1d4ed8] uppercase hover:bg-[#1d4ed8] hover:text-white"
                            >
                              Editar
                            </Link>
                            <Link
                              href={`/manga/${encodeURIComponent(m.slug)}`}
                              className="border border-zinc-400 bg-zinc-100 px-2 py-1 text-[11px] font-bold text-zinc-800 uppercase hover:bg-zinc-200"
                            >
                              Ver ↗
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: TOP CAPÍTULOS */}
        {activeTab === "chapters" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                Capítulos Más Leídos de la Plataforma
              </h3>
              <span className="text-xs text-zinc-500">
                Top {analytics.topChapters.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-zinc-300">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-zinc-300 bg-zinc-900 text-white uppercase">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Obra &amp; Capítulo</th>
                    <th className="p-3">Scanlation</th>
                    <th className="p-3 text-right">Lecturas</th>
                    <th className="p-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {analytics.topChapters.map((ch, idx) => (
                    <tr key={ch.id} className="hover:bg-zinc-50 transition">
                      <td className="p-3 text-center font-black">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center text-xs ${
                            idx === 0
                              ? "bg-amber-400 text-zinc-950 font-black shadow-xs"
                              : idx === 1
                                ? "bg-zinc-300 text-zinc-900 font-black"
                                : idx === 2
                                  ? "bg-amber-700 text-white font-black"
                                  : "bg-zinc-100 text-zinc-600 font-bold"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-extrabold text-zinc-900">
                          {ch.mangaTitle}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Capítulo {ch.chapterNumber} {ch.chapterTitle ? `— ${ch.chapterTitle}` : ""}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-zinc-700">
                        {ch.scanlationName}
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-black text-emerald-700 sm:text-sm">
                          {ch.views.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/leer/${ch.id}`}
                          className="border border-emerald-600 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-900 uppercase hover:bg-emerald-600 hover:text-white"
                        >
                          Leer »
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {analytics.topChapters.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        Aún no se registran lecturas en capítulos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: DISTRIBUCIÓN POR TIPO Y DEMOGRAFÍA */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Por Tipo de Obra */}
            <div className="border border-zinc-300 bg-zinc-50 p-5">
              <h3 className="border-b border-zinc-200 pb-2 text-xs font-black text-zinc-900 uppercase">
                Vistas por Formato / Tipo
              </h3>
              <div className="mt-4 space-y-4">
                {Object.entries(analytics.viewsByType).map(([type, count]) => {
                  const pct = Math.round((count / totalTypeViews) * 100);
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-zinc-800 uppercase">
                          {type}
                        </span>
                        <span className="font-bold text-zinc-600">
                          {count.toLocaleString()} vistas ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full bg-zinc-200">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por Demografía */}
            <div className="border border-zinc-300 bg-zinc-50 p-5">
              <h3 className="border-b border-zinc-200 pb-2 text-xs font-black text-zinc-900 uppercase">
                Vistas por Demografía
              </h3>
              <div className="mt-4 space-y-4">
                {Object.entries(analytics.viewsByDemography).map(([demo, count]) => {
                  const pct = Math.round((count / totalDemoViews) * 100);
                  return (
                    <div key={demo}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-zinc-800 uppercase">
                          {demo}
                        </span>
                        <span className="font-bold text-zinc-600">
                          {count.toLocaleString()} vistas ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full bg-zinc-200">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 5: SCANLATIONS */}
        {activeTab === "scanlations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                Rendimiento y Vistas de Grupos Scanlation
              </h3>
              <span className="text-xs text-zinc-500">
                {analytics.scanlationsRank.length} grupos registrados
              </span>
            </div>

            <div className="overflow-x-auto border border-zinc-300">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-zinc-300 bg-zinc-900 text-white uppercase">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Grupo Scanlation</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Capítulos Subidos</th>
                    <th className="p-3 text-right">Vistas Acumuladas</th>
                    <th className="p-3 text-center">Perfil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {analytics.scanlationsRank.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition">
                      <td className="p-3 text-center font-black">
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-black text-zinc-900">
                          {s.name}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {s.verified ? (
                          <span className="border border-emerald-600 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                            ✓ Verificado
                          </span>
                        ) : (
                          <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            Estándar
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-zinc-700">
                        {s.uploadsCount}
                      </td>
                      <td className="p-3 text-right font-black text-indigo-700 sm:text-sm">
                        {s.totalViews.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/scanlation/${s.slug}`}
                          className="border border-zinc-400 bg-white px-3 py-1 text-[11px] font-bold text-zinc-800 uppercase hover:bg-zinc-100"
                        >
                          Ver Perfil ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {analytics.scanlationsRank.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        No hay grupos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

