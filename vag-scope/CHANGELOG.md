# Changelog

## 1.0.0-rc2

- Dashboards: Add value tells you to scan the control units when none has a value list yet.
- Android Auto: never reconnects to the demo car, only to the last real adapter.
- The app opens on home screen with Connect, Mileage reports and Procedure runs: saved results of every car can be browsed offline, newest first, with search and filters.

## 1.0.0-rc1

- Fix missing connection notification after permission approval.
- Fix wrong gear value and fuel pressure in the RS6 example procedure.
- Fault scan: fix progress label when the control unit list has not been scanned yet.
- Keep screen on while scanning faults.
- Add a Recommended adapters page, opened from the Connect screen and Settings.
- Procedures: hide the ones that do not fit the connected car by default; none are listed until the control units are scanned.
- Keep the adapter connection for 5 minutes (was 30 s) when the app is in the background.
- Settings: More readable.
