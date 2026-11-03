# KM Climate Card

Eigenständige Lovelace-Karte für Home Assistant. Zielplattform: Home Assistant 2026.10.x.

## Installation über HACS (manuell als Custom Repository)

1. Lege ein GitHub-Repository an, z. B. `km-climate-card`.
2. Lade `km-climate-card.js` in den Repository-Root.
3. In HACS → Frontend → ⋮ → Benutzerdefinierte Repositories:
   - Repository-URL eintragen
   - Kategorie: Dashboard
4. Installieren und Home Assistant / Browser-Cache aktualisieren.
5. Falls HACS die Ressource nicht automatisch registriert, unter Einstellungen → Dashboards → Ressourcen hinzufügen:
   - URL: `/hacsfiles/km-climate-card/km-climate-card.js`
   - Typ: JavaScript-Modul

## Beispielkonfiguration

```yaml
type: custom:km-climate-card
entity: climate.wohnzimmer

sensors:
  temperature: sensor.wandthermostat_temperature_2
  humidity: sensor.wandthermostat_humidity_2

valves:
  - sensor.heizkorperthermostat_links_heating
  - sensor.heizkorperthermostat_rechts_heating

winter_mode: input_boolean.heizung_wohnzimmer_wintermodus
visibility_entity: input_boolean.wz_raumklima
visibility_state: "on"

controls:
  boost:
    enabled: true
    timer: timer.wohnzimmer_boost
    duration: 5
  temperature:
    enabled: true
    step: 0.5
  presets:
    - value: Default
      label: Std
    - value: eco
      label: Eco
    - value: Abends
      label: Abends
    - value: Morgens / Abends
      label: Morgens

graph:
  enabled: true
  hours: 24

appearance:
  theme: glass
  accent_color: "#E0386A"
  radius: 24
```

## Einzelnes Ventil

Nur eine Ventil-Entität eintragen:

```yaml
valves:
  - sensor.heizkorperthermostat_links_heating
```

Die Ventil-Chip-Anzeige zeigt dann nur diesen einen Wert. Bei keinem verfügbaren Ventilwert wird der Chip ausgeblendet. Die Heizkörpergrafik richtet sich nach allen verfügbaren Ventilwerten.

## Hinweise zu Version 1.0.0

- Temperatur, Luftfeuchtigkeit, Solltemperatur, Modus und Presets werden live aus Home Assistant gelesen.
- Boost schaltet das Preset `boost`; die optionale Timer-Entität liefert den Countdown.
- Plus/Minus verwendet die konfigurierbare Schrittweite und begrenzt auf `min_temp` / `max_temp`.
- Die grafische Editor-Grundversion erlaubt die wichtigsten Entitäts- und Darstellungsangaben.
- Der Graph-Bereich zeigt in dieser ersten Version bewusst nur aktuelle Livewerte und die ausgewählte Zeitspanne als Hinweis. Für einen echten historischen Linienverlauf wird in einer Folgeveröffentlichung eine HA-Statistik-/History-Anbindung ergänzt; es werden keine Messpunkte erfunden.
- Der Temperaturindikator nutzt dieselben Schwellen wie das bereitgestellte Beispiel.
- Die Karte verwendet keine `custom:button-card`-Instanzen und benötigt diese nicht.

## Dateien

- `km-climate-card.js` – Frontend-Karte und Editor
