"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

// Pick a project's centre + see its geofence radius on an OpenStreetMap map.
// Click the map or drag the pin to move the centre; the circle is the radius.
// Works even without map tiles (offline) — the coordinates stay editable.
const PIN = `<svg viewBox="0 0 24 24" width="26" height="26" fill="#10b981" stroke="#fff" stroke-width="1.5">
  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/>
  <circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`

const DHAKA = [23.8103, 90.4125]

export default function MapPicker({ lat, lng, radius, onChange }) {
  const elRef = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const circle = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import("leaflet")).default
      if (cancelled || map.current || !elRef.current) return
      const center =
        Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : DHAKA
      const m = L.map(elRef.current).setView(center, 15)

      // Street map (OpenStreetMap).
      const street = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "© OpenStreetMap" },
      )
      // Satellite (Esri World Imagery — free, no key) + a transparent labels
      // overlay so roads & place names stay readable over the imagery.
      const satellite = L.layerGroup([
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 21, maxNativeZoom: 19, attribution: "Imagery © Esri" },
        ),
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 21, maxNativeZoom: 19, opacity: 0.9 },
        ),
      ])
      street.addTo(m) // default view
      L.control
        .layers(
          { Street: street, Satellite: satellite },
          {},
          { position: "topright", collapsed: false },
        )
        .addTo(m)
      const icon = L.divIcon({
        className: "gt-pin",
        html: PIN,
        iconSize: [26, 26],
        iconAnchor: [13, 24],
      })
      const mk = L.marker(center, { draggable: true, icon }).addTo(m)
      const cr = L.circle(center, {
        radius: Math.max(10, radius || 150),
        color: "#10b981",
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.12,
      }).addTo(m)
      const commit = (latlng) => {
        mk.setLatLng(latlng)
        cr.setLatLng(latlng)
        onChangeRef.current({
          lat: +latlng.lat.toFixed(6),
          lng: +latlng.lng.toFixed(6),
        })
      }
      mk.on("drag", (e) => cr.setLatLng(e.target.getLatLng()))
      mk.on("dragend", (e) => commit(e.target.getLatLng()))
      m.on("click", (e) => commit(e.latlng))
      map.current = m
      marker.current = mk
      circle.current = cr
      setTimeout(() => m.invalidateSize(), 200)
    })()
    return () => {
      cancelled = true
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect manual coordinate edits onto the map.
  useEffect(() => {
    if (!marker.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    const p = [lat, lng]
    marker.current.setLatLng(p)
    circle.current.setLatLng(p)
    map.current.panTo(p)
  }, [lat, lng])

  useEffect(() => {
    if (circle.current) circle.current.setRadius(Math.max(10, radius || 150))
  }, [radius])

  const locate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        onChangeRef.current({
          lat: +latitude.toFixed(6),
          lng: +longitude.toFixed(6),
        })
        if (map.current) map.current.setView([latitude, longitude], 17)
      },
      () => alert("Couldn't get your location. Enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div>
      <div
        ref={elRef}
        style={{ height: 280 }}
        className="z-0 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={locate}
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          📍 Use my current location
        </button>
        <span className="text-[11px] text-slate-400">
          Click the map or drag the pin to set the centre
        </span>
      </div>
    </div>
  )
}
