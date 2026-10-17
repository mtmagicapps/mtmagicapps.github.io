# Changelog

## 1.0.0-rc9
- UDS read ops compatibility fixes

## 1.0.0-rc8
- New Control unit screen, paving the way for more features.
- ALPHA: Guided functions are bundled for basic settings.
- ALPHA: Output tests and basic settings (TP 2.0 units).
- ALPHA: Coding and long coding (TP 2.0 units).
- ALPHA: Adaptation (TP 2.0 units).
- ALPHA: Service reset (TP 2.0 instrument clusters), on the home screen.
- ALPHA: Login numbers (TP 2.0 units).
- ALPHA: Security access (TP 2.0 units).

## 1.0.0-rc7

- Android Auto selection: The limit of 4 values now applies per dashboard, not to the whole app.
- Android Auto selection: More realistic preview of the car screen with a dashboard selector.

## 1.0.0-rc6

- Procedures: new **Create with AI** entry in Add a procedure.
- Procedures are available without a connection. Running them offline is not supported.
- UDS compatibility fixes.
- Recommended adapters: the vGate iCar Pro 2S is listed as an affordable alternative.
- Improve strings for improved UX.

## 1.0.0-rc5

- First Alpha release
- Update for the latest adapter compatibility and minor bug fixes.

## 1.0.0-rc4

- TP2.0 protocol fixes
- Stability: fix a possible crash when the connection ended right after it was made (background service); sharing, opening Bluetooth or app settings and picking a file never crash the app any more on a phone that lacks the needed screen or storage.
- Saved procedures, runs, mileage checks and fault backups are written safely: an app killed while saving keeps the previous version, and procedures whose list entry was lost are listed again (as imported).
- Saved user data now using Jetpack DataStore. Existing settings, profiles, values and dashboards are moved over on the first start; nothing to do.
- Harden file handling (procedures, values, fault-text files).
- Fix issues in non-alphabetic locales.
- UI performance improvements.
- Plurals handling improvements.
- Log traces improvements.
- Various other stability, and privacy improvements.

## 1.0.0-rc3

- Android Auto: opens on the last opened dashboard (phone or car) and shows only its values enabled for Android Auto; the Back arrow goes to the list of dashboards. The phone's Dashboards screen also reopens on that dashboard.

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
